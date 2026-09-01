import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceScopeBar from "@/components/finance/FinanceScopeBar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Tags } from "lucide-react";
import TransactionDialog, { TxRow } from "@/components/finance/TransactionDialog";
import SplitDialog from "@/components/finance/SplitDialog";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { useTxSplits } from "@/hooks/useTxSplits";
import { splitShares } from "@/lib/finance/units";
import { useFinanceScope, periodRange } from "@/lib/finance/scope";

type Row = any;

const CATEGORIES: { value: string; label: string; kinds: string[] }[] = [
  { value: "prestation", label: "Prestation", kinds: ["sale"] },
  { value: "achat_revente", label: "Achat-revente", kinds: ["sale", "expense"] },
  { value: "frais_fixe", label: "Frais fixe", kinds: ["expense"] },
  { value: "expense", label: "Dépense ponctuelle", kinds: ["expense"] },
  { value: "remuneration_dirigeant", label: "Rémunération dirigeant", kinds: ["expense", "bank"] },
  { value: "apport_perso", label: "Apport perso", kinds: ["bank", "expense"] },
  { value: "retrait_perso", label: "Retrait perso", kinds: ["bank", "expense"] },
  { value: "bank", label: "Mouvement bancaire", kinds: ["bank"] },
  { value: "other", label: "Autre", kinds: ["sale", "expense", "bank"] },
];

const KIND_LABEL: Record<string, string> = { sale: "Vente", expense: "Dépense", bank: "Banque" };

