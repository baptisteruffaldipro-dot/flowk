import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtMoney, STATUS_LABEL, PRINT_STATUS_LABEL, PROJECT_TYPE_LABEL } from "@/lib/format";
import { ArrowRight, Sun, AlertTriangle, Calendar, Video, MapPin, Phone, CalendarDays, Printer, FolderKanban, CalendarClock, UserPlus, Target } from "lucide-react";
import QuickCreate from "@/components/QuickCreate";
import WeekAgenda from "@/components/WeekAgenda";

type Task = { id: string; title: string; status: string; deadline: string | null; clients?: { name: string } | null };
type Order = { id: string; description: string; status: string; clients?: { name: string } | null };
type Inv = { id: string; label: string; amount: number; status: string; clients?: { name: string } | null };
type Appt = { id: string; title: string; start_at: string; type: string; location: string | null; clients?: { name: string } | null };
type Project = { id: string; name: string; type: string; clients?: { name: string } | null };
type Lead = { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; source: string | null; created_at: string };
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

const APPT_TYPE_ICON: Record<string, any> = { visio: Video, presentiel: MapPin, telephone: Phone, autre: CalendarDays };

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState<Installment[]>([]);
  const [stats, setStats] = useState({ todoCount: 0, doneCount: 0, totalCount: 0, pendingRevenue: 0, paidRevenue: 0, paidPresta: 0, paidBien: 0, monthRevenue: 0, monthPresta: 0, monthBien: 0, awaitingBat: 0 });
  const [monthly, setMonthly] = useState<{ key: string; label: string; presta: number; bien: number; total: number }[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [goalProgressMap, setGoalProgressMap] = useState<Record<string, { done: number; total: number }>>({});

  const load = async () => {
      const [t, todayT, o, i, a, paid, p, batsRelecture, l] = await Promise.all([
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").not("status", "in", "(envoye,archive)").order("deadline", { ascending: true, nullsFirst: false }).limit(50),
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").eq("status", "aujourdhui" as any),
        supabase.from("print_orders").select("id,description,status,payment_status,amount,clients(name)").not("status", "in", "(livre,livre_paye)").order("created_at", { ascending: false }).limit(50),
        supabase.from("invoices").select("id,label,amount,status,clients(name)").neq("status", "payee").order("created_at", { ascending: false }).limit(50),
        supabase.from("appointments").select("id,title,start_at,type,location,clients(name)").gte("start_at", new Date().toISOString()).neq("status", "annule").order("start_at", { ascending: true }).limit(8),
        supabase.from("invoices").select("amount").eq("status", "payee"),
        supabase.from("projects").select("id,name,type,clients(name)").eq("archived", false).order("updated_at", { ascending: false }).limit(8),
        supabase.from("bats").select("id").eq("status", "en_relecture" as any),
        supabase.from("leads").select("id,name,email,phone,company,source,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(8),
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

      // ---- Mensualisation du CA (basé sur paid_at) ----
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
        if (invoicesWithInstallments.has(inv.id)) return; // évite double-comptage
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
      // Merge today tasks that might have been cut off by the limit
      const allTasks = (t.data as any) ?? [];
      const todayTasks = (todayT.data as any) ?? [];
      const taskIds = new Set(allTasks.map((x: any) => x.id));
      const merged = [...allTasks, ...todayTasks.filter((x: any) => !taskIds.has(x.id))];
      setTasks(merged);
      setOrders((o.data as any) ?? []);
      setInvoices((i.data as any) ?? []);
      setAppointments((a.data as any) ?? []);
      setProjects((p.data as any) ?? []);
      setLeads((l.data as any) ?? []);

      // Compteurs globaux pour la barre de progression
      const allTasksRes = await supabase.from("tasks").select("status", { count: "exact" });
      const all = (allTasksRes.data as any) ?? [];
      const totalCount = all.filter((x: any) => x.status !== "archive").length;
      const doneCount = all.filter((x: any) => x.status === "envoye" || x.status === "a_facturer").length;
      const todoCount = totalCount - doneCount;
      const invoicesRev = ((i.data as any) ?? []).filter((x: Inv) => x.status === "a_facturer" || x.status === "facturee").reduce((s: number, x: Inv) => s + Number(x.amount), 0);
      const printRev = ((o.data as any) ?? []).reduce((s: number, x: any) => {
        const amt = x.amount ? Number(x.amount) : 0;
        if (x.payment_status === "regle") return s;
        if (x.payment_status === "acompte_50") return s + amt * 0.5;
        return s + amt;
      }, 0);
      const pendingRev = invoicesRev + printRev;
      const paidRev = ((paid.data as any) ?? []).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0);
      const awaitPrintBat = ((o.data as any) ?? []).filter((x: Order) => x.status === "validation_bat").length;
      const awaitBatRows = ((batsRelecture.data as any) ?? []).length;
      const awaitBat = awaitPrintBat + awaitBatRows;
      setStats({ todoCount, doneCount, totalCount, pendingRevenue: pendingRev, paidRevenue: paidRev + paidPrintRev, paidPresta: paidRev, paidBien: paidPrintRev, monthRevenue: monthRev, monthPresta, monthBien, awaitingBat: awaitBat });
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Dashboard" description="Vue d'ensemble de ton activité" />

      <div className="mb-6">
        <QuickCreate onCreated={load} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <ProgressStatCard
          label="Tâches à faire"
          value={stats.todoCount}
          done={stats.doneCount}
          total={stats.totalCount}
        />
        <StatCard label="CA en attente" value={fmtMoney(stats.pendingRevenue)} />
        <SplitStatCard label="CA du mois" value={fmtMoney(stats.monthRevenue)} presta={stats.monthPresta} bien={stats.monthBien} />
        <SplitStatCard label="CA cumulé HT" value={fmtMoney(stats.paidRevenue)} presta={stats.paidPresta} bien={stats.paidBien} />
        <StatCard label="BAT à valider" value={String(stats.awaitingBat)} href="/bats" highlight={stats.awaitingBat > 0} />
      </div>

      <MonthlyRevenueCard months={monthly} />

      <TodayBoard tasks={tasks} printOrders={orders} />

      {upcomingInstallments.length > 0 && <InstallmentsWidget items={upcomingInstallments} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Column title="Nouveaux leads" href="/leads" empty="Aucun nouveau lead">
          {leads.map((lead) => {
            const dateStr = new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
            return (
              <Link key={lead.id} to={`/leads`} className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug truncate inline-flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {lead.name || lead.email || lead.phone || "Nouveau lead"}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400">Nouveau</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {lead.company ? `${lead.company} · ` : ""}{lead.source ?? "—"} · {dateStr}
                </div>
              </Link>
            );
          })}
        </Column>

        <Column title="Projets en cours" href="/projets" empty="Aucun projet en cours">
          {projects.slice(0, 8).map((p) => (
            <Link key={p.id} to={`/projets/${p.id}`} className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate inline-flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {p.name}
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{PROJECT_TYPE_LABEL[p.type] ?? p.type}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{p.clients?.name ?? "—"}</div>
            </Link>
          ))}
        </Column>

        <Column title="Impressions en cours" href="/impressions" empty="Aucune commande en cours">
          {orders.slice(0, 8).map((o) => (
            <Link key={o.id} to={`/impressions/${o.id}`} className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug truncate">{o.description}</div>
                <Badge variant="outline" className={`shrink-0 text-[10px] ${printStatusBadgeClass(o.status)}`}>{PRINT_STATUS_LABEL[o.status]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{o.clients?.name ?? "—"}</div>
            </Link>
          ))}
        </Column>

        <Column title="Prochains rendez-vous" href="/rdv" empty="Aucun rendez-vous à venir">
          {appointments.map((a) => {
            const Icon = APPT_TYPE_ICON[a.type] ?? CalendarDays;
            const dt = new Date(a.start_at);
            const dateStr = dt.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
            const timeStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const soon = isApptSoon(dt);
            return (
              <Link key={a.id} to="/rdv" className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug truncate">{a.title}</div>
                  <Badge variant="outline" className={`shrink-0 text-[10px] inline-flex items-center gap-1 ${soon ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" : ""}`}>
                    <Icon className="h-2.5 w-2.5" /> {timeStr}
                  </Badge>
                </div>
                <div className={`text-xs mt-1 truncate ${soon ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                  {dateStr} · {a.clients?.name ?? "—"}
                </div>
              </Link>
            );
          })}
        </Column>
      </div>

      <div className="mt-8">
        <WeekAgenda />
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

function ProgressStatCard({ label, value, done, total }: { label: string; value: number; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline justify-between mt-2 mb-3">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {done}/{total} terminées · {pct}%
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </Card>
  );
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

function TodayBoard({ tasks, printOrders }: { tasks: Task[]; printOrders: Order[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (t: Task) => t.status === "aujourdhui" || t.deadline === today;
  const isOverdue = (t: Task) => !!t.deadline && t.deadline < today && !["envoye", "a_facturer", "facture_envoyee", "facturee", "payee", "archive"].includes(t.status);

  const todayTasks = tasks.filter(isToday);
  const overdueTasks = tasks.filter((t) => isOverdue(t) && !isToday(t));
  const toOrderPrints = printOrders.filter((o) => o.status === "a_commander");

  return (
    <Card className="p-5 mb-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
            <Sun className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Aujourd'hui</h2>
            <p className="text-xs text-muted-foreground">
              {todayTasks.length} tâche{todayTasks.length > 1 ? "s" : ""} à faire
              {overdueTasks.length > 0 && ` • ${overdueTasks.length} en retard`}
              {toOrderPrints.length > 0 && ` • ${toOrderPrints.length} impression${toOrderPrints.length > 1 ? "s" : ""} à commander`}
            </p>
          </div>
        </div>
        <Link to="/taches" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Toutes les tâches <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {todayTasks.length === 0 && overdueTasks.length === 0 && toOrderPrints.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          🎉 Rien de prévu pour aujourd'hui
        </div>
      ) : (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-destructive uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5" /> En retard
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {overdueTasks.map((t) => <TodayCard key={t.id} task={t} variant="overdue" />)}
              </div>
            </div>
          )}
          {todayTasks.length > 0 && (
            <div>
              {overdueTasks.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Calendar className="h-3.5 w-3.5" /> Aujourd'hui
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {todayTasks.map((t) => <TodayCard key={t.id} task={t} variant="today" />)}
              </div>
            </div>
          )}
          {toOrderPrints.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
                <Printer className="h-3.5 w-3.5" /> Impressions à commander
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {toOrderPrints.map((o) => (
                  <Link
                    key={o.id}
                    to={`/impressions/${o.id}`}
                    className="block p-3 rounded-md border border-red-400/50 bg-red-500/5 hover:bg-red-500/10 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium leading-snug truncate">{o.description}</div>
                      <Badge variant="outline" className="shrink-0 text-[10px] border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400">{PRINT_STATUS_LABEL[o.status]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{o.clients?.name ?? "—"}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function TodayCard({ task, variant }: { task: Task; variant: "today" | "overdue" }) {
  return (
    <Link
      to={`/taches/${task.id}`}
      className={`block p-3 rounded-md border bg-card hover:bg-secondary/60 transition ${
        variant === "overdue" ? "border-destructive/40" : "border-emerald-500/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-snug truncate">{task.title}</div>
        <Badge
          variant={variant === "overdue" ? "destructive" : "outline"}
          className={`shrink-0 text-[10px] ${variant === "today" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : ""}`}
        >
          {variant === "overdue" && task.deadline
            ? `Retard ${new Date(task.deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`
            : STATUS_LABEL[task.status]}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-1 truncate">{task.clients?.name ?? "—"}</div>
    </Link>
  );
}

function printStatusBadgeClass(status: string): string {
  if (status === "a_commander") return "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400";
  if (status === "en_impression") return "border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-400";
  return "";
}

function isApptSoon(dt: Date): boolean {
  const now = new Date();
  const sameDay = dt.toDateString() === now.toDateString();
  if (sameDay) return true;
  const diffMs = dt.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 24 * 60 * 60 * 1000;
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

function InstallmentsWidget({ items }: { items: Installment[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((x) => x.due_date < today);
  const upcoming = items.filter((x) => x.due_date >= today);
  return InstallmentsWidgetInner({ items, today, overdue, upcoming });
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

function InstallmentsWidgetInner({ items, today, overdue, upcoming }: { items: Installment[]; today: string; overdue: Installment[]; upcoming: Installment[] }) {
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