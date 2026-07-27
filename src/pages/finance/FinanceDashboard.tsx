import { Fragment, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, Percent, PiggyBank, AlertTriangle, ArrowUpRight, ArrowDownRight, Sparkles, CalendarClock, Users, Banknote } from "lucide-react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import CashflowProjection from "@/components/finance/CashflowProjection";

type Stats = {
  bankBalance: number | null;
  bankAsOf: string | null;
  reservePct: number;
  vatDue: number;
  currentMonthLabel: string;
  nextMonthLabel: string;
  // Mois en cours
  caMonth: { presta: number; achat: number };
  expensesMonth: number;
  fixedThisMonth: number;
  vatCurrentMonth: number;
  marginMonth: number;
  upcomingIn: number;
  upcomingOut: number;
  // Estimation mois prochain
  caNextEst: number;
  expensesNextEst: number;
  vatNextMonth: number;
  financingNextMonth: number;
  soldeRequisNext: number;
  soldeFinNextEst: number;
  // Contextuel
  caYear: { presta: number; achat: number };
  fixedMonthly: number;
  ccDirigeant: number;
  supplierDebt: number;
  supplierDebts: { label: string; remaining: number; monthly: number; installments: number }[];
  alerts: string[];
  receivables: { id: string; client: string; invoiced: number; paid: number; outstanding: number; status: string; expected_payment_date: string | null }[];
  receivablesTotal: number;
};

