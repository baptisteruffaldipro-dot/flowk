import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart, CartesianGrid } from "recharts";
import { CalendarClock, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

type Event = {
  date: string; // ISO
  amount: number; // signed (+ inflow, − outflow)
  label: string;
  kind: "receivable" | "invoice" | "supplier" | "credit" | "vat" | "fixed" | "forecast";
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

export default function CashflowProjection() {
  const [events, setEvents] = useState<Event[]>([]);
  const [startBalance, setStartBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const horizon = addDays(today, 90);
      const horizonISO = iso(horizon);
      const todayISO = iso(today);

      const [bank, invoicesUnpaid, financings, forecasts, allTx] = await Promise.all([
        supabase.from("bank_balances").select("amount, as_of_date").order("as_of_date", { ascending: false }).limit(1),
        supabase.from("finance_transactions").select("amount_ttc, due_date, paid_date, kind, counterparty, label").is("paid_date", null).not("due_date", "is", null),
        (supabase as any).from("finance_financings").select("*").eq("active", true),
        supabase.from("finance_forecasts").select("amount_ttc, planned_date, kind, label").gte("planned_date", todayISO).lte("planned_date", horizonISO),
        supabase.from("finance_transactions").select("category, kind, amount_ttc, date"),
      ]);

      const startBal = Number(bank.data?.[0]?.amount ?? 0);
      setStartBalance(startBal);
      const evs: Event[] = [];

      // 1) Factures non payées avec date d'échéance dans l'horizon
      for (const t of ((invoicesUnpaid.data as any[]) ?? [])) {
        if (!t.due_date || t.due_date < todayISO || t.due_date > horizonISO) continue;
        const amt = Number(t.amount_ttc || 0);
        if (t.kind === "sale") {
          evs.push({ date: t.due_date, amount: amt, label: `${t.counterparty ?? "Client"} — facture due`, kind: "invoice" });
        } else if (t.kind === "expense") {
          evs.push({ date: t.due_date, amount: -Math.abs(amt), label: `${t.counterparty ?? "Fournisseur"} — à payer`, kind: "invoice" });
        }
      }

      // 3) Financements (crédits + dettes fournisseurs récurrentes type loyer)
      for (const f of ((financings.data as any[]) ?? [])) {
        if (f.received_date && f.received_date > todayISO && f.received_date <= horizonISO) {
          evs.push({ date: f.received_date, amount: Number(f.principal_amount || 0), label: `${f.label} — versement`, kind: "credit" });
        }
        const monthly = Number(f.monthly_payment || 0);
        if (monthly > 0 && f.first_payment_date && Number(f.remaining_installments) > 0) {
          const first = new Date(f.first_payment_date);
          for (let i = 0; i < Number(f.remaining_installments); i++) {
            const d = addMonths(first, i);
            const di = iso(d);
            if (di < todayISO || di > horizonISO) continue;
            evs.push({
              date: di,
              amount: -monthly,
              label: `${f.label} — ${f.kind === "other" ? "loyer" : "mensualité"}`,
              kind: f.kind === "other" ? "supplier" : "credit",
            });
          }
        }
      }

      // 4) TVA estimée (posée le 20 du mois suivant, calcul basé sur mois en cours)
      const mStart = iso(new Date(today.getFullYear(), today.getMonth(), 1));
      const mEnd = iso(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      let vatCollectedM = 0, vatDeductibleM = 0;
      for (const r of ((allTx.data as any[]) ?? [])) {
        if (r.date < mStart || r.date > mEnd) continue;
        const vat = Number(r.amount_ttc || 0) - Number(r.amount_ttc || 0); // no VAT amount here, use proxy
      }
      // Meilleure approche : re-query dédiée
      const { data: vatRows } = await supabase.from("finance_transactions")
        .select("kind, vat_amount, date").gte("date", mStart).lte("date", mEnd);
      for (const r of ((vatRows as any[]) ?? [])) {
        const v = Number(r.vat_amount || 0);
        if (r.kind === "sale") vatCollectedM += v;
        else if (r.kind === "expense") vatDeductibleM += v;
      }
      const vatNext = Math.max(0, vatCollectedM - vatDeductibleM);
      if (vatNext > 0) {
        const vatDay = new Date(today.getFullYear(), today.getMonth() + 1, 20);
        const vatISO = iso(vatDay);
        if (vatISO >= todayISO && vatISO <= horizonISO) {
          evs.push({ date: vatISO, amount: -vatNext, label: "TVA à payer", kind: "vat" });
        }
      }

      // 5) Frais fixes récurrents (moyenne mensuelle) → placé le 5 de chaque mois
      const sixAgo = iso(new Date(today.getFullYear(), today.getMonth() - 6, 1));
      const fixedRows = ((allTx.data as any[]) ?? []).filter((r) =>
        r.category === "frais_fixe" && r.kind === "expense" && r.date >= sixAgo && r.date < mStart);
      const monthsSeen = new Set(fixedRows.map((r) => r.date.slice(0, 7))).size || 1;
      const fixedMonthly = fixedRows.reduce((a, r) => a + Math.abs(Number(r.amount_ttc || 0)), 0) / monthsSeen;
      if (fixedMonthly > 0) {
        for (let i = 0; i <= 3; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() + i, 5);
          const di = iso(d);
          if (di < todayISO || di > horizonISO) continue;
          evs.push({ date: di, amount: -fixedMonthly, label: "Frais fixes (moyenne)", kind: "fixed" });
        }
      }

      // 6) Prévisions manuelles (finance_forecasts)
      for (const f of ((forecasts.data as any[]) ?? [])) {
        const amt = Number(f.amount_ttc || 0);
        const signed = f.kind === "in" ? amt : -Math.abs(amt);
        evs.push({ date: f.planned_date, amount: signed, label: f.label || "Prévision", kind: "forecast" });
      }

      evs.sort((a, b) => a.date.localeCompare(b.date));
      setEvents(evs);
      setLoading(false);
    })();
  }, []);

  // Build day-by-day series
  const chartData = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days: { date: string; label: string; solde: number; in: number; out: number }[] = [];
    let bal = startBalance;
    for (let i = 0; i <= 90; i++) {
      const d = addDays(today, i);
      const di = iso(d);
      const dayEvents = events.filter((e) => e.date === di);
      const inn = dayEvents.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
      const out = dayEvents.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0);
      bal += inn + out;
      days.push({ date: di, label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), solde: Math.round(bal * 100) / 100, in: inn, out: out });
    }
    return days;
  }, [events, startBalance]);

  const minSolde = useMemo(() => chartData.reduce((min, d) => d.solde < min.solde ? d : min, chartData[0] || { solde: 0, date: "", label: "" }), [chartData]);
  const finalSolde = chartData[chartData.length - 1]?.solde ?? 0;

  // Consolidated schedule 60 days
  const schedule = useMemo(() => {
    const today = iso(new Date());
    const limit = iso(addDays(new Date(), 60));
    return events.filter((e) => e.date >= today && e.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  if (loading) return <Card className="p-4 mb-6"><div className="text-sm text-muted-foreground">Chargement projection…</div></Card>;

  return (
    <>
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Projection trésorerie — 90 jours</h2>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Solde initial : <span className="font-medium text-foreground">{fmtMoney(startBalance)}</span></span>
            <span className={`font-medium ${finalSolde < 0 ? "text-red-600" : finalSolde < 500 ? "text-amber-600" : "text-emerald-600"}`}>
              À J+90 : {fmtMoney(finalSolde)}
            </span>
            {minSolde && minSolde.solde < 0 && (
              <span className="inline-flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-3 w-3" /> Solde négatif le {minSolde.label} ({fmtMoney(minSolde.solde)})
              </span>
            )}
          </div>
        </div>
        <div className="w-full h-[280px]">
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="soldeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.max(1, Math.floor(chartData.length / 10))} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${Math.round(v / 100) / 10}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                formatter={(v: any) => fmtMoney(Number(v))}
                labelFormatter={(l) => `Date : ${l}`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="solde" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#soldeGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Échéancier consolidé — 60 jours</h2>
          </div>
          <span className="text-xs text-muted-foreground">{schedule.length} évènement(s)</span>
        </div>
        {schedule.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Aucune échéance sur les 60 prochains jours.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 w-24">Date</th>
                  <th className="text-left py-2">Libellé</th>
                  <th className="text-left py-2 w-32">Catégorie</th>
                  <th className="text-right py-2 w-32">Montant</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((e, i) => {
                  const inflow = e.amount > 0;
                  const d = new Date(e.date);
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 text-xs">{d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</td>
                      <td className="py-2">{e.label}</td>
                      <td className="py-2"><KindBadge kind={e.kind} /></td>
                      <td className={`py-2 text-right font-medium ${inflow ? "text-emerald-600" : "text-red-600"}`}>
                        {inflow ? "+" : ""}{fmtMoney(e.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function KindBadge({ kind }: { kind: Event["kind"] }) {
  const map: Record<Event["kind"], { label: string; cls: string }> = {
    receivable: { label: "Encours client", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    invoice: { label: "Facture", cls: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    supplier: { label: "Loyer/Fournisseur", cls: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400" },
    credit: { label: "Crédit", cls: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400" },
    vat: { label: "TVA", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    fixed: { label: "Frais fixes", cls: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-400" },
    forecast: { label: "Prévision", cls: "border-primary/40 bg-primary/10 text-primary" },
  };
  const m = map[kind];
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
}