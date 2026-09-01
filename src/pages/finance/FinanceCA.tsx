import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import TransactionDialog, { TxRow } from "@/components/finance/TransactionDialog";
import { Plus, Pencil } from "lucide-react";
import FinanceScopeBar from "@/components/finance/FinanceScopeBar";
import { useFinanceScope } from "@/lib/finance/scope";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";

export default function FinanceCA() {
  const scope = useFinanceScope();
  const { byId } = useBusinessUnits();
  const [allRows, setAllRows] = useState<any[]>([]);
  const rows = useMemo(
    () => (scope.buId ? allRows.filter((r) => r.business_unit_id === scope.buId) : allRows),
    [allRows, scope.buId],
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const load = async () => {
    const { data } = await supabase.from("finance_transactions").select("*").eq("kind", "sale").order("date");
    setAllRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const presta = rows.filter((r) => r.category === "prestation");
  const achat = rows.filter((r) => r.category === "achat_revente");

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; presta: number; achat: number }>();
    rows.forEach((r) => {
      const m = r.date?.slice(0, 7) ?? "";
      if (!m) return;
      if (!map.has(m)) map.set(m, { month: m, presta: 0, achat: 0 });
      const b = map.get(m)!;
      if (r.category === "achat_revente") b.achat += Number(r.amount_ht || 0);
      else b.presta += Number(r.amount_ht || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  const totalPresta = presta.reduce((a, r) => a + Number(r.amount_ht || 0), 0);
  const totalAchat = achat.reduce((a, r) => a + Number(r.amount_ht || 0), 0);
  const margeAchat = achat.reduce((a, r) => a + Number(r.amount_ht || 0) - Number(r.supplier_cost_ht || 0), 0);
  const tauxMarge = totalAchat > 0 ? (margeAchat / totalAchat) * 100 : 0;
  const totalCost = achat.reduce((a, r) => a + Number(r.supplier_cost_ht || 0), 0);
  const tauxMarque = totalCost > 0 ? (margeAchat / totalCost) * 100 : 0;

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Chiffre d'affaires" description="Prestations et Achats / Reventes — jamais mélangés." />
      <FinanceNav />
      <FinanceScopeBar />
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter une vente
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Prestations (graphisme et autres)</div>
          <div className="text-2xl font-semibold mt-1">{fmtMoney(totalPresta)}</div>
          <div className="text-xs text-muted-foreground mt-2">{presta.length} factures</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Achats / Reventes (impression, goodies…)</div>
          <div className="text-2xl font-semibold mt-1">{fmtMoney(totalAchat)}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Marge brute : <span className="text-foreground font-medium">{fmtMoney(margeAchat)}</span> · Taux de marge {tauxMarge.toFixed(1)}% · Taux de marque {tauxMarque.toFixed(1)}%
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Évolution mensuelle</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
            <Legend />
            <Bar dataKey="presta" name="Prestations" fill="hsl(var(--primary))" />
            <Bar dataKey="achat" name="Achats/Reventes" fill="hsl(var(--muted-foreground))" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-0 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">N°</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Catégorie</th>
                <th className="text-right px-3 py-2">HT</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice().reverse().map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2">{r.doc_number ?? "—"}</td>
                  <td className="px-3 py-2">{r.counterparty ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.category === "achat_revente" ? "Achat/Revente" : "Prestation"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(r.amount_ht || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(Number(r.amount_ttc || 0))}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Aucune vente</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <TransactionDialog open={open} onOpenChange={setOpen} kind="sale" initial={editing} onSaved={load} />
    </div>
  );
}