export default function FinanceDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [newClientId, setNewClientId] = useState<string>("");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newDue, setNewDue] = useState<string>("");
  const [partialId, setPartialId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      setClientsList((data as any) ?? []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const yStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const currentMonthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const nextMonthLabel = nextMonthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      const [bank, tx, vat, forecasts, financings, allTx, receivables] = await Promise.all([
        supabase
          .from("bank_balances")
          .select("amount, as_of_date")
          .lte("as_of_date", now.toISOString().slice(0, 10))
          .order("as_of_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("finance_transactions").select("kind, category, amount_ht, amount_ht_presta, amount_ht_achat, split_reviewed, amount_ttc, vat_amount, date, due_date, paid_date").gte("date", yStart),
        supabase.from("vat_adjustments").select("adjustment, reserve_pct").order("period_month", { ascending: false }).limit(1),
        supabase.from("finance_forecasts").select("amount_ttc, planned_date, kind").gte("planned_date", now.toISOString().slice(0, 10)).lte("planned_date", in30),
        (supabase as any).from("finance_financings").select("*").eq("active", true),
        supabase.from("finance_transactions").select("kind, category, amount_ht, amount_ht_presta, amount_ht_achat, split_reviewed, amount_ttc, vat_amount, date"),
        (supabase as any)
          .from("client_receivables")
          .select("id, snapshot_date, invoiced_ttc, paid_ttc, outstanding_ttc, status, expected_payment_date, clients(name)")
          .order("snapshot_date", { ascending: false }),
      ]);

      const bankAmt = bank.data?.[0]?.amount ?? null;
      const bankDate = bank.data?.[0]?.as_of_date ?? null;
      const today = now.toISOString().slice(0, 10);

      // Balance actualisée au jour même : dernier relevé + mouvements bancaires postérieurs
      // (on n'utilise que les lignes de relevé bancaire pour éviter le double comptage
      // avec les factures/achats déjà passés en banque)
      let bankAmtToday: number | null = bankAmt;
      if (bankAmt !== null && bankDate && bankDate < today) {
        const { data: moves } = await supabase
          .from("finance_transactions")
          .select("amount_ttc, date")
          .eq("kind", "bank")
          .gt("date", bankDate)
          .lte("date", today);
        let delta = 0;
        for (const m of (moves as any[]) ?? []) {
          delta += Number(m.amount_ttc) || 0;
        }
        bankAmtToday = Number(bankAmt) + delta;
      }
      const reservePct = Number(vat.data?.[0]?.reserve_pct ?? 0);
      const rows = (tx.data as any[]) ?? [];

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
          // Si la ligne a une répartition validée, on ventile ; sinon on retombe sur la catégorie.
          if (r.split_reviewed) {
            const p = Number(r.amount_ht_presta) || 0;
            const a = Number(r.amount_ht_achat) || 0;
            caYear.presta += p;
            caYear.achat += a;
            if (isThisMonth(r.date)) { caMonth.presta += p; caMonth.achat += a; }
          } else {
            const bucket = r.category === "achat_revente" ? "achat" : "presta";
            caYear[bucket] += ht;
            if (isThisMonth(r.date)) caMonth[bucket] += ht;
          }
          vatCollected += tva;
          if (isThisMonth(r.date)) vatCollectedMonth += tva;
          if (!r.paid_date && r.due_date && r.due_date <= in30) upcomingIn += ttc;
        } else if (r.kind === "expense") {
          if (isThisMonth(r.date)) expensesMonth += ht;
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

      // Frais fixes déjà passés ce mois-ci
      const fixedThisMonth = allRows
        .filter((r) => r.category === "frais_fixe" && r.kind === "expense" && r.date >= mStart && r.date <= mEnd)
        .reduce((a, r) => a + Math.abs(Number(r.amount_ttc || 0)), 0);

      // Estimation mois prochain : moyenne CA facturé × ratio d'encaissement réel sur 3 mois
      const threeAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
      const past3SalesAll = allRows.filter((r) => r.kind === "sale" && r.date >= threeAgo && r.date < mStart);
      const past3Exp = allRows.filter((r) => r.kind === "expense" && r.date >= threeAgo && r.date < mStart);
      const salesMonths = Math.max(1, new Set(past3SalesAll.map((r) => (r.date as string).slice(0, 7))).size);
      const expMonths = Math.max(1, new Set(past3Exp.map((r) => r.date.slice(0, 7))).size);
      const invoicedHt = past3SalesAll.reduce((a, r) => a + Number(r.amount_ht || 0), 0);
      const invoicedTtc = past3SalesAll.reduce((a, r) => a + Number(r.amount_ttc || 0), 0);
      const paidTtc = past3SalesAll.filter((r) => !!r.paid_date).reduce((a, r) => a + Number(r.amount_ttc || 0), 0);
      const collectionRatio = invoicedTtc > 0 ? Math.min(1, paidTtc / invoicedTtc) : 1;
      const caNextEst = (invoicedHt / salesMonths) * collectionRatio;
      const expensesNextEst = Math.max(
        fixedMonthly,
        past3Exp.reduce((a, r) => a + Number(r.amount_ht || 0), 0) / expMonths,
      );

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
        // On ignore les dettes fournisseurs (kind='other') : elles sont déjà
        // agrégées dans "Dettes fournisseurs" et souvent dans les frais fixes.
        if (f.kind === "other") continue;
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

      // Dettes fournisseurs (kind='other' → loyers, factures en retard, etc.)
      const supplierDebts = ((financings.data ?? []) as any[])
        .filter((f) => f.kind === "other" && Number(f.remaining_installments) > 0)
        .map((f) => ({
          label: f.label as string,
          remaining: Number(f.monthly_payment) * Number(f.remaining_installments),
          monthly: Number(f.monthly_payment),
          installments: Number(f.remaining_installments),
        }));
      const supplierDebt = supplierDebts.reduce((a, d) => a + d.remaining, 0);

      // Mensualité loyer/fournisseur du mois prochain (au moins 1 échéance si dette ouverte)
      const supplierNextMonth = ((financings.data ?? []) as any[])
        .filter((f) => f.kind === "other" && Number(f.remaining_installments) > 0)
        .reduce((a, f) => a + Number(f.monthly_payment || 0), 0);
      const soldeRequisNext = fixedMonthly + vatNextMonth + financingNextMonth + supplierNextMonth;
      const soldeFinNextEst = (bankAmt ?? 0) + caNextEst - expensesNextEst - vatNextMonth - financingNextMonth - supplierNextMonth;

      // Encours clients (dernier snapshot par client)
      const seen = new Set<string>();
      const recRows: any[] = (receivables.data as any[]) ?? [];
      const latestPerClient = recRows.filter((r) => {
        const name = r.clients?.name || "—";
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
      const recList = latestPerClient
        .map((r) => ({
          id: r.id,
          client: r.clients?.name || "—",
          invoiced: Number(r.invoiced_ttc || 0),
          paid: Number(r.paid_ttc || 0),
          outstanding: Number(r.outstanding_ttc || 0),
          status: r.status || "en_retard",
          expected_payment_date: r.expected_payment_date || null,
        }))
        .filter((r) => r.outstanding > 0 && r.status !== "paye")
        .sort((a, b) => b.outstanding - a.outstanding);
      const receivablesTotal = recList.reduce((a, r) => a + r.outstanding, 0);

      const alerts: string[] = [];
      if (receivablesTotal > 0) alerts.push(`Encours clients en retard : ${fmtMoney(receivablesTotal)}`);
      if (bankAmt != null && bankAmt - (reservePct / 100) * vatNet - upcomingOut - forecastOut - financingOut + financingIn < 0) alerts.push("Trésorerie tendue sur 30 jours");
      if (vatNet > 3000) alerts.push(`TVA importante à provisionner : ${fmtMoney(vatNet)}`);
      if (bankAmt != null && bankAmt < soldeRequisNext) alerts.push(`Solde insuffisant pour couvrir ${nextMonthLabel} (besoin ${fmtMoney(soldeRequisNext)})`);
      for (const d of supplierDebts) {
        if (d.installments >= 2) alerts.push(`${d.label} — ${d.installments} échéances en retard (${fmtMoney(d.remaining)})`);
      }

      setS({
        bankBalance: bankAmtToday,
        bankAsOf: today,
        reservePct,
        vatDue: vatNet,
        currentMonthLabel,
        nextMonthLabel,
        caMonth,
        expensesMonth,
        fixedThisMonth,
        vatCurrentMonth: vatNextMonth,
        marginMonth: caMonth.presta + caMonth.achat - expensesMonth,
        upcomingIn: upcomingIn + financingIn,
        upcomingOut: upcomingOut + forecastOut + financingOut,
        caNextEst,
        expensesNextEst,
        vatNextMonth,
        financingNextMonth,
        soldeRequisNext,
        soldeFinNextEst,
        caYear,
        fixedMonthly,
        ccDirigeant,
        supplierDebt,
        supplierDebts,
        alerts,
        receivables: recList,
        receivablesTotal,
      });
    })();
  }, [reloadTick]);

  async function updateReceivable(id: string, patch: Record<string, any>) {
    const { error } = await (supabase as any).from("client_receivables").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Mis à jour");
    setReloadTick((t) => t + 1);
  }

  async function deleteReceivable(id: string) {
    return deleteReceivableImpl(id);
  }

  async function registerPartialPayment(r: { id: string; invoiced: number; paid: number; outstanding: number }) {
    const amt = Number(partialAmount.replace(",", "."));
    if (!amt || amt <= 0) return toast.error("Montant invalide");
    if (amt > r.outstanding + 0.001) return toast.error("Montant supérieur au reste dû");
    const newPaid = Number((r.paid + amt).toFixed(2));
    const newOutstanding = Number((r.outstanding - amt).toFixed(2));
    await updateReceivable(r.id, {
      paid_ttc: newPaid,
      outstanding_ttc: newOutstanding,
      status: newOutstanding <= 0.009 ? "paye" : "partiel",
    });
    setPartialId(null);
    setPartialAmount("");
  }

  async function deleteReceivableImpl(id: string) {
    if (!confirm("Supprimer cette dette client ?")) return;
    const { error } = await (supabase as any).from("client_receivables").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dette supprimée");
    setReloadTick((t) => t + 1);
  }

  async function addReceivable() {
    const amt = Number(newAmount);
    if (!newClientId) return toast.error("Sélectionne un client");
    if (!amt || amt <= 0) return toast.error("Montant invalide");
    const { error } = await (supabase as any).from("client_receivables").insert({
      client_id: newClientId,
      invoiced_ttc: amt,
      paid_ttc: 0,
      outstanding_ttc: amt,
      expected_payment_date: newDue || null,
      status: newDue ? "a_venir" : "en_retard",
      snapshot_date: new Date().toISOString().slice(0, 10),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Dette ajoutée");
    setNewClientId(""); setNewAmount(""); setNewDue(""); setAddOpen(false);
    setReloadTick((t) => t + 1);
  }

  if (!s) return <div className="p-6 md:p-8">Chargement…</div>;

  // Provision TVA : si réserve à 0 %, on provisionne quand même la prochaine TVA
  const vatProvision = s.reservePct > 0 ? (s.reservePct / 100) * s.vatDue : s.vatNextMonth;
  const dispo = (s.bankBalance ?? 0) - vatProvision - s.upcomingOut;
  const detteDirigeant = Math.max(0, s.ccDirigeant);
  const detteTotale = detteDirigeant + s.supplierDebt;
  const dispoApresCC = dispo - detteDirigeant - s.supplierDebt;

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

      {/* Vue transverse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI icon={Wallet} label="Solde bancaire" value={fmtMoney(s.bankBalance ?? 0)} hint={s.bankAsOf ? `au ${s.bankAsOf}` : "aucun import"} />
        <KPI icon={PiggyBank} label="Argent réellement disponible" value={fmtMoney(dispo)} hint={s.reservePct > 0 ? `réserve TVA ${s.reservePct}%` : `TVA prochaine provisionnée (${fmtMoney(s.vatNextMonth)})`} accent={dispo < 0 ? "text-red-600" : dispo < 500 ? "text-amber-600" : "text-emerald-600"} />
        <KPI icon={PiggyBank} label="Dispo après remboursement total" value={fmtMoney(dispoApresCC)} hint={`− ${fmtMoney(detteDirigeant)} compte courant − ${fmtMoney(s.supplierDebt)} fournisseurs`} accent={dispoApresCC < 0 ? "text-red-600" : dispoApresCC < 500 ? "text-amber-600" : "text-emerald-600"} />
        <KPI icon={Percent} label="Prochaine TVA estimée à payer" value={fmtMoney(s.vatNextMonth)} hint="mois prochain" />
        <KPI icon={Banknote} label="Dette en cours" value={fmtMoney(detteTotale)} hint={`${fmtMoney(detteDirigeant)} compte courant + ${fmtMoney(s.supplierDebt)} fournisseurs`} accent={detteTotale > 0 ? "text-red-600" : "text-emerald-600"} />
        <KPI icon={Users} label="Encours clients" value={fmtMoney(s.receivablesTotal)} hint={`${s.receivables.length} client(s) en retard`} accent={s.receivablesTotal > 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      {/* Encours clients */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Dettes clients — encours</h2>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
          </Button>
        </div>

        {addOpen && (
          <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-md border bg-secondary/30">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs text-muted-foreground">Client</label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Montant dû (TTC)</label>
              <Input type="number" step="0.01" className="h-9 w-32" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Paiement prévu</label>
              <Input type="date" className="h-9 w-[150px]" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            </div>
            <Button size="sm" onClick={addReceivable}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
          </div>
        )}

        {s.receivables.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Aucune dette client en cours.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Client</th>
                  <th className="text-right py-2">Montant dû</th>
                  <th className="text-right py-2">Paiement prévu</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {s.receivables.map((r) => (
                  <>
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.client}</td>
                    <td className="py-2 text-right font-semibold">
                      {fmtMoney(r.outstanding)}
                      {r.paid > 0 && (
                        <div className="text-[11px] font-normal text-muted-foreground">
                          déjà réglé {fmtMoney(r.paid)} / {fmtMoney(r.invoiced)}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Input
                        type="date"
                        className="h-8 text-xs w-[140px] ml-auto"
                        value={r.expected_payment_date || ""}
                        onChange={(e) => updateReceivable(r.id, { expected_payment_date: e.target.value || null, status: e.target.value ? "a_venir" : "en_retard" })}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setPartialId(partialId === r.id ? null : r.id); setPartialAmount(""); }}>
                          Paiement partiel
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateReceivable(r.id, { status: "paye", paid_ttc: r.invoiced, outstanding_ttc: 0 })}>
                          Marquer payé
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Supprimer" onClick={() => deleteReceivable(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {partialId === r.id && (
                    <tr key={r.id + "-partial"} className="border-b last:border-0 bg-secondary/30">
                      <td colSpan={4} className="py-2">
                        <div className="flex flex-wrap items-end justify-end gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Montant encaissé (TTC)</label>
                            <Input type="number" step="0.01" className="h-8 w-32" autoFocus value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} />
                          </div>
                          <Button size="sm" className="h-8 text-xs" onClick={() => registerPartialPayment(r)}>Enregistrer</Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPartialId(null)}>Annuler</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right text-red-600">{fmtMoney(s.receivablesTotal)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dettes fournisseurs (loyers, factures en retard, ...) */}
      {s.supplierDebts.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">Dettes fournisseurs — restant dû</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2">Libellé</th>
                  <th className="text-right py-2">Mensualité</th>
                  <th className="text-right py-2">Échéances restantes</th>
                  <th className="text-right py-2">Restant dû</th>
                </tr>
              </thead>
              <tbody>
                {s.supplierDebts.map((d) => (
                  <tr key={d.label} className="border-b last:border-0">
                    <td className="py-2 font-medium">{d.label}</td>
                    <td className="py-2 text-right">{fmtMoney(d.monthly)}</td>
                    <td className="py-2 text-right">{d.installments}</td>
                    <td className="py-2 text-right font-semibold text-red-600">{fmtMoney(d.remaining)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td></td>
                  <td></td>
                  <td className="py-2 text-right text-red-600">{fmtMoney(s.supplierDebt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mois en cours */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Mois en cours — {s.currentMonthLabel}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={TrendingUp} label="CA (presta)" value={fmtMoney(s.caMonth.presta)} />
          <KPI icon={TrendingUp} label="CA (achat/revente)" value={fmtMoney(s.caMonth.achat)} />
          <KPI icon={TrendingDown} label="Dépenses" value={fmtMoney(s.expensesMonth)} hint={`dont frais fixes : ${fmtMoney(s.fixedThisMonth)}`} />
          <KPI icon={TrendingUp} label="Résultat (estimé)" value={fmtMoney(s.marginMonth)} accent={s.marginMonth < 0 ? "text-red-600" : "text-emerald-600"} />
          <KPI icon={Percent} label="TVA du mois" value={fmtMoney(s.vatCurrentMonth)} hint="collectée − déductible" />
          <KPI icon={ArrowUpRight} label="Encaissements 30j" value={fmtMoney(s.upcomingIn)} accent="text-emerald-600" />
          <KPI icon={ArrowDownRight} label="Paiements 30j" value={fmtMoney(s.upcomingOut)} accent="text-red-600" />
          <KPI icon={Sparkles} label="CA cumulé année" value={fmtMoney(s.caYear.presta + s.caYear.achat)} hint={`presta ${fmtMoney(s.caYear.presta)}`} />
        </div>
      </div>

      {/* Estimation mois prochain */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Estimation — {s.nextMonthLabel}</h2>
          <span className="text-[11px] text-muted-foreground">basé sur la moyenne des 3 derniers mois</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI icon={TrendingUp} label="CA encaissé estimé" value={fmtMoney(s.caNextEst)} accent="text-emerald-600" hint="moyenne des ventes réellement encaissées (hors dettes clients)" />
          <KPI icon={TrendingDown} label="Dépenses estimées" value={fmtMoney(s.expensesNextEst)} hint={`frais fixes ${fmtMoney(s.fixedMonthly)}`} />
          <KPI icon={Percent} label="TVA à payer" value={fmtMoney(s.vatNextMonth)} hint="basée sur le mois en cours" />
          <KPI icon={ArrowDownRight} label="Mensualités crédits" value={fmtMoney(s.financingNextMonth)} />
          <KPI icon={AlertTriangle} label="Solde requis" value={fmtMoney(s.soldeRequisNext)} accent={(s.bankBalance ?? 0) < s.soldeRequisNext ? "text-red-600" : "text-emerald-600"} hint="frais fixes + TVA + crédits + loyer" />
          <KPI icon={Wallet} label="Solde estimé fin de mois" value={fmtMoney(s.soldeFinNextEst)} accent={s.soldeFinNextEst < 0 ? "text-red-600" : s.soldeFinNextEst < 500 ? "text-amber-600" : "text-emerald-600"} hint="solde + CA − dépenses − TVA − crédits − loyer" />
          <KPI icon={Wallet} label="Solde estimé si dettes clients réglées" value={fmtMoney(s.soldeFinNextEst + s.receivablesTotal)} accent={(s.soldeFinNextEst + s.receivablesTotal) < 0 ? "text-red-600" : (s.soldeFinNextEst + s.receivablesTotal) < 500 ? "text-amber-600" : "text-emerald-600"} hint={`+ encours clients ${fmtMoney(s.receivablesTotal)}`} />
          <KPI icon={TrendingUp} label="Résultat estimé" value={fmtMoney(s.caNextEst - s.expensesNextEst)} accent={s.caNextEst - s.expensesNextEst < 0 ? "text-red-600" : "text-emerald-600"} />
        </div>
      </div>

      <div className="mt-6">
        <CashflowProjection />
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