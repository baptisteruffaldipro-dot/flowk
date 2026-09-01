import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceScopeBar from "@/components/finance/FinanceScopeBar";
import BulkAssignUnits from "@/components/finance/BulkAssignUnits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fmtMinutes, fmtMoney } from "@/lib/format";
import { periodRange, useFinanceScope } from "@/lib/finance/scope";
import { useTxSplits } from "@/hooks/useTxSplits";
import { aggregateByUnit, consolidate, emptyMetrics, type TxLite, type UnitMetrics } from "@/lib/finance/units";
import { reloadBusinessUnits, useBusinessUnits } from "@/hooks/useBusinessUnits";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";

export default function FinanceUnits() {
  const scope = useFinanceScope();
  const range = periodRange(scope);
  const { units, activeUnits } = useBusinessUnits();

  const [tx, setTx] = useState<TxLite[]>([]);
  const [minutes, setMinutes] = useState<Map<string, number>>(new Map());
  const [rates, setRates] = useState<Map<string, number>>(new Map());
  const [alloc, setAlloc] = useState<Map<string, number>>(new Map());
  const [goals, setGoals] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const [t, te, tasks, r, a, g] = await Promise.all([
        supabase
          .from("finance_transactions")
          .select("id, kind, category, date, paid_date, amount_ht, amount_ttc, supplier_cost_ht, business_unit_id")
          .gte("date", range.start)
          .lte("date", range.end),
        supabase.from("time_entries").select("task_id, duration_minutes, started_at").gte("started_at", range.start).lte("started_at", range.end + "T23:59:59"),
        supabase.from("tasks").select("id, business_unit_id"),
        supabase.from("bu_hourly_rates").select("business_unit_id, activity, hourly_rate").eq("activity", "production"),
        supabase.from("bu_allocation_rules").select("business_unit_id, share_pct, active").eq("active", true),
        supabase.from("bu_goals").select("*").eq("period_type", "month").gte("period_start", range.start).lte("period_start", range.end),
      ]);
      setTx((t.data as TxLite[]) ?? []);
      const taskBu = new Map((tasks.data ?? []).map((x: any) => [x.id, x.business_unit_id]));
      const m = new Map<string, number>();
      for (const e of (te.data as any[]) ?? []) {
        const bu = taskBu.get(e.task_id);
        if (!bu) continue;
        m.set(bu, (m.get(bu) ?? 0) + (Number(e.duration_minutes) || 0));
      }
      setMinutes(m);
      setRates(new Map(((r.data as any[]) ?? []).map((x) => [x.business_unit_id, Number(x.hourly_rate) || 0])));
      setAlloc(new Map(((a.data as any[]) ?? []).map((x) => [x.business_unit_id, Number(x.share_pct) || 0])));
      setGoals((g.data as any[]) ?? []);
    })();
  }, [range.start, range.end, tick]);

  const byUnit = useMemo(
    () => aggregateByUnit(tx, { start: range.start, end: range.end, allocation: alloc, minutesByUnit: minutes, rateByUnit: rates, splits }),
    [tx, range.start, range.end, alloc, minutes, rates],
  );

  const rows = activeUnits.map((u) => ({ unit: u, m: byUnit.get(u.id) ?? emptyMetrics(u.id) }));
  const globalM = byUnit.get(null) ?? emptyMetrics(null);
  const total = consolidate([...rows.map((r) => r.m), globalM]);

  const goalFor = (buId: string) => {
    const g = goals.filter((x) => x.business_unit_id === buId);
    return {
      revenue: g.reduce((a, x) => a + Number(x.revenue_goal || 0), 0),
      result: g.reduce((a, x) => a + Number(x.profit_goal || 0), 0),
    };
  };

  const addUnit = async () => {
    const name = newName.trim();
    if (!name) return;
    const code = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const { error } = await supabase.from("business_units").insert({ name, code, position: units.length + 1 });
    if (error) return toast.error(error.message);
    setNewName("");
    await reloadBusinessUnits();
    toast.success("Pôle ajouté");
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Pôles d'activité" description="Pilotage comparé de chaque activité sur la période sélectionnée." />
      <FinanceNav />
      <FinanceScopeBar showUnits={false} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Kpi label="CA HT facturé" value={fmtMoney(total.revenueInvoiced)} />
        <Kpi label="CA HT encaissé" value={fmtMoney(total.revenueCollected)} />
        <Kpi label="Dépenses HT" value={fmtMoney(total.expenses + total.sharedExpenses + total.purchaseCost)} />
        <Kpi label="Résultat" value={fmtMoney(total.result)} accent={total.result >= 0 ? "pos" : "neg"} />
      </div>

      <Card className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2">Pôle</th>
                <th className="text-right px-3 py-2">CA facturé</th>
                <th className="text-right px-3 py-2">Encaissé</th>
                <th className="text-right px-3 py-2">Dépenses</th>
                <th className="text-right px-3 py-2">Marge brute</th>
                <th className="text-right px-3 py-2">Résultat</th>
                <th className="text-right px-3 py-2">Temps</th>
                <th className="text-right px-3 py-2">Coût temps</th>
                <th className="text-right px-3 py-2">Objectif CA</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ unit, m }) => {
                const g = goalFor(unit.id);
                return (
                  <tr key={unit.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: unit.color }} />
                        <Link to={`/finance/poles/${unit.code}`} className="font-medium hover:underline">
                          {unit.name}
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(m.revenueInvoiced)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(m.revenueCollected)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(m.expenses + m.sharedExpenses + m.purchaseCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(m.grossMargin)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${m.result >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(m.result)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMinutes(m.minutes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(m.timeCost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {g.revenue > 0 ? (
                        <span className={m.revenueInvoiced >= g.revenue ? "text-emerald-600" : "text-muted-foreground"}>
                          {Math.round((m.revenueInvoiced / g.revenue) * 100)}% de {fmtMoney(g.revenue)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="icon" variant="ghost">
                        <Link to={`/finance/poles/${unit.code}`}><ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30">
                <td className="px-3 py-2 text-muted-foreground italic">Non affecté / global</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(globalM.revenueInvoiced)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(globalM.revenueCollected)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(globalM.expenses + globalM.purchaseCost)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(globalM.grossMargin)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(globalM.result)}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BulkAssignUnits onDone={() => setTick((t) => t + 1)} />
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Ajouter un pôle</div>
          <div className="flex gap-2">
            <Input placeholder="Nom du pôle" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button onClick={addUnit}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Les charges communes non affectées sont ventilées selon la clé de répartition définie dans « Objectifs & règles ».
          </p>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accent === "pos" ? "text-emerald-600" : accent === "neg" ? "text-rose-600" : ""}`}>{value}</div>
    </Card>
  );
}

export type { UnitMetrics };
