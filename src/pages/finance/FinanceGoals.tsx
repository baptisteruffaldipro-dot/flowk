import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { periodRange, useFinanceScope } from "@/lib/finance/scope";
import FinanceScopeBar from "@/components/finance/FinanceScopeBar";
import { toast } from "sonner";

export default function FinanceGoals() {
  const { activeUnits } = useBusinessUnits();
  const scope = useFinanceScope();
  const range = periodRange(scope);
  const monthStart = range.start.slice(0, 8) + "01";

  const [goals, setGoals] = useState<Record<string, any>>({});
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [rates, setRates] = useState<Record<string, Record<string, number>>>({});

  const load = async () => {
    const [g, a, r] = await Promise.all([
      supabase.from("bu_goals").select("*").eq("period_type", "month").eq("period_start", monthStart),
      supabase.from("bu_allocation_rules").select("*"),
      supabase.from("bu_hourly_rates").select("*"),
    ]);
    const gm: Record<string, any> = {};
    for (const x of (g.data as any[]) ?? []) gm[x.business_unit_id] = x;
    setGoals(gm);
    const am: Record<string, number> = {};
    for (const x of (a.data as any[]) ?? []) am[x.business_unit_id] = Number(x.share_pct) || 0;
    setAlloc(am);
    const rm: Record<string, Record<string, number>> = {};
    for (const x of (r.data as any[]) ?? []) {
      rm[x.business_unit_id] = rm[x.business_unit_id] ?? {};
      rm[x.business_unit_id][x.activity] = Number(x.hourly_rate) || 0;
    }
    setRates(rm);
  };
  useEffect(() => { load(); }, [monthStart]);

  const saveGoal = async (buId: string, patch: any) => {
    const current = goals[buId] ?? {};
    const payload = {
      business_unit_id: buId,
      period_type: "month",
      period_start: monthStart,
      revenue_goal: Number(current.revenue_goal ?? 0),
      expense_goal: Number(current.expense_goal ?? 0),
      profit_goal: Number(current.profit_goal ?? 0),
      ...patch,
    };
    const { error } = await supabase.from("bu_goals").upsert(payload, { onConflict: "business_unit_id,period_type,period_start" });
    if (error) return toast.error(error.message);
    setGoals((g) => ({ ...g, [buId]: { ...current, ...payload } }));
  };

  const saveAlloc = async (buId: string, pct: number) => {
    const { error } = await supabase.from("bu_allocation_rules").upsert({ business_unit_id: buId, share_pct: pct, active: true }, { onConflict: "business_unit_id" });
    if (error) return toast.error(error.message);
    setAlloc((a) => ({ ...a, [buId]: pct }));
  };

  const saveRate = async (buId: string, activity: string, value: number) => {
    const { error } = await supabase.from("bu_hourly_rates").upsert({ business_unit_id: buId, activity, hourly_rate: value }, { onConflict: "business_unit_id,activity" });
    if (error) return toast.error(error.message);
    setRates((r) => ({ ...r, [buId]: { ...(r[buId] ?? {}), [activity]: value } }));
  };

  const allocTotal = Object.values(alloc).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Objectifs & règles" description="Objectifs mensuels par pôle, clé de répartition des charges communes et coûts horaires internes." />
      <FinanceNav />
      <FinanceScopeBar showUnits={false} />

      <Card className="p-0 overflow-hidden mb-6">
        <div className="px-4 py-3 text-sm font-medium border-b">Objectifs — {range.label}</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">Pôle</th>
              <th className="text-right px-3 py-2">Objectif CA HT</th>
              <th className="text-right px-3 py-2">Objectif dépenses HT</th>
              <th className="text-right px-3 py-2">Objectif résultat</th>
            </tr>
          </thead>
          <tbody>
            {activeUnits.map((u) => {
              const g = goals[u.id] ?? {};
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: u.color }} /> {u.name}
                    </span>
                  </td>
                  {(["revenue_goal", "expense_goal", "profit_goal"] as const).map((k) => (
                    <td key={k} className="px-3 py-2 text-right">
                      <Input
                        className="h-8 w-32 text-right ml-auto"
                        type="number"
                        step="0.01"
                        defaultValue={g[k] ?? 0}
                        onBlur={(e) => Number(e.target.value) !== Number(g[k] ?? 0) && saveGoal(u.id, { [k]: Number(e.target.value) })}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium mb-1">Répartition des charges communes</div>
          <p className="text-xs text-muted-foreground mb-3">
            Les dépenses sans pôle sont ventilées selon ces parts. Laisse tout à 0 pour les conserver au niveau global.
          </p>
          {activeUnits.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm">{u.name}</span>
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-20 text-right"
                  type="number"
                  step="1"
                  defaultValue={alloc[u.id] ?? 0}
                  onBlur={(e) => Number(e.target.value) !== (alloc[u.id] ?? 0) && saveAlloc(u.id, Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
          <div className={`mt-2 border-t pt-2 text-xs ${allocTotal === 0 || allocTotal === 100 ? "text-muted-foreground" : "text-amber-600"}`}>
            Total : {allocTotal}% {allocTotal !== 0 && allocTotal !== 100 && "— la ventilation est faite au prorata."}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-1">Coûts horaires internes</div>
          <p className="text-xs text-muted-foreground mb-3">Servent à valoriser le temps passé (indicateur analytique, jamais une écriture comptable).</p>
          <div className="space-y-3">
            {activeUnits.map((u) => (
              <div key={u.id}>
                <Label className="text-xs">{u.name}</Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["production", "prospection", "creation_graphique"] as const).map((act) => (
                    <div key={act} className="flex items-center gap-1">
                      <Input
                        className="h-8 text-right"
                        type="number"
                        step="1"
                        defaultValue={rates[u.id]?.[act] ?? 0}
                        onBlur={(e) => Number(e.target.value) !== (rates[u.id]?.[act] ?? 0) && saveRate(u.id, act, Number(e.target.value))}
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {act === "production" ? "prod." : act === "prospection" ? "prosp." : "créa"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Astuce : l'objectif de résultat sert de repère sur la fiche de chaque pôle ({fmtMoney(0)} = non défini).
      </p>
      <Button className="hidden" onClick={load} />
    </div>
  );
}
