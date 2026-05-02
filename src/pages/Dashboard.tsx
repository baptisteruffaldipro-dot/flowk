import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fmtMoney, STATUS_LABEL, PRINT_STATUS_LABEL, PROJECT_TYPE_LABEL } from "@/lib/format";
import { ArrowRight, Sun, AlertTriangle, Calendar, Video, MapPin, Phone, CalendarDays, Printer, FolderKanban } from "lucide-react";
import QuickCreate from "@/components/QuickCreate";

type Task = { id: string; title: string; status: string; deadline: string | null; clients?: { name: string } | null };
type Order = { id: string; description: string; status: string; clients?: { name: string } | null };
type Inv = { id: string; label: string; amount: number; status: string; clients?: { name: string } | null };
type Appt = { id: string; title: string; start_at: string; type: string; location: string | null; clients?: { name: string } | null };
type Project = { id: string; name: string; type: string; clients?: { name: string } | null };

const APPT_TYPE_ICON: Record<string, any> = { visio: Video, presentiel: MapPin, telephone: Phone, autre: CalendarDays };

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({ todoCount: 0, doneCount: 0, totalCount: 0, pendingRevenue: 0, paidRevenue: 0, awaitingBat: 0 });

  const load = async () => {
      const [t, todayT, o, i, a, paid, p, batsRelecture] = await Promise.all([
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").not("status", "in", "(envoye,archive)").order("deadline", { ascending: true, nullsFirst: false }).limit(50),
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").eq("status", "aujourdhui" as any),
        supabase.from("print_orders").select("id,description,status,payment_status,amount,clients(name)").not("status", "in", "(livre,livre_paye)").order("created_at", { ascending: false }).limit(50),
        supabase.from("invoices").select("id,label,amount,status,clients(name)").neq("status", "payee").order("created_at", { ascending: false }).limit(50),
        supabase.from("appointments").select("id,title,start_at,type,location,clients(name)").gte("start_at", new Date().toISOString()).neq("status", "annule").order("start_at", { ascending: true }).limit(8),
        supabase.from("invoices").select("amount").eq("status", "payee"),
        supabase.from("projects").select("id,name,type,clients(name)").eq("archived", false).order("updated_at", { ascending: false }).limit(8),
        supabase.from("bats").select("id").eq("status", "en_relecture" as any),
      ]);
      const allPrint = await supabase.from("print_orders").select("amount,payment_status,status");
      const allPrintData = (allPrint.data as any[]) ?? [];
      const paidPrintRev = allPrintData.reduce((s: number, x: any) => {
        const amt = x.amount ? Number(x.amount) : 0;
        if (x.payment_status === "regle" || x.status === "livre_paye") return s + amt;
        if (x.payment_status === "acompte_50") return s + amt * 0.5;
        return s;
      }, 0);
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
      setStats({ todoCount, doneCount, totalCount, pendingRevenue: pendingRev, paidRevenue: paidRev + paidPrintRev, awaitingBat: awaitBat });
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Dashboard" description="Vue d'ensemble de ton activité" />

      <div className="mb-6">
        <QuickCreate onCreated={load} />
      </div>

      <TodayBoard tasks={tasks} printOrders={orders} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ProgressStatCard
          label="Tâches à faire"
          value={stats.todoCount}
          done={stats.doneCount}
          total={stats.totalCount}
        />
        <StatCard label="CA en attente" value={fmtMoney(stats.pendingRevenue)} />
        <StatCard label="Chiffre d'affaires HT" value={fmtMoney(stats.paidRevenue)} />
        <StatCard label="BAT à valider" value={String(stats.awaitingBat)} href="/bats" highlight={stats.awaitingBat > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                <Badge variant="outline" className="shrink-0 text-[10px]">{PRINT_STATUS_LABEL[o.status]}</Badge>
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
            return (
              <Link key={a.id} to="/rdv" className="block p-3 rounded-md hover:bg-secondary/60 transition border border-transparent hover:border-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug truncate">{a.title}</div>
                  <Badge variant="outline" className="shrink-0 text-[10px] inline-flex items-center gap-1">
                    <Icon className="h-2.5 w-2.5" /> {timeStr}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {dateStr} · {a.clients?.name ?? "—"}
                </div>
              </Link>
            );
          })}
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

function TodayBoard({ tasks, printOrders }: { tasks: Task[]; printOrders: Order[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (t: Task) => t.status === "aujourdhui" || t.deadline === today;
  const isOverdue = (t: Task) => !!t.deadline && t.deadline < today && t.status !== "envoye" && t.status !== "archive";

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
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                <Printer className="h-3.5 w-3.5" /> Impressions à commander
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {toOrderPrints.map((o) => (
                  <Link
                    key={o.id}
                    to={`/impressions/${o.id}`}
                    className="block p-3 rounded-md border border-orange-300/40 bg-card hover:bg-secondary/60 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium leading-snug truncate">{o.description}</div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{PRINT_STATUS_LABEL[o.status]}</Badge>
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
        variant === "overdue" ? "border-destructive/40" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-snug truncate">{task.title}</div>
        <Badge variant={variant === "overdue" ? "destructive" : "default"} className="shrink-0 text-[10px]">
          {variant === "overdue" && task.deadline
            ? `Retard ${new Date(task.deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`
            : STATUS_LABEL[task.status]}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-1 truncate">{task.clients?.name ?? "—"}</div>
    </Link>
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