export default function FinanceTransactions() {
  const scope = useFinanceScope();
  const range = periodRange(scope);
  const { activeUnits, byId } = useBusinessUnits();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [onlyTodo, setOnlyTodo] = useState(params.get("todo") === "1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [tick, setTick] = useState(0);
  const splits = useTxSplits(tick);
  const [splitTargets, setSplitTargets] = useState<{ ids: string[]; amount: number } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("finance_transactions")
      .select("id, kind, category, date, paid_date, doc_number, label, counterparty, amount_ht, amount_ht_presta, amount_ht_achat, vat_amount, amount_ttc, vat_rate, supplier_cost_ht, business_unit_id, client_id, project_id, clients(name)")
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: false })
      .limit(2000);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range.start, range.end, tick]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (onlyTodo) next.set("todo", "1"); else next.delete("todo");
    setParams(next, { replace: true });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [onlyTodo]);

  const isTodo = (r: Row) => !r.business_unit_id && !(splits.get(r.id)?.length);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (cat !== "all" && r.category !== cat) return false;
      if (scope.buId && !splitShares(r, splits).some((s) => s.buId === scope.buId)) return false;
      if (onlyTodo && !isTodo(r)) return false;
      if (!term) return true;
      return [r.counterparty, r.label, r.doc_number, r.clients?.name]
        .some((v) => (v ?? "").toString().toLowerCase().includes(term));
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [rows, q, kind, cat, onlyTodo, scope.buId, splits]);

  const todoCount = useMemo(() => rows.filter(isTodo).length, [rows, splits]);

  const totals = useMemo(() => {
    let ca = 0, dep = 0;
    for (const r of filtered) {
      const ht = Number(r.amount_ht) || 0;
      if (r.kind === "sale") ca += ht;
      else if (r.kind === "expense") dep += Math.abs(ht);
    }
    return { ca, dep };
  }, [filtered]);

  const patch = async (ids: string[], values: Record<string, any>) => {
    const { error } = await supabase.from("finance_transactions").update(values as any).in("id", ids);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, ...values } : r)));
    toast.success(ids.length > 1 ? `${ids.length} lignes mises à jour` : "Mis à jour");
  };

  const setUnit = (r: Row, v: string) => patch([r.id], { business_unit_id: v === "none" ? null : v });
  const setCategory = (r: Row, v: string) => patch([r.id], { category: v, category_source: "manual" });

  const bulk = (values: Record<string, any>) => {
    const ids = [...selected];
    if (!ids.length) return;
    patch(ids, values).then(() => setSelected(new Set()));
  };

  const memorizeRule = async (r: Row) => {
    const pattern = (r.counterparty ?? r.label ?? "").trim();
    if (!pattern) return toast.error("Aucun fournisseur à mémoriser");
    const { error } = await supabase.from("finance_category_rules").insert({
      pattern,
      field: r.counterparty ? "counterparty" : "label",
      match_kind: r.kind,
      category: r.category,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(`Règle mémorisée pour « ${pattern} »`);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Transactions" description="Ventes, achats et mouvements bancaires — un seul endroit pour tout labelliser." />
      <FinanceNav />
      <FinanceScopeBar />

      {todoCount > 0 && (
        <Card className="p-3 mb-4 flex flex-wrap items-center gap-3 border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20">
          <Tags className="h-4 w-4 text-amber-600" />
          <span className="text-sm">{todoCount} transaction(s) sans pôle.</span>
          <Button size="sm" variant={onlyTodo ? "default" : "outline"} onClick={() => setOnlyTodo((v) => !v)}>
            {onlyTodo ? "Voir tout" : "Voir uniquement à labelliser"}
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input placeholder="Rechercher fournisseur, client, libellé…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="sale">Ventes</SelectItem>
            <SelectItem value="expense">Dépenses</SelectItem>
            <SelectItem value="bank">Banque</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les natures</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          CA <span className="font-medium text-foreground tabular-nums">{fmtMoney(totals.ca)}</span> · Dépenses{" "}
          <span className="font-medium text-foreground tabular-nums">{fmtMoney(totals.dep)}</span> HT
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
          <Select onValueChange={(v) => bulk({ business_unit_id: v === "none" ? null : v })}>
            <SelectTrigger className="w-[190px] h-8"><SelectValue placeholder="Affecter à un pôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non affecté</SelectItem>
              {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulk({ category: v, category_source: "manual" })}>
            <SelectTrigger className="w-[190px] h-8"><SelectValue placeholder="Changer la nature" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ids = filtered.filter((r) => selected.has(r.id)).map((r) => r.id);
              const amount = filtered.filter((r) => selected.has(r.id)).reduce((a, r) => a + Math.abs(Number(r.amount_ht || 0)), 0);
              setSplitTargets({ ids, amount });
            }}
          >
            Répartir sur plusieurs pôles
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Annuler</Button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 w-8">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(c) => setSelected(c ? new Set(filtered.map((r) => r.id)) : new Set())}
                  />
                </th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Tiers</th>
                <th className="text-left px-3 py-2">Libellé</th>
                <th className="text-left px-3 py-2 w-[180px]">Pôle</th>
                <th className="text-left px-3 py-2 w-[180px]">Nature</th>
                <th className="text-right px-3 py-2">HT</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sp = splits.get(r.id);
                return (
                  <tr key={r.id} className={`border-b last:border-0 hover:bg-muted/30 ${isTodo(r) ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                    <td className="px-3 py-1.5"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate" title={r.clients?.name ?? r.counterparty ?? ""}>
                      {r.clients?.name ?? r.counterparty ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 max-w-[220px] truncate text-muted-foreground" title={r.label ?? ""}>{r.label ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      {sp?.length ? (
                        <button
                          type="button"
                          className="flex flex-wrap items-center gap-1 text-left"
                          onClick={() => setSplitTargets({ ids: [r.id], amount: Math.abs(Number(r.amount_ht || 0)) })}
                          title="Modifier la répartition"
                        >
                          {sp.map((s) => (
                            <span
                              key={s.business_unit_id}
                              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: byId.get(s.business_unit_id)?.color }} />
                              {byId.get(s.business_unit_id)?.name ?? "?"} {Math.round(Number(s.share_pct))}%
                            </span>
                          ))}
                        </button>
                      ) : (
                        <Select
                          value={r.business_unit_id ?? "none"}
                          onValueChange={(v) =>
                            v === "__split"
                              ? setSplitTargets({ ids: [r.id], amount: Math.abs(Number(r.amount_ht || 0)) })
                              : setUnit(r, v)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Non affecté</SelectItem>
                            {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                            <SelectItem value="__split">Plusieurs pôles…</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={r.category} onValueChange={(v) => setCategory(r, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.filter((c) => c.kinds.includes(r.kind)).map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(Number(r.amount_ht || 0))}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMoney(Number(r.amount_ttc || 0))}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {(r.counterparty || r.label) && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => memorizeRule(r)} title="Mémoriser la nature pour ce fournisseur">
                          Règle
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setOpen(true); }} title="Modifier / ventiler">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune transaction sur cette période</td></tr>
              )}
              {loading && <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">Chargement…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <SplitDialog
        open={!!splitTargets}
        onOpenChange={(v) => { if (!v) setSplitTargets(null); }}
        transactionIds={splitTargets?.ids ?? []}
        amountHt={splitTargets?.amount ?? 0}
        onSaved={() => { setSelected(new Set()); setTick((t) => t + 1); }}
      />

      <TransactionDialog
        open={open}
        onOpenChange={setOpen}
        kind={(editing?.kind as any) ?? "expense"}
        initial={editing}
        onSaved={() => setTick((t) => t + 1)}
      />
    </div>
  );
}
