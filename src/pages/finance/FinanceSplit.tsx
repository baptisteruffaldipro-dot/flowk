import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, Filter } from "lucide-react";

type Row = {
  id: string;
  date: string;
  label: string | null;
  counterparty: string | null;
  amount_ht: number;
  amount_ht_presta: number | null;
  amount_ht_achat: number | null;
  split_reviewed: boolean;
};

// Mots-clés qui suggèrent de la revente (impression, supports physiques)
const REVENTE_KEYWORDS = [
  "impression", "imprim", "carte de visite", "cartes", "menu", "menus",
  "panneau", "bâche", "bache", "sticker", "flyer", "affiche", "kakemono",
  "roll-up", "rollup", "brochure", "plaquette", "covering", "vinyl", "tirage",
];

function suggestSplit(label: string | null, ht: number): { presta: number; achat: number } {
  const l = (label || "").toLowerCase();
  const hasRevente = REVENTE_KEYWORDS.some((k) => l.includes(k));
  const hasCreation = /(concept|maquette|logo|design|graph|shooting|accompagnement|strat|community|social|refonte)/.test(l);
  const signed = ht;
  if (hasRevente && hasCreation) return { presta: +(signed * 0.4).toFixed(2), achat: +(signed * 0.6).toFixed(2) };
  if (hasRevente) return { presta: 0, achat: signed };
  return { presta: signed, achat: 0 };
}

export default function FinanceSplit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"todo" | "done" | "all">("todo");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { presta: string; achat: string }>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("id, date, label, counterparty, amount_ht, amount_ht_presta, amount_ht_achat, split_reviewed")
      .eq("kind", "sale")
      .order("date", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "todo" && r.split_reviewed) return false;
      if (filter === "done" && !r.split_reviewed) return false;
      if (!q) return true;
      return (r.label || "").toLowerCase().includes(q) || (r.counterparty || "").toLowerCase().includes(q);
    });
  }, [rows, filter, search]);

  function getDraft(r: Row): { presta: string; achat: string } {
    if (drafts[r.id]) return drafts[r.id];
    if (r.amount_ht_presta != null || r.amount_ht_achat != null) {
      return { presta: String(r.amount_ht_presta ?? 0), achat: String(r.amount_ht_achat ?? 0) };
    }
    const s = suggestSplit(r.label, Number(r.amount_ht));
    return { presta: String(s.presta), achat: String(s.achat) };
  }

  function setDraft(id: string, patch: Partial<{ presta: string; achat: string }>) {
    setDrafts((d) => ({ ...d, [id]: { ...getDraftById(id), ...patch } }));
  }
  function getDraftById(id: string) {
    const r = rows.find((x) => x.id === id)!;
    return getDraft(r);
  }

  async function saveRow(r: Row) {
    const d = getDraft(r);
    const p = Number(d.presta) || 0;
    const a = Number(d.achat) || 0;
    setSaving(true);
    const category = a !== 0 && p === 0 ? "achat_revente" : "prestation";
    const { error } = await supabase
      .from("finance_transactions")
      .update({ amount_ht_presta: p, amount_ht_achat: a, split_reviewed: true, category: category as any })
      .eq("id", r.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Répartition enregistrée");
    setDrafts((d) => { const n = { ...d }; delete n[r.id]; return n; });
    load();
  }

  async function saveAllSuggestions() {
    if (!confirm(`Appliquer la suggestion automatique aux ${filtered.length} lignes affichées ?`)) return;
    setSaving(true);
    const updates = filtered.map((r) => {
      const s = suggestSplit(r.label, Number(r.amount_ht));
      const category = s.achat !== 0 && s.presta === 0 ? "achat_revente" : "prestation";
      return supabase.from("finance_transactions")
        .update({ amount_ht_presta: s.presta, amount_ht_achat: s.achat, split_reviewed: true, category: category as any })
        .eq("id", r.id);
    });
    const results = await Promise.all(updates);
    setSaving(false);
    const errs = results.filter((r) => r.error).length;
    if (errs) toast.error(`${errs} erreurs`); else toast.success(`${filtered.length} lignes mises à jour`);
    load();
  }

  const totals = useMemo(() => {
    let p = 0, a = 0, tot = 0;
    for (const r of rows.filter((r) => r.split_reviewed)) {
      p += Number(r.amount_ht_presta || 0);
      a += Number(r.amount_ht_achat || 0);
      tot += Number(r.amount_ht || 0);
    }
    return { presta: p, achat: a, total: tot };
  }, [rows]);

  const reviewedCount = rows.filter((r) => r.split_reviewed).length;

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Répartition presta / achat-revente" description="Découpe chaque facture entre création (presta) et impression revendue (achat-revente) pour un calcul fidèle de la marge." />
      <FinanceNav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Factures validées</div>
          <div className="text-xl font-semibold">{reviewedCount} / {rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">CA presta (validé)</div>
          <div className="text-xl font-semibold text-emerald-600">{fmtMoney(totals.presta)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">CA achat/revente (validé)</div>
          <div className="text-xl font-semibold text-sky-600">{fmtMoney(totals.achat)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Total HT validé</div>
          <div className="text-xl font-semibold">{fmtMoney(totals.total)}</div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {(["todo", "done", "all"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "todo" ? "À valider" : f === "done" ? "Validées" : "Toutes"}
              </Button>
            ))}
          </div>
          <Input placeholder="Rechercher (client, libellé)…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-9" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filtered.length} lignes</span>
            <Button size="sm" variant="secondary" disabled={saving || filtered.length === 0} onClick={saveAllSuggestions}>
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Auto (Impression → 100% achat, mixte → 40/60)
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Libellé</th>
                <th className="text-right p-3">HT total</th>
                <th className="text-right p-3">Presta (€)</th>
                <th className="text-right p-3">Achat/revente (€)</th>
                <th className="text-right p-3">Écart</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const d = getDraft(r);
                const p = Number(d.presta) || 0;
                const a = Number(d.achat) || 0;
                const diff = +(Number(r.amount_ht) - p - a).toFixed(2);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 whitespace-nowrap text-xs">{r.date}</td>
                    <td className="p-2 text-xs">{r.counterparty || "—"}</td>
                    <td className="p-2 text-xs max-w-[280px] truncate" title={r.label ?? ""}>{r.label || "—"}</td>
                    <td className="p-2 text-right font-medium">{fmtMoney(Number(r.amount_ht))}</td>
                    <td className="p-2 text-right">
                      <Input type="number" step="0.01" value={d.presta} onChange={(e) => setDraft(r.id, { presta: e.target.value })} className="h-8 w-24 text-right ml-auto" />
                    </td>
                    <td className="p-2 text-right">
                      <Input type="number" step="0.01" value={d.achat} onChange={(e) => setDraft(r.id, { achat: e.target.value })} className="h-8 w-24 text-right ml-auto" />
                    </td>
                    <td className={`p-2 text-right text-xs ${Math.abs(diff) < 0.01 ? "text-emerald-600" : "text-amber-600"}`}>{fmtMoney(diff)}</td>
                    <td className="p-2 text-right">
                      {r.split_reviewed && !drafts[r.id] ? (
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Validée
                        </Badge>
                      ) : (
                        <Button size="sm" disabled={saving} onClick={() => saveRow(r)}>Valider</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune ligne</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}