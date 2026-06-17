import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/format";
import { ArrowRight, CalendarClock, AlertTriangle } from "lucide-react";

type Inv = { id: string; label: string; amount: number; status: string; clients?: { name: string } | null };
type Order = { id: string; description: string; status: string; payment_status?: string; amount?: number; clients?: { name: string } | null };
type Installment = {
  id: string;
  invoice_id: string;
  label: string | null;
  amount: number;
  paid_amount: number;
  due_date: string;
  paid_at: string | null;
  invoices?: { id: string; label: string; clients?: { name: string } | null } | null;
};

export default function Revenue() {
  const [stats, setStats] = useState({ pendingRevenue: 0, paidRevenue: 0, paidPresta: 0, paidBien: 0, monthRevenue: 0, monthPresta: 0, monthBien: 0 });
  const [monthly, setMonthly] = useState<{ key: string; label: string; presta: number; bien: number; total: number }[]>([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState<Installment[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const load = async () => {
    const [i, o, paid] = await Promise.all([
      supabase.from("invoices").select("id,label,amount,status,clients(name)").neq("status", "payee").order("created_at", { ascending: false }).limit(50),
      supabase.from("print_orders").select("id,description,status,payment_status,amount,clients(name)").not("status", "in", "(livre,livre_paye)").order("created_at", { ascending: false }).limit(50),
      supabase.from("invoices").select("amount").eq("status", "payee"),
    ]);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 60);
    const ins = await supabase
      .from("invoice_installments")
      .select("id,invoice_id,label,amount,paid_amount,due_date,paid_at,invoices(id,label,clients(name))")
      .is("paid_at", null)
      .lte("due_date", horizon.toISOString().slice(0, 10))
      .order("due_date", { ascending: true })
      .limit(10);
    setUpcomingInstallments((ins.data as any) ?? []);

    const allPrint = await supabase.from("print_orders").select("amount,payment_status,status,updated_at");
    const allPrintData = (allPrint.data as any[]) ?? [];
    const paidPrintRev = allPrintData.reduce((s: number, x: any) => {
      const amt = x.amount ? Number(x.amount) : 0;
      if (x.payment_status === "regle" || x.status === "livre_paye") return s + amt;
      if (x.payment_status === "acompte_50") return s + amt * 0.5;
      return s;
    }, 0);

    const [paidInvFull, paidInstallments] = await Promise.all([
      supabase.from("invoices").select("id,amount,paid_at").eq("status", "payee"),
      supabase.from("invoice_installments").select("invoice_id,paid_amount,paid_at").not("paid_at", "is", null),
    ]);
    const invoicesWithInstallments = new Set<string>(
      ((paidInstallments.data as any[]) ?? []).map((x) => x.invoice_id),
    );
    type Entry = { date: string; amount: number; kind: "presta" | "bien" };
    const entries: Entry[] = [];
    ((paidInvFull.data as any[]) ?? []).forEach((inv) => {
      if (invoicesWithInstallments.has(inv.id)) return;
      if (!inv.paid_at) return;
      entries.push({ date: inv.paid_at, amount: Number(inv.amount ?? 0), kind: "presta" });
    });
    ((paidInstallments.data as any[]) ?? []).forEach((r) => {
      entries.push({ date: r.paid_at, amount: Number(r.paid_amount ?? 0), kind: "presta" });
    });
    allPrintData.forEach((x: any) => {
      const amt = x.amount ? Number(x.amount) : 0;
      const d = x.updated_at ? String(x.updated_at).slice(0, 10) : null;
      if (!d || amt === 0) return;
      if (x.payment_status === "regle" || x.status === "livre_paye") entries.push({ date: d, amount: amt, kind: "bien" });
      else if (x.payment_status === "acompte_50") entries.push({ date: d, amount: amt * 0.5, kind: "bien" });
    });

    const now = new Date();
    const months: { key: string; label: string; presta: number; bien: number; total: number }[] = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("fr-FR", { month: "short" }), presta: 0, bien: 0, total: 0 });
    }
    const idx = new Map(months.map((m, i) => [m.key, i] as const));
    const monthKeyOf = (iso: string) => iso.slice(0, 7);
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let monthRev = 0;
    let monthPresta = 0;
    let monthBien = 0;
    entries.forEach((e) => {
      const k = monthKeyOf(e.date);
      if (k === currentKey) {
        monthRev += e.amount;
        if (e.kind === "presta") monthPresta += e.amount; else monthBien += e.amount;
      }
      const i = idx.get(k);
      if (i !== undefined) {
        months[i].total += e.amount;
        if (e.kind === "presta") months[i].presta += e.amount; else months[i].bien += e.amount;
      }
    });
    setMonthly(months);

    setInvoices((i.data as any) ?? []);
    setOrders((o.data as any) ?? []);

    const invoicesRev = ((i.data as any) ?? []).filter((x: Inv) => x.status === "a_facturer" || x.status === "facturee").reduce((s: number, x: Inv) => s + Number(x.amount), 0);
    const printRev = ((o.data as any) ?? []).reduce((s: number, x: any) => {
      const amt = x.amount ? Number(x.amount) : 0;
      if (x.payment_status === "regle") return s;
      if (x.payment_status === "acompte_50") return s + amt * 0.5;
      return s + amt;
    }, 0);
    const pendingRev = invoicesRev + printRev;
    const paidRev = ((paid.data as any) ?? []).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0);

    setStats({
      pendingRevenue: pendingRev,
      paidRevenue: paidRev + paidPrintRev,
      paidPresta: paidRev,
      paidBien: paidPrintRev,
      monthRevenue: monthRev,
      monthPresta,
      monthBien,
    });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader title="Chiffre d'affaires" description="Suivi de ton CA, encaissements et échéances" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="CA en attente" value={fmtMoney(stats.pendingRevenue)} href="/facturation" />
        <SplitStatCard label="CA du mois" value={fmtMoney(stats.monthRevenue)} presta={stats.monthPresta} bien={stats.monthBien} />
        <SplitStatCard label="CA cumulé HT" value={fmtMoney(stats.paidRevenue)} presta={stats.paidPresta} bien={stats.paidBien} />
      </div>

      <MonthlyRevenueCard months={monthly} />

      {upcomingInstallments.length > 0 && <InstallmentsWidget items={upcomingInstallments} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Column title="Factures en attente" href="/facturation" empty="Aucune facture en attente">
          {invoices.map((inv) => (
            <Link key={inv.id} to="/facturation" className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">{inv.label}</div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{inv.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
                <span className="truncate">{inv.clients?.name ?? "—"}</span>
                <span className="tabular-nums font-medium text-foreground">{fmtMoney(inv.amount)}</span>
              </div>
            </Link>
          ))}
        </Column>
        <Column title="Impressions en attente de paiement" href="/impressions" empty="Aucune impression en attente">
          {orders.filter((o) => o.status !== "livre_paye" && o.status !== "livre").map((o) => (
            <Link key={o.id} to={`/impressions/${o.id}`} className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">{o.description}</div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{o.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
                <span className="truncate">{o.clients?.name ?? "—"}</span>
                <span className="tabular-nums font-medium text-foreground">{fmtMoney(o.amount ?? 0)}</span>
              </div>
            </Link>
          ))}
        </Column>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, highlight }: { label: string; value: string; href?: string; highlight?: boolean }) {
  const inner = (
    <Card className={`p-5 transition ${href ? "hover:bg-secondary/40 cursor-pointer" : ""} ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span>{label}</span>
        {href && <ArrowRight className="h-3 w-3 opacity-60" />}
      </div>
      <div className={`text-2xl font-semibold mt-2 ${highlight ? "text-primary" : ""}`}>{value}</div>
    </Card>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function SplitStatCard({ label, value, presta, bien }: { label: string; value: string; presta: number; bien: number }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" /> Presta {fmtMoney(presta)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Bien {fmtMoney(bien)}
        </span>
      </div>
    </Card>
  );
}

function Column({ title, href, children, empty }: { title: string; href: string; children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link to={href} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Tout voir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1">
        {isEmpty ? <div className="text-sm text-muted-foreground py-8 text-center">{empty}</div> : children}
      </div>
    </Card>
  );
}

function MonthlyRevenueCard({ months }: { months: { key: string; label: string; presta: number; bien: number; total: number }[] }) {
  if (months.length === 0) return null;
  const max = Math.max(1, ...months.map((m) => m.total));
  const cumul = months.reduce((s, m) => s + m.total, 0);
  const cumulPresta = months.reduce((s, m) => s + m.presta, 0);
  const cumulBien = months.reduce((s, m) => s + m.bien, 0);
  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">CA mensuel (HT)</h2>
          <p className="text-xs text-muted-foreground">6 derniers mois · cumul {fmtMoney(cumul)}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary" /> Presta {fmtMoney(cumulPresta)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> Bien {fmtMoney(cumulBien)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-3 items-end h-32">
        {months.map((m, i) => {
          const isCurrent = i === months.length - 1;
          const totalH = Math.max(4, Math.round((m.total / max) * 100));
          const prestaH = m.total > 0 ? Math.round((m.presta / m.total) * totalH) : 0;
          const bienH = Math.max(0, totalH - prestaH);
          return (
            <div key={m.key} className="flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="text-[10px] tabular-nums text-muted-foreground">{fmtMoney(m.total)}</div>
              <div className="w-full flex flex-col justify-end" style={{ height: `${totalH}%` }}>
                {bienH > 0 && (
                  <div
                    className={`w-full rounded-t-md transition-all ${isCurrent ? "bg-amber-500" : "bg-amber-500/40"}`}
                    style={{ height: `${(bienH / totalH) * 100}%` }}
                  />
                )}
                {prestaH > 0 && (
                  <div
                    className={`w-full transition-all ${bienH === 0 ? "rounded-t-md" : ""} ${isCurrent ? "bg-primary" : "bg-primary/30"}`}
                    style={{ height: `${(prestaH / totalH) * 100}%` }}
                  />
                )}
                {prestaH === 0 && bienH === 0 && (
                  <div className="w-full rounded-t-md bg-muted" style={{ height: "100%" }} />
                )}
              </div>
              <div className={`text-[10px] uppercase tracking-wider ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function InstallmentsWidget({ items }: { items: Installment[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((x) => x.due_date < today);
  const upcoming = items.filter((x) => x.due_date >= today);
  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Prochaines échéances</h2>
          {overdue.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">{overdue.length} en retard</Badge>
          )}
        </div>
        <Link to="/facturation" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Facturation <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[...overdue, ...upcoming].slice(0, 8).map((x) => {
          const isOverdue = x.due_date < today;
          const remaining = Number(x.amount) - Number(x.paid_amount);
          const d = new Date(x.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
          return (
            <Link
              key={x.id}
              to="/facturation"
              className={`block p-3 rounded-md border bg-card hover:bg-secondary/60 transition ${isOverdue ? "border-destructive/40" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">
                  {x.invoices?.label ?? "Facture"}
                  {x.label && <span className="text-muted-foreground font-normal"> · {x.label}</span>}
                </div>
                <Badge variant={isOverdue ? "destructive" : "outline"} className="shrink-0 text-[10px]">{d}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
                <span className="truncate">{x.invoices?.clients?.name ?? "—"}</span>
                <span className="tabular-nums font-medium text-foreground">{fmtMoney(remaining)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
