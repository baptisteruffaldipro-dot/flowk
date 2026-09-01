import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceScopeBar from "@/components/finance/FinanceScopeBar";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtMinutes, fmtMoney } from "@/lib/format";
import { monthLabel, monthsBetween, periodRange, useFinanceScope } from "@/lib/finance/scope";
import { useTxSplits } from "@/hooks/useTxSplits";
import { aggregateByUnit, computeMrr, emptyMetrics, monthlyRecurringCost, monthlySeries, type TxLite } from "@/lib/finance/units";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { computeTaskBilling } from "@/lib/billing";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function FinanceUnitDetail() {
  const { code } = useParams();
  const scope = useFinanceScope();
  const range = periodRange(scope);
  const { activeUnits } = useBusinessUnits();
  const unit = activeUnits.find((u) => u.code === code);

  const [tx, setTx] = useState<TxLite[]>([]);
  const [yearTx, setYearTx] = useState<TxLite[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [minutes, setMinutes] = useState(0);
  const [rate, setRate] = useState(0);

  useEffect(() => {
    if (!unit) return;
    const yStart = range.start.slice(0, 4) + "-01-01";
    const yEnd = range.end.slice(0, 4) + "-12-31";
    (async () => {
      const [t, yt, f, s, rec, tk, po, r] = await Promise.all([
        supabase
          .from("finance_transactions")
          .select("id, kind, category, date, paid_date, amount_ht, amount_ttc, supplier_cost_ht, business_unit_id, counterparty, label")
          .eq("business_unit_id", unit.id)
          .gte("date", range.start)
          .lte("date", range.end)
          .order("date", { ascending: false }),
        supabase
          .from("finance_transactions")
          .select("kind, category, date, amount_ht, business_unit_id")
          .eq("business_unit_id", unit.id)
          .gte("date", yStart)
          .lte("date", yEnd),
        supabase.from("finance_forecasts").select("*").eq("business_unit_id", unit.id).gte("planned_date", range.start).lte("planned_date", range.end),
        supabase.from("subscriptions").select("*").eq("business_unit_id", unit.id),
        supabase.from("recurring_expenses").select("*").eq("business_unit_id", unit.id),
        supabase.from("tasks").select("id, title, billing_type, flat_amount, hourly_rate, estimated_minutes, total_minutes, client_revisions_count, free_revisions, extra_revision_rate, status").eq("business_unit_id", unit.id),
        supabase.from("print_orders").select("id, reference, description, amount, status, created_at, supplier_cost_ht:amount").eq("business_unit_id", unit.id).order("created_at", { ascending: false }),
        supabase.from("bu_hourly_rates").select("activity, hourly_rate").eq("business_unit_id", unit.id).eq("activity", "production").maybeSingle(),
      ]);
      setTx((t.data as TxLite[]) ?? []);
      setYearTx((yt.data as TxLite[]) ?? []);
      setForecasts((f.data as any[]) ?? []);
      setSubs((s.data as any[]) ?? []);
      setRecurring((rec.data as any[]) ?? []);
      setTasks((tk.data as any[]) ?? []);
      setOrders((po.data as any[]) ?? []);
      setRate(Number((r.data as any)?.hourly_rate) || 0);

      const ids = ((tk.data as any[]) ?? []).map((x) => x.id);
      if (ids.length) {
        const { data: te } = await supabase
          .from("time_entries")
          .select("duration_minutes, started_at, task_id")
          .in("task_id", ids)
          .gte("started_at", range.start)
          .lte("started_at", range.end + "T23:59:59");
        setMinutes(((te as any[]) ?? []).reduce((a, e) => a + (Number(e.duration_minutes) || 0), 0));
      } else setMinutes(0);
    })();
  }, [unit?.id, range.start, range.end]);

  const m = useMemo(() => {
    const map = aggregateByUnit(tx, {
      start: range.start,
      end: range.end,
      minutesByUnit: new Map([[unit?.id ?? "x", minutes]]),
      rateByUnit: new Map([[unit?.id ?? "x", rate]]),
    });
    return map.get(unit?.id ?? null) ?? emptyMetrics(unit?.id ?? null);
  }, [tx, range.start, range.end, minutes, rate, unit?.id]);

  const months = useMemo(() => monthsBetween(range.start.slice(0, 4) + "-01-01", range.end.slice(0, 4) + "-12-31"), [range.start, range.end]);
  const series = useMemo(() => monthlySeries(yearTx, months, unit?.id ?? null, splits).map((d) => ({ ...d, label: monthLabel(d.month) })), [yearTx, months, unit?.id]);

  const { mrr, arr } = computeMrr(subs);
  const recurringMonthly = monthlyRecurringCost(recurring);
  const forecastRevenue = forecasts.filter((f) => f.kind === "in").reduce((a, f) => a + Number(f.amount_ttc || 0), 0);
  const forecastExpense = forecasts.filter((f) => f.kind !== "in").reduce((a, f) => a + Number(f.amount_ttc || 0), 0);

  if (!unit) {
    return (
      <div className="p-6 md:p-8">
        <PageHeader title="Pôle introuvable" />
        <FinanceNav />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <PageHeader title={unit.name} description={`Pilotage du pôle — ${range.label}`} />
      <FinanceNav />
      <FinanceScopeBar showUnits={false} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi label="CA HT facturé" value={fmtMoney(m.revenueInvoiced)} />
        <Kpi label="CA HT encaissé" value={fmtMoney(m.revenueCollected)} />
        <Kpi label="Dépenses HT" value={fmtMoney(m.expenses + m.purchaseCost)} />
        <Kpi label="Résultat" value={fmtMoney(m.result)} accent={m.result >= 0 ? "pos" : "neg"} />
        <Kpi label="Marge brute" value={`${fmtMoney(m.grossMargin)} · ${m.marginPct.toFixed(0)}%`} />
        <Kpi label="Temps passé" value={fmtMinutes(m.minutes)} sub={`Coût interne ${fmtMoney(m.timeCost)} (${rate} €/h)`} />
        <Kpi label="Résultat après coût du temps" value={fmtMoney(m.resultAfterTime)} accent={m.resultAfterTime >= 0 ? "pos" : "neg"} />
        <Kpi label="Encours à encaisser" value={fmtMoney(m.outstanding)} sub="TTC facturé non réglé" />
      </div>

      <Card className="p-4 mb-4">
        <div className="text-sm font-medium mb-3">CA / dépenses / résultat par mois</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
              <Legend />
              <Bar dataKey="ca" name="CA HT" fill={unit.color} radius={[3, 3, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses HT" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="resultat" name="Résultat" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Prévisionnel vs réel</div>
          <Line2 label="CA — réel" value={fmtMoney(m.revenueInvoiced)} />
          <Line2 label="CA — prévisionnel" value={fmtMoney(forecastRevenue)} muted />
          <Line2 label="Dépenses — réel" value={fmtMoney(m.expenses + m.purchaseCost)} />
          <Line2 label="Dépenses — prévisionnel" value={fmtMoney(forecastExpense + recurringMonthly)} muted />
          <p className="mt-2 text-xs text-muted-foreground">Les données prévisionnelles restent séparées du réel : elles ne sont jamais additionnées aux écritures.</p>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Charges récurrentes du pôle</div>
          {recurring.length === 0 && <div className="text-sm text-muted-foreground">Aucune charge récurrente.</div>}
          {recurring.map((r) => (
            <Line2 key={r.id} label={r.label} value={`${fmtMoney(Number(r.amount_ht))} / ${r.periodicity === "yearly" ? "an" : r.periodicity === "quarterly" ? "trim." : "mois"}`} />
          ))}
          {recurring.length > 0 && <div className="mt-2 border-t pt-2 text-sm font-medium">Total mensualisé : {fmtMoney(recurringMonthly)}</div>}
        </Card>
      </div>

      {unit.code === "platorama" && (
        <Card className="p-4 mb-4">
          <div className="text-sm font-medium mb-3">Abonnements Platorama</div>
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <Kpi label="MRR" value={fmtMoney(mrr)} />
            <Kpi label="ARR" value={fmtMoney(arr)} />
            <Kpi label="Marge récurrente mensuelle" value={fmtMoney(mrr - recurringMonthly)} accent={mrr - recurringMonthly >= 0 ? "pos" : "neg"} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-2 py-1.5">Client</th>
                  <th className="text-left px-2 py-1.5">Offre</th>
                  <th className="text-right px-2 py-1.5">Mise en service HT</th>
                  <th className="text-right px-2 py-1.5">Mensuel HT</th>
                  <th className="text-right px-2 py-1.5">Plats sup.</th>
                  <th className="text-right px-2 py-1.5">Chevalets</th>
                  <th className="text-right px-2 py-1.5">Chgt carte / an</th>
                  <th className="text-right px-2 py-1.5">Support / mois</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-2 py-1.5">{s.client_name ?? "—"}</td>
                    <td className="px-2 py-1.5 capitalize">{s.plan}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(Number(s.setup_fee_ht))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(Number(s.monthly_ht))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.extra_dishes}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.qr_stands}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.card_changes_per_year}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${Number(s.support_minutes_per_month) > 10 ? "text-rose-600" : "text-muted-foreground"}`}>
                      {s.support_minutes_per_month} min
                    </td>
                  </tr>
                ))}
                {subs.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-sm text-muted-foreground">Aucun abonnement — à saisir dans « Récurrents ».</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Cible support : 10 min/client/mois. Les lignes au-delà sont signalées en rouge.</p>
        </Card>
      )}

      {unit.code === "graphisme" && (
        <Card className="p-4 mb-4">
          <div className="text-sm font-medium mb-3">Rentabilité des prestations (timer réel)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-2 py-1.5">Tâche</th>
                  <th className="text-right px-2 py-1.5">Facturable HT</th>
                  <th className="text-right px-2 py-1.5">Temps réel</th>
                  <th className="text-right px-2 py-1.5">Coût du temps</th>
                  <th className="text-right px-2 py-1.5">Marge</th>
                  <th className="text-right px-2 py-1.5">€/h effectif</th>
                </tr>
              </thead>
              <tbody>
                {tasks
                  .map((t) => {
                    const b = computeTaskBilling(t);
                    const mins = Number(t.total_minutes) || 0;
                    const cost = (mins / 60) * rate;
                    return { t, total: b.total, mins, cost, margin: b.total - cost, perHour: mins > 0 ? b.total / (mins / 60) : 0 };
                  })
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 25)
                  .map((r) => (
                    <tr key={r.t.id} className="border-b last:border-0">
                      <td className="px-2 py-1.5">{r.t.title}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.total)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMinutes(r.mins)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMoney(r.cost)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${r.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtMoney(r.margin)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.perHour > 0 ? `${r.perHour.toFixed(0)} €/h` : "—"}</td>
                    </tr>
                  ))}
                {tasks.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-sm text-muted-foreground">Aucune tâche rattachée à ce pôle.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {unit.code === "royan_impression" && (
        <Card className="p-4 mb-4">
          <div className="text-sm font-medium mb-3">Commandes d'impression</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-2 py-1.5">Référence</th>
                  <th className="text-left px-2 py-1.5">Description</th>
                  <th className="text-left px-2 py-1.5">Statut</th>
                  <th className="text-right px-2 py-1.5">Prix de vente</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-2 py-1.5">{o.reference ?? "—"}</td>
                    <td className="px-2 py-1.5 max-w-xs truncate">{o.description ?? "—"}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{o.status}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(Number(o.amount || 0))}</td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-sm text-muted-foreground">Aucune commande rattachée à ce pôle.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le coût fournisseur se saisit sur la vente correspondante (champ « Coût d'achat HT ») : la marge du pôle en découle.
          </p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 text-sm font-medium border-b">Écritures de la période</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Tiers</th>
                <th className="text-left px-3 py-2">Libellé</th>
                <th className="text-right px-3 py-2">HT</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="text-left px-3 py-2">Réglé</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-xs">{r.kind === "sale" ? "Vente" : r.kind === "expense" ? "Dépense" : "Banque"}</td>
                  <td className="px-3 py-2">{r.counterparty ?? "—"}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{r.label ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(r.amount_ht || 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(r.amount_ttc || 0))}</td>
                  <td className="px-3 py-2 text-xs">{r.paid_date ? fmtDate(r.paid_date) : <span className="text-amber-600">Non</span>}</td>
                </tr>
              ))}
              {tx.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune écriture sur la période</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "pos" | "neg" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent === "pos" ? "text-emerald-600" : accent === "neg" ? "text-rose-600" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Line2({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 text-sm ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
