import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABEL, PRINT_STATUS_LABEL, PROJECT_TYPE_LABEL } from "@/lib/format";
import { ArrowRight, Sun, AlertTriangle, Calendar, Video, MapPin, Phone, CalendarDays, Printer, FolderKanban, UserPlus } from "lucide-react";
import QuickCreate from "@/components/QuickCreate";
import VacationWindows from "@/components/finance/VacationWindows";

type Task = { id: string; title: string; status: string; deadline: string | null; clients?: { name: string } | null };
type Order = { id: string; description: string; status: string; clients?: { name: string } | null };
type Appt = { id: string; title: string; start_at: string; type: string; location: string | null; clients?: { name: string } | null };
type Project = { id: string; name: string; type: string; clients?: { name: string } | null };
type Lead = { id: string; name: string | null; email: string | null; phone: string | null; company: string | null; source: string | null; created_at: string };

const APPT_TYPE_ICON: Record<string, any> = { visio: Video, presentiel: MapPin, telephone: Phone, autre: CalendarDays };

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState({ todoCount: 0, doneCount: 0, totalCount: 0, awaitingBat: 0 });

  const load = async () => {
      const [t, todayT, o, a, p, batsRelecture, l] = await Promise.all([
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").not("status", "in", "(envoye,archive)").order("deadline", { ascending: true, nullsFirst: false }).limit(50),
        supabase.from("tasks").select("id,title,status,deadline,clients(name)").eq("status", "aujourdhui" as any),
        supabase.from("print_orders").select("id,description,status,payment_status,amount,clients(name)").not("status", "in", "(livre,livre_paye)").order("created_at", { ascending: false }).limit(50),
        supabase.from("appointments").select("id,title,start_at,type,location,clients(name)").gte("start_at", new Date().toISOString()).neq("status", "annule").order("start_at", { ascending: true }).limit(8),
        supabase.from("projects").select("id,name,type,clients(name)").eq("archived", false).order("updated_at", { ascending: false }).limit(8),
        supabase.from("bats").select("id").eq("status", "en_relecture" as any),
        supabase.from("leads").select("id,name,email,phone,company,source,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(8),
      ]);
      // Merge today tasks that might have been cut off by the limit
      const allTasks = (t.data as any) ?? [];
      const todayTasks = (todayT.data as any) ?? [];
      const taskIds = new Set(allTasks.map((x: any) => x.id));
      const merged = [...allTasks, ...todayTasks.filter((x: any) => !taskIds.has(x.id))];
      setTasks(merged);
      setOrders((o.data as any) ?? []);
      setAppointments((a.data as any) ?? []);
      setProjects((p.data as any) ?? []);
      setLeads((l.data as any) ?? []);

      // Compteurs globaux pour la barre de progression
      const allTasksRes = await supabase.from("tasks").select("status", { count: "exact" });
      const all = (allTasksRes.data as any) ?? [];
      const totalCount = all.filter((x: any) => x.status !== "archive").length;
      const doneCount = all.filter((x: any) => x.status === "envoye" || x.status === "a_facturer").length;
      const todoCount = totalCount - doneCount;
      const awaitPrintBat = ((o.data as any) ?? []).filter((x: Order) => x.status === "validation_bat").length;
      const awaitBatRows = ((batsRelecture.data as any) ?? []).length;
      const awaitBat = awaitPrintBat + awaitBatRows;
      setStats({ todoCount, doneCount, totalCount, awaitingBat: awaitBat });
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const closed = ["envoye", "a_facturer", "facture_envoyee", "facturee", "payee", "archive"];
  const todayTasks = tasks.filter((t) => t.status === "aujourdhui" || t.deadline === today);
  const overdue = tasks.filter((t) => !!t.deadline && t.deadline < today && !closed.includes(t.status) && !todayTasks.includes(t));
  const queue = [...overdue, ...todayTasks];
  const [focus, ...rest] = queue;
  const toOrder = orders.filter((o) => o.status === "a_commander");
  const nextAppt = appointments[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-4 md:p-10 w-full max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">{hello} 👋</h1>
        <p className="text-muted-foreground mt-2">
          {queue.length === 0 ? "Rien d'urgent. Profite-en pour avancer tranquillement." : `${queue.length} chose${queue.length > 1 ? "s" : ""} au programme aujourd'hui.`}
        </p>
      </div>

      {focus ? (
        <Link to={`/taches/${focus.id}`} className="group block rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 md:p-8 mb-6 hover:border-primary/60 transition">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-2">
            {overdue.includes(focus) ? "En retard — à faire en premier" : "On commence par"}
          </div>
          <div className="text-2xl md:text-3xl font-semibold tracking-tight">{focus.title}</div>
          <div className="text-muted-foreground mt-1">{focus.clients?.name ?? "Sans client"}</div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">
            Ouvrir la tâche <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </div>
        </Link>
      ) : (
        <Card className="p-8 mb-6 text-center text-muted-foreground">🎉 Aucune tâche prévue aujourd'hui</Card>
      )}

      {rest.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 px-1">Ensuite</div>
          <div className="divide-y rounded-xl border bg-card">
            {rest.slice(0, 5).map((t) => (
              <Link key={t.id} to={`/taches/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/50 transition">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.clients?.name ?? "—"}</div>
                </div>
                {overdue.includes(t) && <span className="text-xs text-destructive shrink-0">En retard</span>}
              </Link>
            ))}
          </div>
          {rest.length > 5 && (
            <Link to="/taches" className="mt-2 inline-flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground">
              + {rest.length - 5} autre{rest.length - 5 > 1 ? "s" : ""} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniLink href="/impressions" icon={Printer} label="À commander" value={toOrder.length} alert={toOrder.length > 0} />
        <MiniLink href="/leads" icon={UserPlus} label="Nouveaux leads" value={leads.length} alert={leads.length > 0} />
        <MiniLink href="/rdv" icon={CalendarDays} label="Prochain RDV"
          value={nextAppt ? new Date(nextAppt.start_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) + " " + new Date(nextAppt.start_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
          sub={nextAppt?.title} />
      </div>
    </div>
  );
}

function MiniLink({ href, icon: Icon, label, value, sub, alert }: { href: string; icon: any; label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <Link to={href} className="rounded-xl border bg-card p-4 hover:bg-secondary/50 transition">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
        {alert && <span className="ml-auto h-2 w-2 rounded-full bg-destructive" />}
      </div>
      <div className="text-xl font-semibold mt-1.5 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
    </Link>
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
