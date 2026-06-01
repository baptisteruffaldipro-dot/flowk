import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, ExternalLink, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek,
  eachDayOfInterval, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import SocialPostDialog, { SocialPost } from "@/components/SocialPostDialog";
import { Checkbox } from "@/components/ui/checkbox";

type Strategy = {
  id?: string;
  client_id: string;
  objective: string | null;
  axes: { name: string; objective: string; contents: string }[];
  pillars: { name: string; description: string }[];
  tone: string | null;
  rhythm: { platform: string; frequency: string }[];
  weekly_template: { day: string; type: string }[];
  content: string | null;
};

type LinkRow = { id?: string; client_id: string; label: string; url: string; category: string | null };

type SocialTask = {
  id?: string;
  client_id: string;
  post_id?: string | null;
  title: string;
  description?: string | null;
  status: "a_faire" | "en_cours" | "fait";
  priority: "basse" | "normale" | "haute";
  due_date?: string | null;
  reminder_at?: string | null;
  done_at?: string | null;
};

const TASK_STATUS_LABELS: Record<string, string> = { a_faire: "À faire", en_cours: "En cours", fait: "Fait" };
const TASK_PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute" };
const TASK_PRIORITY_COLORS: Record<string, string> = { basse: "bg-slate-400", normale: "bg-sky-500", haute: "bg-rose-500" };

const STATUS_LABELS: Record<string, string> = {
  idee: "Idée", a_faire: "À faire", pret: "Prêt", programme: "Programmé", publie: "Publié", annule: "Annulé",
};
const STATUS_COLORS: Record<string, string> = {
  idee: "bg-slate-400", a_faire: "bg-amber-500", pret: "bg-sky-500",
  programme: "bg-violet-500", publie: "bg-emerald-500", annule: "bg-rose-500",
};

export default function SocialMediaClient() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<SocialPost> | undefined>();

  const reload = async () => {
    if (!clientId) return;
    const [{ data: c }, { data: ps }, { data: st }, { data: ls }, { data: ts }] = await Promise.all([
      supabase.from("clients").select("id,name").eq("id", clientId).maybeSingle(),
      supabase.from("social_posts").select("*").eq("client_id", clientId).order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase.from("social_strategies").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("social_links").select("*").eq("client_id", clientId).order("position"),
      supabase.from("social_tasks").select("*").eq("client_id", clientId).order("position").order("created_at"),
    ]);
    setClient(c as any);
    setPosts(ps ?? []);
    setStrategy((st as any) ?? null);
    setLinks((ls ?? []) as any);
    setTasks((ts ?? []) as any);
  };

  useEffect(() => { reload(); }, [clientId]);

  const openNew = (date?: Date) => {
    setEditing({
      client_id: clientId!,
      scheduled_at: date ? new Date(date.setHours(10, 0, 0, 0)).toISOString() : null,
    });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setDialogOpen(true);
  };

  if (!client) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Link to="/social" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3 mr-1" /> Réseaux sociaux
      </Link>
      <PageHeader
        title={client.name}
        description="Calendrier éditorial, posts, stratégie et ressources"
        actions={<Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" /> Nouveau post</Button>}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Récapitulatif</TabsTrigger>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="tasks">Tâches</TabsTrigger>
          <TabsTrigger value="strategy">Stratégie</TabsTrigger>
          <TabsTrigger value="links">Liens</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewView posts={posts} strategy={strategy} links={links} tasks={tasks} onPostClick={openEdit} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView posts={posts} onDayClick={openNew} onPostClick={openEdit} />
        </TabsContent>

        <TabsContent value="posts" className="mt-4">
          <PostsList posts={posts} onPostClick={openEdit} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksView clientId={clientId!} tasks={tasks} posts={posts} onSaved={reload} />
        </TabsContent>

        <TabsContent value="strategy" className="mt-4">
          <StrategyEditor clientId={clientId!} strategy={strategy} onSaved={reload} />
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <LinksEditor clientId={clientId!} links={links} onSaved={reload} />
        </TabsContent>
      </Tabs>

      <SocialPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId!}
        initial={editing}
        onSaved={reload}
      />
    </div>
  );
}

