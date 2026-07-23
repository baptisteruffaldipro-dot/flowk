import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Palmtree, AlertTriangle, TrendingUp } from "lucide-react";

type Row = { date: string; kind: string; amount_ttc: number };

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function VacationWindows() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("finance_transactions")
        .select("date, kind, amount_ttc")
        .in("kind", ["sale", "expense"])
        .gte("date", "2025-01-01")
        .order("date", { ascending: true });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const analysis = useMemo(() => {
    // Aggregate by month index (0-11) across all years, averaged
    const byMonth: Record<number, { sales: number[]; nb: number[]; net: number[] }> = {};
    for (let m = 0; m < 12; m++) byMonth[m] = { sales: [], nb: [], net: [] };

    const perMonthYear: Record<string, { sales: number; expenses: number; nb: number }> = {};
    for (const r of rows) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!perMonthYear[key]) perMonthYear[key] = { sales: 0, expenses: 0, nb: 0 };
      if (r.kind === "sale") { perMonthYear[key].sales += Number(r.amount_ttc); perMonthYear[key].nb += 1; }
      else if (r.kind === "expense") perMonthYear[key].expenses += Number(r.amount_ttc);
    }
    for (const [key, v] of Object.entries(perMonthYear)) {
      const m = Number(key.split("-")[1]);
      byMonth[m].sales.push(v.sales);
      byMonth[m].nb.push(v.nb);
      byMonth[m].net.push(v.sales - v.expenses);
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const months = Array.from({ length: 12 }, (_, m) => ({
      m,
      name: MONTHS[m],
      avgSales: avg(byMonth[m].sales),
      avgNb: avg(byMonth[m].nb),
      avgNet: avg(byMonth[m].net),
      samples: byMonth[m].sales.length,
    }));

    const overallAvgSales = avg(months.map(x => x.avgSales).filter(x => x > 0));
    const scored = months.map(x => ({
      ...x,
      // Lower score = better vacation window
      score: x.samples === 0 ? 999 : (x.avgSales / (overallAvgSales || 1)) * 0.7 + (x.avgNb / 15) * 0.3,
    }));

    const sortedCalm = [...scored].filter(x => x.samples > 0).sort((a, b) => a.score - b.score);
    const sortedBusy = [...scored].filter(x => x.samples > 0).sort((a, b) => b.score - a.score);

    return {
      months: scored,
      bestWindows: sortedCalm.slice(0, 4),
      avoidWindows: sortedBusy.slice(0, 3),
      overallAvgSales,
    };
  }, [rows]);

  if (loading) return <Card className="p-4"><div className="text-sm text-muted-foreground">Analyse des périodes de vacances…</div></Card>;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Palmtree className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold">Fenêtres de vacances recommandées</h3>
        <span className="text-xs text-muted-foreground ml-auto">Basé sur l'historique 2025 →</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 mb-2">
            <Palmtree className="h-3.5 w-3.5" /> Meilleures fenêtres (activité faible)
          </div>
          <div className="space-y-2">
            {analysis.bestWindows.map(w => (
              <div key={w.m} className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-[11px] text-muted-foreground">CA moyen {fmtMoney(w.avgSales)} · {w.avgNb.toFixed(0)} factures</div>
                </div>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">Calme</Badge>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> À éviter (mois porteurs)
          </div>
          <div className="space-y-2">
            {analysis.avoidWindows.map(w => (
              <div key={w.m} className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-[11px] text-muted-foreground">CA moyen {fmtMoney(w.avgSales)} · {w.avgNb.toFixed(0)} factures</div>
                </div>
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Chargé</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Intensité mois par mois (CA moyen)</div>
        <div className="grid grid-cols-12 gap-1">
          {analysis.months.map(m => {
            const ratio = analysis.overallAvgSales ? Math.min(1, m.avgSales / (analysis.overallAvgSales * 1.5)) : 0;
            const isBest = analysis.bestWindows.some(b => b.m === m.m);
            const isWorst = analysis.avoidWindows.some(b => b.m === m.m);
            const color = isBest ? "bg-emerald-500" : isWorst ? "bg-red-500" : "bg-slate-400";
            return (
              <div key={m.m} className="flex flex-col items-center gap-1">
                <div className="h-16 w-full flex items-end">
                  <div className={`w-full rounded-t ${color} opacity-80`} style={{ height: `${Math.max(6, ratio * 100)}%` }} title={`${m.name}: ${fmtMoney(m.avgSales)}`} />
                </div>
                <div className="text-[10px] text-muted-foreground">{m.name.slice(0, 3)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted-foreground border-t pt-3">
        💡 Avant de partir : vérifie que le solde couvre loyer + mensualité crédit + TVA si elle tombe pendant ton absence.
      </div>
    </Card>
  );
}