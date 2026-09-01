import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Download } from "lucide-react";

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function FinanceReports({ embedded }: { embedded?: boolean } = {}) {
  const [tx, setTx] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("finance_transactions").select("*").order("date");
    setTx(data ?? []);
  })(); }, []);

  const byYear = useMemo(() => {
    const map = new Map<string, { year: string; revenue: number; expenses: number; vat_net: number }>();
    for (const r of tx) {
      const y = (r.date ?? "").slice(0, 4); if (!y) continue;
      if (!map.has(y)) map.set(y, { year: y, revenue: 0, expenses: 0, vat_net: 0 });
      const b = map.get(y)!;
      if (r.kind === "sale") { b.revenue += Number(r.amount_ht || 0); b.vat_net += Number(r.vat_amount || 0); }
      else if (r.kind === "expense") { b.expenses += Number(r.amount_ht || 0); b.vat_net -= Number(r.vat_amount || 0); }
    }
    return Array.from(map.values()).sort((a, b) => b.year.localeCompare(a.year));
  }, [tx]);

  return (
    <div className={embedded ? "" : "p-6 md:p-8"}>
      {!embedded && (
        <PageHeader
          title="Rapports"
          description="Exports comptables et synthèses annuelles."
          actions={<Button variant="outline" size="sm" onClick={() => download("finance_transactions.csv", toCSV(tx))}><Download className="h-4 w-4 mr-1" /> Export CSV complet</Button>}
        />
      )}
      {embedded && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={() => download("finance_transactions.csv", toCSV(tx))}><Download className="h-4 w-4 mr-1" /> Export CSV complet</Button>
        </div>
      )}

      {!embedded && <FinanceNav />}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">Année</th>
              <th className="text-right px-3 py-2">CA HT</th>
              <th className="text-right px-3 py-2">Dépenses HT</th>
              <th className="text-right px-3 py-2">Résultat</th>
              <th className="text-right px-3 py-2">TVA nette</th>
            </tr>
          </thead>
          <tbody>
            {byYear.map((y) => (
              <tr key={y.year} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{y.year}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(y.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(y.expenses)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(y.revenue - y.expenses)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(y.vat_net)}</td>
              </tr>
            ))}
            {byYear.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune donnée</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}