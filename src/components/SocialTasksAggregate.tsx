import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  client_id: string;
  post_id: string | null;
  title: string;
  description: string | null;
  status: "a_faire" | "en_cours" | "fait" | "aujourdhui" | "envoye" | "bat" | "impression" | "a_facturer" | "archive";
  priority: "basse" | "normale" | "haute";
  due_date: string | null;
  reminder_at: string | null;
  done_at: string | null;
  clients?: { id: string; name: string } | null;
  social_posts?: { id: string; title: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  aujourdhui: "Aujourd'hui",
  envoye: "Traité / En validation",
  bat: "BAT",
  impression: "En impression",
  a_facturer: "En facturation",
  fait: "Fait",
  archive: "Archivé",
};
const PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute" };
const PRIORITY_COLORS: Record<string, string> = { basse: "bg-slate-400", normale: "bg-sky-500", haute: "bg-rose-500" };

export default function SocialTasksAggregate({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const reload = async () => {
    setLoading(true);
    const [{ data: ts, error }, { data: cs }] = await Promise.all([
      supabase
        .from("social_tasks")
        .select("*, social_posts(id,title)")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name"),
    ]);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const clientMap = new Map((cs ?? []).map((c: any) => [c.id, c]));
    setTasks(((ts ?? []) as any[]).map((t) => ({ ...t, clients: clientMap.get(t.client_id) ?? null })));
  };

  useEffect(() => { reload(); }, []);

  const toggleDone = async (t: Row) => {
    const isDone = t.status === "archive" || t.status === "fait";
    const next = isDone ? "a_faire" : "archive";
    const { error } = await supabase.from("social_tasks").update({
      status: next,
      done_at: next === "archive" ? new Date().toISOString() : null,
    }).eq("id", t.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const clientOptions = Array.from(new Map(tasks.map((t) => [t.client_id, t.clients?.name ?? "—"])).entries());

  const filtered = tasks.filter((t) => {
    if (clientFilter !== "all" && t.client_id !== clientFilter) return false;
    if (statusFilter === "open" && (t.status === "fait" || t.status === "archive")) return false;
    if (statusFilter !== "open" && statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (q && !`${t.title} ${t.description ?? ""} ${t.clients?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const overdue = filtered.filter((t) => t.status !== "fait" && t.status !== "archive" && t.due_date && t.due_date < todayKey);
  const today = filtered.filter((t) => t.status !== "fait" && t.status !== "archive" && t.due_date === todayKey);
  const upcoming = filtered.filter((t) => t.status !== "fait" && t.status !== "archive" && t.due_date && t.due_date > todayKey);
  const noDate = filtered.filter((t) => t.status !== "fait" && t.status !== "archive" && !t.due_date);
  const done = filtered.filter((t) => t.status === "fait" || t.status === "archive");

  const Section = ({ title, items, tone }: { title: string; items: Row[]; tone?: string }) => (
    items.length > 0 && (
      <div>
        <div className={`text-[10px] uppercase tracking-wide mb-1.5 font-semibold ${tone ?? "text-muted-foreground"}`}>
          {title} <span className="text-muted-foreground font-normal">({items.length})</span>
        </div>
        <div className="divide-y">
          {items.map((t) => <TaskRow key={t.id} t={t} onToggle={toggleDone} />)}
        </div>
      </div>
    )
  );

  return (
    <Card>
      <CardContent className={compact ? "p-4 space-y-3" : "p-4 md:p-5 space-y-4"}>
        <div className="flex flex-wrap items-center gap-2">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Tâches réseaux sociaux</h3>
          <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs w-40" />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous clients</SelectItem>
                {clientOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Ouvertes</SelectItem>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Aucune tâche</div>
        ) : (
          <div className="space-y-4">
            <Section title="En retard" items={overdue} tone="text-rose-600 dark:text-rose-400" />
            <Section title="Aujourd'hui" items={today} tone="text-primary" />
            <Section title="À venir" items={upcoming} />
            <Section title="Sans date" items={noDate} />
            {statusFilter !== "open" && <Section title="Terminées" items={done} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ t, onToggle }: { t: Row; onToggle: (t: Row) => void }) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const isDone = t.status === "fait" || t.status === "archive";
  const isLate = t.due_date && t.due_date < todayKey && !isDone;
  return (
    <div className="py-2 flex items-start gap-2.5">
      <Checkbox checked={isDone} onCheckedChange={() => onToggle(t)} className="mt-1" />
      <Link to={`/social/${t.client_id}`} className="min-w-0 flex-1 hover:bg-secondary/30 -mx-1 px-1 rounded">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority]}`} />
          <div className={`text-sm font-medium truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {t.title}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 pl-3.5">
          {t.clients?.name && (
            <Badge variant="secondary" className="text-[10px] py-0 inline-flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5" />
              {t.clients.name}
            </Badge>
          )}
          {t.due_date && (
            <span className={`text-[11px] ${isLate ? "text-rose-500 font-medium" : "text-muted-foreground"}`}>
              {format(parseISO(t.due_date), "EEE d MMM", { locale: fr })}
            </span>
          )}
          {t.social_posts?.title && (
            <Badge variant="outline" className="text-[10px] py-0 max-w-[180px] truncate">📌 {t.social_posts.title}</Badge>
          )}
          <Badge variant="outline" className="text-[10px] py-0">{STATUS_LABELS[t.status]}</Badge>
        </div>
      </Link>
    </div>
  );
}