import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { aggregateByUnit, computeMrr, consolidate, emptyMetrics, monthlySeries, type TxLite } from "@/lib/finance/units";
import { monthLabel, monthsBetween } from "@/lib/finance/scope";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight } from "lucide-react";

/** Comparaison consolidée des pôles sur l'année en cours (bloc du tableau de bord). */
export default function UnitsComparison() {
  const { activeUnits } = useBusinessUnits();
  const [tx, setTx] = useState<TxLite[]>([]);
  const [subs, setSubs] = useState<any[]>([]);

  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  useEffect(() => {
    (async () => {
      const [t, s] = await Promise.all([
        supabase
          .from("finance_transactions")
          .select("id, kind, category, date, paid_date, amount_ht, amount_ttc, supplier_cost_ht, business_unit_id")
          .gte("date", start)
          .lte("date", end),
        supabase.from("subscriptions").select("monthly_ht, status"),
      ]);
      setTx((t.data as TxLite[]) ?? []);
      setSubs((s.data as any[]) ?? []);
    })();
  }, [start, end]);

  const byUnit = useMemo(() => aggregateByUnit(tx, { start, end }), [tx, start, end]);
  const rows = activeUnits.map((u) => ({ unit: u, m: byUnit.get(u.id) ?? emptyMetrics(u.id) }));
  const total = consolidate([...byUnit.values()]);
  const { mrr, arr } = computeMrr(subs);

  const months = useMemo(() => monthsBetween(start, end), [start, end]);
  const chart = useMemo(() => {
    const base = months.map((m) => ({ month: m, label: monthLabel(m) } as any));
    for (const u of activeUnits) {
      const s = monthlySeries(tx, months, u.id);
      s.forEach((d, i) => { base[i][u.code] = d.ca; });
    }
    return base;
  }, [tx, months, activeUnits]);

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium">Comparaison des pôles — {year}</div>
          <div className="text-xs text-muted-foreground">CA HT facturé, dépenses et résultat par activité</div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/finance/poles">Détail par pôle <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Mini label="CA HT total" value={fmtMoney(total.revenueInvoiced)} />
        <Mini label="Dépenses HT" value={fmtMoney(total.expenses + total.purchaseCost)} />
        <Mini label="Résultat" value={fmtMoney(total.result)} accent={total.result >= 0 ? "pos" : "neg"} />
        <Mini label="MRR / ARR" value={`${fmtMoney(mrr)} / ${fmtMoney(arr)}`} />
      </div>

      <div className="h-56 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
            <Legend />
            {activeUnits.map((u) => (
              <Bar key={u.id} dataKey={u.code} name={u.name} stackId="ca" fill={u.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="text-left px-2 py-1.5">Pôle</th>
              <th className="text-right px-2 py-1.5">CA HT</th>
              <th className="text-right px-2 py-1.5">Encaissé</th>
              <th className="text-right px-2 py-1.5">Dépenses</th>
              <th className="text-right px-2 py-1.5">Résultat</th>
              <th className="text-right px-2 py-1.5">Marge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ unit, m }) => (
              <tr key={unit.id} className="border-b last:border-0">
                <td className="px-2 py-1.5">
                  <Link to={`/finance/poles/${unit.code}`} className="inline-flex items-center gap-2 hover:underline">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: unit.color }} />
                    {unit.name}
                  </Link>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(m.revenueInvoiced)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMoney(m.revenueCollected)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMoney(m.expenses + m.purchaseCost)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${m.result >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(m.result)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{m.marginPct.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums ${accent === "pos" ? "text-emerald-600" : accent === "neg" ? "text-rose-600" : ""}`}>{value}</div>
    </div>
  );
}