/* ---------- Calendar ---------- */
function OverviewView({
  posts, strategy, links, tasks, onPostClick,
}: { posts: any[]; strategy: Strategy | null; links: LinkRow[]; tasks: SocialTask[]; onPostClick: (p: any) => void }) {
  const now = Date.now();
  const upcoming = posts
    .filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() >= now && p.status !== "publie" && p.status !== "annule")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const next5 = upcoming.slice(0, 5);
  const scheduledOnly = upcoming.filter((p) => p.status === "programme");
  const openTasks = tasks.filter((t) => t.status !== "fait");
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < todayKey);
  const dueSoon = openTasks.filter((t) => t.due_date && t.due_date >= todayKey).slice(0, 5);

  const counts: Record<string, number> = {};
  posts.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });

  const linksByCat: Record<string, LinkRow[]> = {};
  links.forEach((l) => { (linksByCat[l.category || "Autres"] ||= []).push(l); });

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-3">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <Stat label="Total posts" value={posts.length} />
          <Stat label="À venir" value={upcoming.length} />
          <Stat label="Programmés" value={scheduledOnly.length} />
          <Stat label="Tâches ouvertes" value={openTasks.length} />
          <Stat label="Tâches en retard" value={overdue.length} />
          <Stat label="Publiés" value={counts.publie ?? 0} />
        </CardContent>
      </Card>

      {(overdue.length > 0 || dueSoon.length > 0) && (
        <Card className="lg:col-span-3">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2">Tâches à traiter</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">En retard</div>
                {overdue.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                {overdue.map((t) => (
                  <div key={t.id} className="text-xs py-1 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${TASK_PRIORITY_COLORS[t.priority]}`} />
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-muted-foreground">{t.due_date && format(parseISO(t.due_date), "d MMM", { locale: fr })}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">À venir</div>
                {dueSoon.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                {dueSoon.map((t) => (
                  <div key={t.id} className="text-xs py-1 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${TASK_PRIORITY_COLORS[t.priority]}`} />
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-muted-foreground">{t.due_date && format(parseISO(t.due_date), "d MMM", { locale: fr })}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Stratégie</h3>
            {!strategy && <span className="text-xs text-muted-foreground">Aucune stratégie définie</span>}
          </div>
          {strategy?.objective && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Objectif</div>
              <p className="text-sm whitespace-pre-wrap">{strategy.objective}</p>
            </div>
          )}
          {strategy?.tone && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ton</div>
              <p className="text-sm whitespace-pre-wrap">{strategy.tone}</p>
            </div>
          )}
          {strategy?.pillars && strategy.pillars.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Piliers</div>
              <div className="flex flex-wrap gap-1.5">
                {strategy.pillars.map((p, i) => (
                  <Badge key={i} variant="secondary" title={p.description}>{p.name}</Badge>
                ))}
              </div>
            </div>
          )}
          {strategy?.rhythm && strategy.rhythm.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rythme</div>
              <ul className="text-sm space-y-0.5">
                {strategy.rhythm.map((r, i) => (
                  <li key={i} className="text-muted-foreground"><span className="text-foreground">{r.platform}</span> — {r.frequency}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold mb-2">Prochaines dates</h3>
          {next5.length === 0 && <div className="text-xs text-muted-foreground">Aucune date à venir</div>}
          {next5.map((p) => (
            <div key={p.id} onClick={() => onPostClick(p)} className="cursor-pointer hover:bg-secondary/40 -mx-1 px-1 py-1.5 rounded">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] ?? "bg-slate-400"}`} />
                <div className="text-xs font-medium truncate flex-1">{p.title}</div>
              </div>
              <div className="text-[11px] text-muted-foreground pl-3.5">
                {format(parseISO(p.scheduled_at), "EEE d MMM HH:mm", { locale: fr })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-2">Posts programmés</h3>
          {scheduledOnly.length === 0 && <div className="text-xs text-muted-foreground">Aucun post programmé</div>}
          <div className="divide-y">
            {scheduledOnly.slice(0, 10).map((p) => (
              <div key={p.id} onClick={() => onPostClick(p)} className="py-2 cursor-pointer hover:bg-secondary/40 px-2 -mx-2 rounded flex items-start gap-2">
                <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${STATUS_COLORS[p.status]}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{p.title}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{format(parseISO(p.scheduled_at), "d MMM HH:mm", { locale: fr })}</span>
                    <Badge variant="outline" className="text-[10px] py-0">{p.format}</Badge>
                    {p.platforms?.map((pl: string) => <Badge key={pl} variant="secondary" className="text-[10px] py-0">{pl}</Badge>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Liens utiles</h3>
          {links.length === 0 && <div className="text-xs text-muted-foreground">Aucun lien</div>}
          {Object.entries(linksByCat).map(([cat, ls]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{cat}</div>
              <div className="space-y-1">
                {ls.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{l.label}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

/* ---------- Calendar (cont.) ---------- */
function CalendarView({ posts, onDayClick, onPostClick }: { posts: any[]; onDayClick: (d: Date) => void; onPostClick: (p: any) => void }) {
  const [cursor, setCursor] = useState(new Date());
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    posts.forEach((p) => {
      if (!p.scheduled_at) return;
      const k = format(parseISO(p.scheduled_at), "yyyy-MM-dd");
      (map[k] ||= []).push(p);
    });
    return map;
  }, [posts]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-base font-semibold capitalize min-w-[160px] text-center">{format(cursor, "LLLL yyyy", { locale: fr })}</div>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Aujourd'hui</Button>
        </div>
        <div className="grid grid-cols-7 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
          {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => (
            <div key={d} className="px-2 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = format(d, "yyyy-MM-dd");
            const dayPosts = postsByDay[k] ?? [];
            const isCurMonth = isSameMonth(d, cursor);
            const isToday = isSameDay(d, new Date());
            return (
              <div
                key={k}
                onClick={() => onDayClick(d)}
                className={`min-h-[90px] p-1.5 rounded border cursor-pointer hover:border-primary/50 transition-colors ${isCurMonth ? "bg-card" : "bg-secondary/30 opacity-60"}`}
              >
                <div className={`text-[11px] font-medium mb-1 ${isToday ? "text-primary" : ""}`}>{format(d, "d")}</div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      onClick={(e) => { e.stopPropagation(); onPostClick(p); }}
                      className="text-[10px] px-1 py-0.5 rounded bg-secondary hover:bg-secondary/80 truncate flex items-center gap-1"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] ?? "bg-slate-400"}`} />
                      <span className="truncate">{p.title}</span>
                    </div>
                  ))}
                  {dayPosts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayPosts.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground">
          {Object.entries(STATUS_LABELS).map(([k, l]) => (
            <div key={k} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[k]}`} /> {l}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Posts list ---------- */
function PostsList({ posts, onPostClick }: { posts: any[]; onPostClick: (p: any) => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filtered = posts.filter((p) => statusFilter === "all" || p.status === statusFilter);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} post{filtered.length > 1 ? "s" : ""}</div>
        </div>
        <div className="divide-y">
          {filtered.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Aucun post</div>}
          {filtered.map((p) => (
            <div key={p.id} onClick={() => onPostClick(p)} className="py-2.5 cursor-pointer hover:bg-secondary/40 px-2 -mx-2 rounded flex items-start gap-3">
              <span className={`h-2 w-2 rounded-full mt-2 shrink-0 ${STATUS_COLORS[p.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {p.scheduled_at && <span className="text-[11px] text-muted-foreground">{format(parseISO(p.scheduled_at), "EEE d MMM yyyy HH:mm", { locale: fr })}</span>}
                  <Badge variant="outline" className="text-[10px] py-0">{p.format}</Badge>
                  {p.platforms?.map((pl: string) => <Badge key={pl} variant="secondary" className="text-[10px] py-0">{pl}</Badge>)}
                  {p.pillar && <Badge variant="outline" className="text-[10px] py-0">{p.pillar}</Badge>}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{STATUS_LABELS[p.status]}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Strategy ---------- */
function StrategyEditor({ clientId, strategy, onSaved }: { clientId: string; strategy: Strategy | null; onSaved: () => void }) {
  const empty: Strategy = {
    client_id: clientId,
    objective: "",
    axes: [],
    pillars: [],
    tone: "",
    rhythm: [],
    weekly_template: [],
    content: "",
  };
  const [s, setS] = useState<Strategy>(strategy ?? empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setS(strategy ?? empty); /* eslint-disable-next-line */ }, [strategy?.id, clientId]);

  const save = async () => {
    setBusy(true);
    const payload = { ...s, client_id: clientId };
    const res = await supabase.from("social_strategies").upsert(payload, { onConflict: "client_id" });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Stratégie enregistrée");
    onSaved();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Objectif global</Label>
          <Textarea rows={3} value={s.objective ?? ""} onChange={(e) => setS({ ...s, objective: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Ligne éditoriale / ton</Label>
          <Textarea rows={3} value={s.tone ?? ""} onChange={(e) => setS({ ...s, tone: e.target.value })} />
        </div>

        <RepeaterAxes value={s.axes} onChange={(v) => setS({ ...s, axes: v })} />
        <RepeaterPillars value={s.pillars} onChange={(v) => setS({ ...s, pillars: v })} />
        <RepeaterRhythm value={s.rhythm} onChange={(v) => setS({ ...s, rhythm: v })} />
        <RepeaterWeekly value={s.weekly_template} onChange={(v) => setS({ ...s, weekly_template: v })} />

        <div className="space-y-1.5">
          <Label className="text-xs">Notes libres / stratégie détaillée</Label>
          <Textarea rows={10} value={s.content ?? ""} onChange={(e) => setS({ ...s, content: e.target.value })} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RepeaterAxes({ value, onChange }: { value: Strategy["axes"]; onChange: (v: Strategy["axes"]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Axes</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { name: "", objective: "", contents: "" }])}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
      </div>
      {value.map((a, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 p-2 border rounded">
          <Input className="col-span-3" placeholder="Nom" value={a.name} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <Input className="col-span-4" placeholder="Objectif" value={a.objective} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, objective: e.target.value } : x))} />
          <Input className="col-span-4" placeholder="Contenus" value={a.contents} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, contents: e.target.value } : x))} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
    </div>
  );
}
function RepeaterPillars({ value, onChange }: { value: Strategy["pillars"]; onChange: (v: Strategy["pillars"]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Piliers de contenu</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { name: "", description: "" }])}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
      </div>
      {value.map((p, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 p-2 border rounded">
          <Input className="col-span-3" placeholder="Nom" value={p.name} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <Input className="col-span-8" placeholder="Description" value={p.description} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
    </div>
  );
}
function RepeaterRhythm({ value, onChange }: { value: Strategy["rhythm"]; onChange: (v: Strategy["rhythm"]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Rythme de publication</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { platform: "", frequency: "" }])}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
      </div>
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 p-2 border rounded">
          <Input className="col-span-4" placeholder="Plateforme / format" value={r.platform} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))} />
          <Input className="col-span-7" placeholder="Fréquence" value={r.frequency} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
    </div>
  );
}
function RepeaterWeekly({ value, onChange }: { value: Strategy["weekly_template"]; onChange: (v: Strategy["weekly_template"]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Planning hebdomadaire type</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { day: "", type: "" }])}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
      </div>
      {value.map((w, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 p-2 border rounded">
          <Input className="col-span-3" placeholder="Jour" value={w.day} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, day: e.target.value } : x))} />
          <Input className="col-span-8" placeholder="Type de contenu" value={w.type} onChange={(e) => onChange(value.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Links ---------- */
function LinksEditor({ clientId, links, onSaved }: { clientId: string; links: LinkRow[]; onSaved: () => void }) {
  // (unchanged below)
  const [form, setForm] = useState<LinkRow>({ client_id: clientId, label: "", url: "", category: "" });

  const add = async () => {
    if (!form.label.trim() || !form.url.trim()) return toast.error("Label et URL requis");
    const { error } = await supabase.from("social_links").insert({ ...form, position: links.length });
    if (error) return toast.error(error.message);
    setForm({ client_id: clientId, label: "", url: "", category: "" });
    onSaved();
  };

  const remove = async (id?: string) => {
    if (!id) return;
    await supabase.from("social_links").delete().eq("id", id);
    onSaved();
  };

  const grouped = links.reduce<Record<string, LinkRow[]>>((acc, l) => {
    const k = l.category || "Général";
    (acc[k] ||= []).push(l);
    return acc;
  }, {});

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-12 gap-2">
          <Input className="col-span-3" placeholder="Catégorie" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input className="col-span-3" placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Input className="col-span-5" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Button className="col-span-1" onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
        {Object.keys(grouped).length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">Aucun lien</div>}
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{cat}</div>
            <div className="divide-y">
              {items.map((l) => (
                <div key={l.id} className="py-2 flex items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{l.label}</div>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">{l.url}</a>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(l.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------- Tasks ---------- */
function TasksView({ clientId, tasks, posts, onSaved }: { clientId: string; tasks: SocialTask[]; posts: any[]; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<SocialTask>>({ title: "", priority: "normale", status: "a_faire" });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("open");
  const [editing, setEditing] = useState<SocialTask | null>(null);

  const filtered = tasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "open") return t.status !== "fait";
    return t.status === filter;
  });

  const grouped: Record<string, SocialTask[]> = { a_faire: [], en_cours: [], fait: [] };
  filtered.forEach((t) => grouped[t.status]?.push(t));

  const add = async () => {
    if (!form.title?.trim()) return toast.error("Titre requis");
    setBusy(true);
    const { error } = await supabase.from("social_tasks").insert({
      client_id: clientId,
      title: form.title.trim(),
      description: form.description || null,
      status: form.status ?? "a_faire",
      priority: form.priority ?? "normale",
      due_date: form.due_date || null,
      reminder_at: form.reminder_at || null,
      post_id: form.post_id || null,
      position: tasks.length,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ title: "", priority: "normale", status: "a_faire" });
    onSaved();
  };

  const toggleDone = async (t: SocialTask) => {
    const next = t.status === "fait" ? "a_faire" : "fait";
    const { error } = await supabase.from("social_tasks").update({
      status: next,
      done_at: next === "fait" ? new Date().toISOString() : null,
    }).eq("id", t.id!);
    if (error) return toast.error(error.message);
    onSaved();
  };

  const remove = async (id?: string) => {
    if (!id) return;
    if (!confirm("Supprimer cette tâche ?")) return;
    const { error } = await supabase.from("social_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onSaved();
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    const { error } = await supabase.from("social_tasks").update({
      title: editing.title,
      description: editing.description ?? null,
      status: editing.status,
      priority: editing.priority,
      due_date: editing.due_date || null,
      reminder_at: editing.reminder_at || null,
      post_id: editing.post_id || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    onSaved();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Nouvelle tâche</h3>
          <div className="grid grid-cols-12 gap-2">
            <Input className="col-span-12 md:col-span-5" placeholder="Titre" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input type="date" className="col-span-6 md:col-span-2" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <Select value={form.priority ?? "normale"} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="col-span-6 md:col-span-2"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TASK_PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.post_id ?? "none"} onValueChange={(v) => setForm({ ...form, post_id: v === "none" ? null : v })}>
              <SelectTrigger className="col-span-10 md:col-span-2"><SelectValue placeholder="Post lié" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun post</SelectItem>
                {posts.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="col-span-2 md:col-span-1" onClick={add} disabled={busy}><Plus className="h-4 w-4" /></Button>
            <Textarea className="col-span-12" rows={2} placeholder="Description (optionnel)" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Ouvertes</SelectItem>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.entries(TASK_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground ml-auto">{filtered.length} tâche{filtered.length > 1 ? "s" : ""}</div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {(["a_faire", "en_cours", "fait"] as const).map((col) => (
              <div key={col} className="rounded border bg-secondary/20 p-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 px-1">
                  {TASK_STATUS_LABELS[col]} <span className="text-foreground/60">({grouped[col].length})</span>
                </div>
                <div className="space-y-1.5">
                  {grouped[col].length === 0 && <div className="text-xs text-muted-foreground/60 px-1 py-2">—</div>}
                  {grouped[col].map((t) => {
                    const post = posts.find((p) => p.id === t.post_id);
                    const todayKey = format(new Date(), "yyyy-MM-dd");
                    const isLate = t.due_date && t.due_date < todayKey && t.status !== "fait";
                    return (
                      <div key={t.id} className="bg-card border rounded p-2 group">
                        <div className="flex items-start gap-2">
                          <Checkbox checked={t.status === "fait"} onCheckedChange={() => toggleDone(t)} className="mt-0.5" />
                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing(t)}>
                            <div className={`text-sm font-medium ${t.status === "fait" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                            {t.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</div>}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <Badge variant="outline" className="text-[10px] py-0">
                                <span className={`h-1.5 w-1.5 rounded-full mr-1 ${TASK_PRIORITY_COLORS[t.priority]}`} />
                                {TASK_PRIORITY_LABELS[t.priority]}
                              </Badge>
                              {t.due_date && (
                                <span className={`text-[10px] ${isLate ? "text-rose-500 font-medium" : "text-muted-foreground"}`}>
                                  {format(parseISO(t.due_date), "d MMM", { locale: fr })}
                                </span>
                              )}
                              {post && <Badge variant="secondary" className="text-[10px] py-0 max-w-[120px] truncate">📌 {post.title}</Badge>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove(t.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Modifier la tâche</h3>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Fermer</Button>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <Input className="col-span-12" placeholder="Titre" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <Textarea className="col-span-12" rows={3} placeholder="Description" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                <SelectTrigger className="col-span-6 md:col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TASK_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={editing.priority} onValueChange={(v: any) => setEditing({ ...editing, priority: v })}>
                <SelectTrigger className="col-span-6 md:col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TASK_PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" className="col-span-6 md:col-span-3" value={editing.due_date ?? ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
              <Input type="datetime-local" className="col-span-6 md:col-span-3" value={editing.reminder_at ? editing.reminder_at.slice(0, 16) : ""} onChange={(e) => setEditing({ ...editing, reminder_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              <Select value={editing.post_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, post_id: v === "none" ? null : v })}>
                <SelectTrigger className="col-span-12"><SelectValue placeholder="Post lié" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun post</SelectItem>
                  {posts.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}