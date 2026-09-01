import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtMoney } from "@/lib/format";
import TransactionDialog, { TxRow } from "@/components/finance/TransactionDialog";
import { Plus, Pencil } from "lucide-react";
import RecurringExpensesSuggestions from "@/components/finance/RecurringExpensesSuggestions";
import FinanceScopeBar from "@/components/finance/FinanceScopeBar";
import { useFinanceScope, periodRange } from "@/lib/finance/scope";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { useTxSplits } from "@/hooks/useTxSplits";
import { splitShares } from "@/lib/finance/units";

export default function FinanceExpenses() {
  const scope = useFinanceScope();
  const range = periodRange(scope);
  const { byId } = useBusinessUnits();
  const [rows, setRows] = useState<any[]>([]);
  const splits = useTxSplits();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const load = async () => {
    const { data } = await supabase.from("finance_transactions")
      .select("*, clients(name), projects(name), tasks(title)")
      .eq("kind", "expense").order("date", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    const scoped = rows.filter(
      (r) =>
        (!scope.buId || splitShares(r, splits).some((s) => s.buId === scope.buId)) &&
        r.date >= range.start &&
        r.date <= range.end,
    );
    if (!term) return scoped;
    return scoped.filter((r) =>
      [r.counterparty, r.label, r.clients?.name, r.projects?.name, r.tasks?.title].some((v) => (v ?? "").toString().toLowerCase().includes(term)),
    );
  }, [rows, q, scope.buId, range.start, range.end, splits]);

  const total = filtered.reduce((a, r) => a + Number(r.amount_ht || 0), 0);

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Dépenses" description="Fournisseurs, projets, tâches — filtre à ta guise." />
      <FinanceNav />
      <FinanceScopeBar />
      <RecurringExpensesSuggestions onChange={load} />
      <div className="flex items-center gap-2 mb-4">
        <Input placeholder="Rechercher fournisseur, projet, client…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        <div className="text-sm text-muted-foreground">Total : <span className="font-medium text-foreground">{fmtMoney(total)}</span> HT</div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter une dépense
          </Button>
        </div>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Fournisseur</th>
                <th className="text-left px-3 py-2">Libellé</th>
                <th className="text-left px-3 py-2">Pôle</th>
                <th className="text-left px-3 py-2">Projet / Tâche</th>
                <th className="text-right px-3 py-2">HT</th>
                <th className="text-right px-3 py-2">TVA</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2">{r.counterparty ?? "—"}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.label}>{r.label ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {splits.get(r.id)?.length ? (
                      <span title={splits.get(r.id)!.map((s) => `${byId.get(s.business_unit_id)?.name ?? "?"} ${s.share_pct}%`).join(" · ")}>
                        Réparti ({splits.get(r.id)!.length})
                      </span>
                    ) : r.business_unit_id ? (
                      byId.get(r.business_unit_id)?.name ?? "—"
                    ) : (
                      <span className="text-muted-foreground">Global</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{[r.projects?.name, r.tasks?.title].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(r.amount_ht || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(Number(r.vat_amount || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(Number(r.amount_ttc || 0))}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune dépense</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <TransactionDialog open={open} onOpenChange={setOpen} kind="expense" initial={editing} onSaved={load} />
    </div>
  );
}