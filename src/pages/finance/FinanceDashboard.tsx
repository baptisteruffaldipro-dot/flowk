import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, Percent, PiggyBank, AlertTriangle, ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";

type Stats = {
  bankBalance: number | null;
  bankAsOf: string | null;
  reservePct: number;
  upcomingIn: number;
  upcomingOut: number;
  vatDue: number;
  vatNextMonth: number;
  vatNextMonthLabel: string;
  caMonth: { presta: number; achat: number };
  caYear: { presta: number; achat: number };
  expensesMonth: number;
  fixedMonthly: number;
  ccDirigeant: number;
  financingNextMonth: number;
  soldeRequisNext: number;
  margin: number;
  alerts: string[];
};

export default function FinanceDashboard() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const yStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const nextMonthLabel = nextMonthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      const [bank, tx, vat, forecasts, financings, allTx] = await Promise.all([
        supabase.from("bank_balances").select("amount, as_of_date").order("as_of_date", { ascending: false }).limit(1),
        supabase.from("finance_transactions").select("kind, category, amount_ht, amount_ttc, vat_amount, date, due_date, paid_date").gte("date", yStart),
        supabase.from("vat_adjustments").select("adjustment, reserve_pct").order("period_month", { ascending: false }).limit(1),
        supabase.from("finance_forecasts").select("amount_ttc, planned_date, kind").gte("planned_date", now.toISOString().slice(0, 10)).lte("planned_date", in30),
        (supabase as any).from("finance_financings").select("*").eq("active", true),
        supabase.from("finance_transactions").select("kind, category, amount_ht, amount_ttc, vat_amount, date"),
      ]);

      const bankAmt = bank.data?.[0]?.amount ?? null;
      const bankDate = bank.data?.[0]?.as_of_date ?? null;
      const reservePct = Number(vat.data?.[0]?.reserve_pct ?? 0);
      const rows = (tx.data as any[]) ?? [];

      const isMonth = (d: string) => d && d >= mStart;
      const isThisMonth = (d: string) => d && d >= mStart && d <= mEnd;
      const caYear = { presta: 0, achat: 0 };
      const caMonth = { presta: 0, achat: 0 };
      let vatCollected = 0, vatDeductible = 0, expensesMonth = 0;
      let vatCollectedMonth = 0, vatDeductibleMonth = 0;
      let upcomingIn = 0, upcomingOut = 0;

      for (const r of rows) {
        const ht = Number(r.amount_ht) || 0;
        const tva = Number(r.vat_amount) || 0;
        const ttc = Number(r.amount_ttc) || 0;
        if (r.kind === "sale") {
          const bucket = r.category === "achat_revente" ? "achat" : "presta";
          caYear[bucket] += ht;
          if (isMonth(r.date)) caMonth[bucket] += ht;
          vatCollected += tva;
          if (isThisMonth(r.date)) vatCollectedMonth += tva;
          if (!r.paid_date && r.due_date && r.due_date <= in30) upcomingIn += ttc;
        } else if (r.kind === "expense") {
          if (isMonth(r.date)) expensesMonth += ht;
          vatDeductible += tva;
          if (isThisMonth(r.date)) vatDeductibleMonth += tva;
          if (!r.paid_date && r.due_date && r.due_date <= in30) upcomingOut += ttc;
        }
      }

      const vatNet = Math.max(0, vatCollected - vatDeductible + Number(vat.data?.[0]?.adjustment ?? 0));
      const vatNextMonth = Math.max(0, vatCollectedMonth - vatDeductibleMonth);

      // Frais fixes : moyenne mensuelle sur les 6 derniers mois complets
      const allRows = (allTx.data as any[]) ?? [];
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().slice(0, 10);
      const fixedRows = allRows.filter((r) => r.category === "frais_fixe" && r.kind === "expense" && r.date >= sixAgo && r.date < mStart);
      const fixedSum = fixedRows.reduce((a, r) => a + Number(r.amount_ttc || 0), 0);
      const months = Math.max(1, Math.min(6, new Set(fixedRows.map((r) => r.date.slice(0, 7))).size));
      const fixedMonthly = months > 0 ? fixedSum / months : 0;

      // Compte courant dirigeant : apports − retraits (bank flows signés)
      const ccDirigeant = allRows
        .filter((r) => r.category === "apport_perso" || r.category === "retrait_perso")
        .reduce((a, r) => a + Number(r.amount_ttc || 0), 0);

      const forecastOut = (forecasts.data ?? []).reduce((a: number, x: any) => a + Number(x.amount_ttc || 0), 0);
      // Financing impact on next 30 days: incoming principals + outgoing monthly repayments
      let financingIn = 0, financingOut = 0, financingNextMonth = 0;
      const in30ISO = in30;
      const nmStartISO = nextMonthStart.toISOString().slice(0, 10);
      const nmEndISO = nextMonthEnd.toISOString().slice(0, 10);
      for (const f of (financings.data ?? []) as any[]) {
        if (f.received_date > now.toISOString().slice(0, 10) && f.received_date <= in30ISO) {
          financingIn += Number(f.principal_amount || 0);
        }
        if (Number(f.monthly_payment) > 0 && f.first_payment_date && f.remaining_installments > 0) {
          const first = new Date(f.first_payment_date);
          for (let i = 0; i < f.remaining_installments; i++) {
            const d = new Date(first); d.setMonth(d.getMonth() + i);
            const iso = d.toISOString().slice(0, 10);
            if (iso > now.toISOString().slice(0, 10) && iso <= in30ISO) financingOut += Number(f.monthly_payment);
            if (iso >= nmStartISO && iso <= nmEndISO) financingNextMonth += Number(f.monthly_payment);
          }
        }
      }

      const soldeRequisNext = fixedMonthly + vatNextMonth + financingNextMonth;

      const alerts: string[] = [];
      if (bankAmt != null && bankAmt - (reservePct / 100) * vatNet - upcomingOut - forecastOut - financingOut + financingIn < 0) alerts.push("Trésorerie tendue sur 30 jours");
      if (vatNet > 3000) alerts.push(`TVA importante à provisionner : ${fmtMoney(vatNet)}`);
      if (bankAmt != null && bankAmt < soldeRequisNext) alerts.push(`Solde insuffisant pour couvrir ${nextMonthLabel} (besoin ${fmtMoney(soldeRequisNext)})`);

      setS({
        bankBalance: bankAmt,
        bankAsOf: bankDate,
        reservePct,
        upcomingIn: upcomingIn + financingIn,
        upcomingOut: upcomingOut + forecastOut + financingOut,
        vatDue: vatNet,
        vatNextMonth,
        vatNextMonthLabel: nextMonthLabel,
        caMonth,
        caYear,
        expensesMonth,
        fixedMonthly,
        ccDirigeant,
        financingNextMonth,
        soldeRequisNext,
        margin: caMonth.presta + caMonth.achat - expensesMonth,
        alerts,
      });
    })();
  }, []);

  if (!s) return <div className="p-6 md:p-8">Chargement…</div>;

  const dispo = (s.bankBalance ?? 0) - (s.reservePct / 100) * s.vatDue - s.upcomingOut;
  const detteDirigeant = Math.max(0, s.ccDirigeant);
  const dispoApresCC = dispo - detteDirigeant;

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Finance & pilotage" description="Vision claire de la santé financière — alimentée par tes imports Tiime." />
      <FinanceNav />
      {s.alerts.length > 0 && (
        <Card className="p-4 mb-4 border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div><div className="font-medium mb-1">Alertes</div><ul className="list-disc ml-5 space-y-0.5 text-muted-foreground">{s.alerts.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
          </div>
        </Card>
      )}

      {/* Projection mois prochain */}
      <Card className="p-4 mb-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Projection — {s.vatNextMonthLabel}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label={`TVA à payer (mois en cours)`} value={fmtMoney(s.vatNextMonth)} hint="collectée − déductible du mois" />
          <MiniStat label="Frais fixes mensuels (moy. 6 mois)" value={fmtMoney(s.fixedMonthly)} hint="catégorie « Frais fixe »" />
          <MiniStat label="Remboursements crédits" value={fmtMoney(s.financingNextMonth)} hint="mensualités actives" />
          <MiniStat label="Solde requis mois prochain" value={fmtMoney(s.soldeRequisNext)} accent={(s.bankBalance ?? 0) < s.soldeRequisNext ? "text-red-600" : "text-emerald-600"} hint="TVA + frais fixes + crédits" />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Wallet} label="Solde bancaire" value={fmtMoney(s.bankBalance ?? 0)} hint={s.bankAsOf ? `au ${s.bankAsOf}` : "aucun import"} />
        <KPI icon={PiggyBank} label="Argent réellement disponible" value={fmtMoney(dispo)} hint={`réserve TVA ${s.reservePct}%`} accent={dispo < 0 ? "text-red-600" : dispo < 500 ? "text-amber-600" : "text-emerald-600"} />
        <KPI icon={PiggyBank} label="Dispo après remb. compte courant" value={fmtMoney(dispoApresCC)} hint={detteDirigeant > 0 ? `dette dirigeant : ${fmtMoney(detteDirigeant)}` : "aucune dette dirigeant"} accent={dispoApresCC < 0 ? "text-red-600" : dispoApresCC < 500 ? "text-amber-600" : "text-emerald-600"} />
        <KPI icon={ArrowUpRight} label="Encaissements 30j" value={fmtMoney(s.upcomingIn)} accent="text-emerald-600" />
        <KPI icon={ArrowDownRight} label="Paiements 30j" value={fmtMoney(s.upcomingOut)} accent="text-red-600" />
        <KPI icon={Percent} label="TVA estimée à payer" value={fmtMoney(s.vatDue)} />
        <KPI icon={TrendingUp} label="CA du mois (presta)" value={fmtMoney(s.caMonth.presta)} />
        <KPI icon={TrendingUp} label="CA du mois (achat/revente)" value={fmtMoney(s.caMonth.achat)} />
        <KPI icon={TrendingDown} label="Dépenses du mois" value={fmtMoney(s.expensesMonth)} />
        <KPI icon={Sparkles} label="CA année (presta)" value={fmtMoney(s.caYear.presta)} />
        <KPI icon={Sparkles} label="CA année (achat/revente)" value={fmtMoney(s.caYear.achat)} />
        <KPI icon={TrendingUp} label="Résultat mois (estimé)" value={fmtMoney(s.margin)} accent={s.margin < 0 ? "text-red-600" : "text-emerald-600"} />
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={`text-xl font-semibold ${accent ?? ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

function MiniStat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${accent ?? ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}