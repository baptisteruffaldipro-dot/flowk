// Envoie une facture (prestation + impressions) à un scénario Make,
// qui la crée en brouillon dans Tiime et renvoie { tiime_invoice_id, number }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Line = {
  source: "task" | "print";
  source_id: string;
  category: "benefit" | "sale";
  description: string;
  quantity: number;
  unit_amount_ht: number;
  line_amount_ht: number;
  vat_rate: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const webhook = Deno.env.get("MAKE_TIIME_WEBHOOK_URL");
    const shared = Deno.env.get("MAKE_TIIME_SHARED_SECRET");
    if (!webhook || !shared) return json({ error: "Make n'est pas encore configuré." }, 409);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Non authentifié" }, 401);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Réservé aux admins" }, 403);

    const body = await req.json().catch(() => ({}));

    // Exemple fictif pour que Make apprenne la structure (aucune écriture en base)
    if (body?.action === "sample") {
      const sample = {
        emission_date: new Date().toISOString().slice(0, 10),
        title: "Test — exemple Flowk",
        client: { name: "Client Test", contact: "Client Test", email: "test@example.com", address: "1 rue Test, 17200 Royan", phone: null },
        lines: [
          { sequence: 1, category: "benefit", description: "Création graphique", quantity: 1, unit_amount_ht: 500, line_amount_ht: 500, vat_rate: 20 },
          { sequence: 2, category: "sale", description: "Cartes de visite\nFormat : 85x55 mm — Support : Couché mat — Grammage : 350 g — Finitions : Pelliculage mat", quantity: 250, unit_amount_ht: 0.32, line_amount_ht: 80, vat_rate: 20 },
        ],
        totals: { ht: 580, vat: 116, ttc: 696 },
        refs: { task_ids: [], print_order_ids: [] },
        sample: true,
      };
      const r = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json", "x-make-apikey": shared }, body: JSON.stringify(sample) });
      return json({ ok: r.ok, status: r.status, details: await r.text() });
    }
    const lines: Line[] = Array.isArray(body?.lines) ? body.lines : [];
    const clientId: string | undefined = body?.client_id;
    if (!clientId || lines.length === 0) return json({ error: "Client et au moins une ligne requis" }, 400);
    for (const l of lines) {
      if (!["task", "print"].includes(l.source) || typeof l.source_id !== "string" || !(Number(l.line_amount_ht) > 0)) {
        return json({ error: "Ligne invalide" }, 400);
      }
    }
    const taskIds = lines.filter((l) => l.source === "task").map((l) => l.source_id);
    const printIds = lines.filter((l) => l.source === "print").map((l) => l.source_id);

    // Anti-doublon : refuse si une ligne est déjà facturée ou en cours
    const [{ data: ts }, { data: ps }, { data: client }] = await Promise.all([
      taskIds.length ? admin.from("tasks").select("id,tiime_invoice_id,tiime_invoice_status").in("id", taskIds) : Promise.resolve({ data: [] as any[] }),
      printIds.length ? admin.from("print_orders").select("id,tiime_invoice_id,tiime_invoice_status").in("id", printIds) : Promise.resolve({ data: [] as any[] }),
      admin.from("clients").select("name,company,email,address,phone").eq("id", clientId).maybeSingle(),
    ]);
    const busy = [...(ts ?? []), ...(ps ?? [])].find((r: any) => r.tiime_invoice_id || r.tiime_invoice_status === "pending");
    if (busy) return json({ error: "Une des lignes est déjà facturée dans Tiime." }, 409);
    if (!client) return json({ error: "Client introuvable" }, 404);

    const mark = async (patch: Record<string, unknown>) => {
      if (taskIds.length) await admin.from("tasks").update(patch).in("id", taskIds);
      if (printIds.length) await admin.from("print_orders").update(patch).in("id", printIds);
    };
    await mark({ tiime_invoice_status: "pending" });

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const ht = r2(lines.reduce((s, l) => s + Number(l.line_amount_ht), 0));
    const vat = r2(lines.reduce((s, l) => s + (Number(l.line_amount_ht) * Number(l.vat_rate)) / 100, 0));
    const payload = {
      emission_date: new Date().toISOString().slice(0, 10),
      title: typeof body?.title === "string" ? body.title.slice(0, 200) : null,
      client: { name: client.company || client.name, contact: client.name, email: client.email, address: client.address, phone: client.phone },
      lines: lines.map((l, i) => ({
        sequence: i + 1,
        category: l.category,
        description: String(l.description).slice(0, 1000),
        quantity: Number(l.quantity),
        unit_amount_ht: Number(l.unit_amount_ht),
        line_amount_ht: Number(l.line_amount_ht),
        vat_rate: Number(l.vat_rate),
      })),
      totals: { ht, vat, ttc: r2(ht + vat) },
      refs: { task_ids: taskIds, print_order_ids: printIds },
    };

    let res: Response;
    try {
      res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-make-apikey": shared },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      await mark({ tiime_invoice_status: null });
      return json({ error: "Make n'a pas répondu.", details: String(e) }, 502);
    }
    const text = await res.text();
    if (!res.ok) {
      await mark({ tiime_invoice_status: null });
      console.error(`Make failed [${res.status}]: ${text}`);
      return json({ error: "Make a refusé la facture.", status: res.status, details: text }, 502);
    }
    let out: any = {};
    try { out = JSON.parse(text); } catch { /* Make sans réponse JSON */ }
    const id = out?.tiime_invoice_id ? String(out.tiime_invoice_id) : null;
    const number = out?.number ? String(out.number) : null;
    if (!id) {
      // Make n'a pas confirmé la création (scénario en erreur ou sans Webhook response) :
      // on ne bloque pas les lignes, pour pouvoir relancer.
      await mark({ tiime_invoice_status: null });
      return json({ error: "Make n'a pas confirmé la création de la facture dans Tiime. Vérifie le scénario (client introuvable ?).", details: text }, 502);
    }
    await mark({
      tiime_invoice_id: id,
      tiime_invoice_number: number,
      tiime_invoice_status: "draft",
      tiime_sent_at: new Date().toISOString(),
    });
    return json({ ok: true, tiime_invoice_id: id, number });
  } catch (e) {
    console.error("make-tiime-invoice error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 500);
  }
});
