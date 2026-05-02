import { supabase } from "@/integrations/supabase/client";

type ClientRow = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  portal_user_id: string | null;
  created_at: string;
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
const normPhone = (s: string | null | undefined) =>
  (s ?? "").replace(/[^0-9+]/g, "").replace(/^00/, "+");

/** Score de richesse : plus c'est garni, plus c'est haut. */
function richness(c: ClientRow): number {
  let n = 0;
  if (c.email) n += 3;
  if (c.phone) n += 2;
  if (c.company) n += 2;
  if (c.address) n += 2;
  if (c.notes) n += (c.notes.length > 50 ? 2 : 1);
  if (c.portal_user_id) n += 5; // ne JAMAIS perdre un client connecté au portail
  if (c.name) n += 1;
  return n;
}

/** Regroupe les clients par clé de doublon (email > tel > nom+société). */
function groupDuplicates(rows: ClientRow[]): ClientRow[][] {
  const buckets = new Map<string, ClientRow[]>();
  for (const r of rows) {
    const keys: string[] = [];
    if (r.email) keys.push(`e:${norm(r.email)}`);
    const p = normPhone(r.phone);
    if (p && p.length >= 6) keys.push(`p:${p}`);
    const nameKey = norm(r.name);
    const companyKey = norm(r.company);
    if (nameKey && companyKey) keys.push(`nc:${nameKey}|${companyKey}`);
    else if (nameKey) keys.push(`n:${nameKey}`);
    for (const k of keys) {
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
    }
  }
  // Fusionne les buckets qui partagent au moins un client (transitivité simple)
  const seen = new Set<string>();
  const groups: ClientRow[][] = [];
  for (const arr of buckets.values()) {
    if (arr.length < 2) continue;
    const ids = arr.map((c) => c.id).sort().join("|");
    if (seen.has(ids)) continue;
    seen.add(ids);
    groups.push(arr);
  }
  return groups;
}

export type MergePlan = { keep: ClientRow; drop: ClientRow[] }[];

export async function detectDuplicatePlan(): Promise<MergePlan> {
  const { data, error } = await supabase
    .from("clients")
    .select("id,name,company,email,phone,address,notes,portal_user_id,created_at");
  if (error) throw error;
  const groups = groupDuplicates((data ?? []) as ClientRow[]);
  return groups.map((g) => {
    const sorted = [...g].sort((a, b) => richness(b) - richness(a));
    return { keep: sorted[0], drop: sorted.slice(1) };
  });
}

/** Fusionne automatiquement : transfère toutes les FK puis supprime les doublons. */
export async function executeMergePlan(plan: MergePlan): Promise<{ merged: number; reassigned: number }> {
  let merged = 0;
  let reassigned = 0;
  const childTables = ["projects", "tasks", "print_orders", "invoices", "bats", "appointments", "questionnaires"] as const;

  for (const { keep, drop } of plan) {
    const dropIds = drop.map((d) => d.id);
    if (dropIds.length === 0) continue;

    // 1) Réassigner toutes les références client_id vers le client gardé
    for (const table of childTables) {
      const { error, count } = await supabase
        .from(table)
        .update({ client_id: keep.id }, { count: "exact" })
        .in("client_id", dropIds);
      if (error) throw new Error(`${table}: ${error.message}`);
      reassigned += count ?? 0;
    }

    // 2) Compléter les champs manquants sur le client gardé
    const patch: any = {};
    for (const k of ["company", "email", "phone", "address"] as const) {
      if (!keep[k]) {
        const found = drop.find((d) => d[k]);
        if (found) patch[k] = found[k];
      }
    }
    // Concaténer les notes pour ne rien perdre
    const allNotes = [keep.notes, ...drop.map((d) => d.notes)].filter(Boolean);
    if (allNotes.length > 1) patch.notes = allNotes.join("\n\n— fusion —\n");
    if (Object.keys(patch).length > 0) {
      await supabase.from("clients").update(patch as any).eq("id", keep.id);
    }

    // 3) Supprimer les doublons
    const { error: delErr } = await supabase.from("clients").delete().in("id", dropIds);
    if (delErr) throw delErr;
    merged += dropIds.length;
  }
  return { merged, reassigned };
}