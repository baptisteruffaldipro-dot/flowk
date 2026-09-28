import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Repeat, Clock, X, ExternalLink, GripVertical, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Block, CATEGORY_LABEL, DONE_STATUSES, blockOccursOn, catBg, catVar, fmtDur, minToTime, parseYmd, taskCategory, timeToMin, ymd,
} from "@/lib/agenda";

type View = "day" | "week" | "month";
const START_H = 7, END_H = 21, HOUR_PX = 56, CAPACITY = 8 * 60;
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DURATIONS = [0, 15, 30, 60, 90, 120, 180, 240];

const emptyBlock = (): Omit<Block, "id"> => ({
  title: "", category: "gestion", start_time: "08:00", duration_minutes: 60, recurrence: "weekdays",
  weekdays: [1, 2, 3, 4, 5], month_day: null, start_date: ymd(new Date()), end_date: null, notes: null,
});

const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function Agenda() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [tasks, setTasks] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [search, setSearch] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [bForm, setBForm] = useState<Omit<Block, "id">>(emptyBlock());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragHint, setDragHint] = useState<{ key: string; min: number } | null>(null);
  const gridScrollRef = { current: null as HTMLDivElement | null };

  const load = async () => {
    const [t, b] = await Promise.all([
      supabase.from("tasks").select("id,title,prestation,prestations,status,scheduled_date,scheduled_start,estimated_minutes,deadline,clients(name)").order("position"),
      supabase.from("agenda_blocks").select("*").order("start_time"),
    ]);
    if (t.error) toast.error(t.error.message);
    setTasks(t.data ?? []);
    setBlocks((b.data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const m = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(m, i));
  }, [view, anchor]);

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, any[]>();
    tasks.forEach((t) => { if (t.scheduled_date) { const a = m.get(t.scheduled_date) ?? []; a.push(t); m.set(t.scheduled_date, a); } });
    return m;
  }, [tasks]);

  const backlog = useMemo(() => {
    const q = search.toLowerCase();
    return tasks
      .filter((t) => !t.scheduled_date && !DONE_STATUSES.includes(t.status))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || (t.clients?.name ?? "").toLowerCase().includes(q))
      .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  }, [tasks, search]);

  const dayLoad = (d: Date) => {
    const ts = tasksByDay.get(ymd(d)) ?? [];
    const bs = blocks.filter((b) => blockOccursOn(b, d));
    const minutes = ts.reduce((s, t) => s + (t.estimated_minutes ?? 0), 0) + bs.reduce((s, b) => s + b.duration_minutes, 0);
    const noEstimate = ts.filter((t) => !t.estimated_minutes).length;
    return { minutes, noEstimate, count: ts.length, ts, bs };
  };

  const updateTask = async (id: string, patch: any) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const clearDrag = () => { setDragOver(null); setDragHint(null); };

  const onDrop = (e: React.DragEvent, date: Date, startMin: number | null) => {
    e.preventDefault(); clearDrag();
    const id = e.dataTransfer.getData("text/task");
    if (!id) return;
    updateTask(id, { scheduled_date: ymd(date), scheduled_start: startMin == null ? null : minToTime(startMin) });
  };
  const snapMin = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    let min = START_H * 60 + Math.round((y / HOUR_PX) * 60 / 15) * 15;
    return Math.max(START_H * 60, Math.min(END_H * 60 - 15, min));
  };
  const dropOnGrid = (e: React.DragEvent, date: Date) => onDrop(e, date, snapMin(e));
  const allowDrop = (key: string) => (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== key) setDragOver(key); };
  const allowGridDrop = (key: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    if (dragOver !== key) setDragOver(key);
    const min = snapMin(e);
    setDragHint((h) => (h && h.key === key && h.min === min ? h : { key, min }));
    // auto-scroll the grid when dragging near its top/bottom edge
    const scroller = gridScrollRef.current;
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      const EDGE = 70, SPEED = 14;
      if (e.clientY < r.top + EDGE) scroller.scrollTop -= SPEED;
      else if (e.clientY > r.bottom - EDGE) scroller.scrollTop += SPEED;
    }
  };

  const shift = (dir: number) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };

  const title = view === "month"
    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : view === "day"
      ? anchor.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
      : `${days[0].getDate()} ${MONTHS[days[0].getMonth()].slice(0, 4)}. – ${days[6].getDate()} ${MONTHS[days[6].getMonth()].slice(0, 4)}. ${days[6].getFullYear()}`;

  const weekTotal = view !== "month" ? days.reduce((s, d) => s + dayLoad(d).minutes, 0) : 0;

  // ---------- Block dialog ----------
  const openNewBlock = () => { setEditingBlock(null); setBForm(emptyBlock()); setBlockOpen(true); };
  const openEditBlock = (b: Block) => { setEditingBlock(b); const { id, ...rest } = b; setBForm({ ...rest, start_time: b.start_time.slice(0, 5) }); setBlockOpen(true); };
  const saveBlock = async () => {
    if (!bForm.title.trim()) return toast.error("Titre requis");
    const payload = { ...bForm, title: bForm.title.trim(), end_date: bForm.end_date || null, month_day: bForm.recurrence === "monthly" ? (bForm.month_day || parseYmd(bForm.start_date).getDate()) : null };
    const { error } = editingBlock
      ? await supabase.from("agenda_blocks").update(payload).eq("id", editingBlock.id)
      : await supabase.from("agenda_blocks").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingBlock ? "Période mise à jour" : "Période ajoutée");
    setBlockOpen(false); load();
  };
  const deleteBlock = async () => {
    if (!editingBlock || !confirm("Supprimer cette période récurrente ?")) return;
    await supabase.from("agenda_blocks").delete().eq("id", editingBlock.id);
    setBlockOpen(false); load();
  };

  // ---------- Task chip (with quick actions) ----------
  const TaskChip = ({ t, compact, style, className }: { t: any; compact?: boolean; style?: React.CSSProperties; className?: string }) => {
    const cat = taskCategory(t);
    const done = DONE_STATUSES.includes(t.status);
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/task", t.id);
              e.dataTransfer.effectAllowed = "move";
              const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
              ghost.style.width = "180px"; ghost.style.opacity = "0.9";
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, 20, 12);
              requestAnimationFrame(() => document.body.removeChild(ghost));
            }}
            onDragEnd={clearDrag}
            style={{ background: catBg(cat, 0.16), borderLeftColor: catVar(cat), ...style }}
            className={cn(
              "group cursor-grab active:cursor-grabbing rounded-md border-l-4 px-2 py-1 text-left overflow-hidden hover:brightness-95 transition",
              !t.estimated_minutes && t.scheduled_start && "border-dashed",
              done && "opacity-50 line-through",
              className,
            )}
          >
            <div className={cn("font-medium truncate text-foreground", compact ? "text-[10px]" : "text-xs")}>{t.title}</div>
            {!compact && (
              <div className="text-[10px] text-muted-foreground truncate">
                {t.scheduled_start ? t.scheduled_start.slice(0, 5) + " · " : ""}
                {t.estimated_minutes ? fmtDur(t.estimated_minutes) : "durée libre"}
                {t.clients?.name ? ` · ${t.clients.name}` : ""}
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-3" align="start">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: catVar(cat) }}>
              <span className="h-2 w-2 rounded-full" style={{ background: catVar(cat) }} />{CATEGORY_LABEL[cat]}
            </div>
            <div className="font-medium text-sm mt-1">{t.title}</div>
            {t.clients?.name && <div className="text-xs text-muted-foreground">{t.clients.name}</div>}
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1 mb-1.5"><Clock className="h-3 w-3" /> Temps estimé (facultatif)</Label>
            <div className="flex flex-wrap gap-1">
              {DURATIONS.map((m) => (
                <Button key={m} size="sm" variant={(t.estimated_minutes ?? 0) === m ? "default" : "outline"} className="h-6 px-2 text-[11px]"
                  onClick={() => updateTask(t.id, { estimated_minutes: m || null })}>
                  {m === 0 ? "Libre" : fmtDur(m)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {t.scheduled_start && <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateTask(t.id, { scheduled_start: null })}>Sans heure</Button>}
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateTask(t.id, { scheduled_date: null, scheduled_start: null })}><X className="h-3 w-3 mr-1" />Retirer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/taches/${t.id}`)}><ExternalLink className="h-3 w-3" /></Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const LoadBar = ({ d, big }: { d: Date; big?: boolean }) => {
    const l = dayLoad(d);
    const pct = Math.min(100, (l.minutes / CAPACITY) * 100);
    const over = l.minutes > CAPACITY;
    const cats = [...l.bs.map((b) => ({ c: b.category, m: b.duration_minutes })), ...l.ts.filter((t) => t.estimated_minutes).map((t) => ({ c: taskCategory(t), m: t.estimated_minutes }))];
    return (
      <div className="space-y-1">
        <div className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", big && "h-2")}>
          {cats.map((x, i) => <div key={i} style={{ width: `${(x.m / Math.max(CAPACITY, l.minutes)) * 100}%`, background: catVar(x.c) }} />)}
        </div>
        <div className={cn("flex justify-between text-[10px]", over ? "text-destructive font-semibold" : "text-muted-foreground")}>
          <span>{fmtDur(l.minutes)}{l.noEstimate ? ` +${l.noEstimate} libre${l.noEstimate > 1 ? "s" : ""}` : ""}</span>
          {big && <span>{Math.round(pct)}% de 8h</span>}
        </div>
      </div>
    );
  };

  // ---------- Time grid (day / week) ----------
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const renderGrid = () => (
    <Card className="overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* headers */}
        <div className="border-b" />
        {days.map((d) => {
          const isToday = ymd(d) === ymd(new Date());
          return (
            <div key={ymd(d)} className={cn("border-b border-l px-2 py-2 space-y-1.5", isToday && "bg-accent/5")}>
              <button className="flex items-baseline gap-1.5" onClick={() => { setAnchor(d); setView("day"); }}>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
                <span className={cn("text-lg font-semibold leading-none", isToday && "rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-base")}>{d.getDate()}</span>
              </button>
              <LoadBar d={d} big={view === "day"} />
            </div>
          );
        })}
        {/* all-day row */}
        <div className="border-b text-[10px] text-muted-foreground px-1 pt-2 text-right">Journée</div>
        {days.map((d) => {
          const key = `all-${ymd(d)}`;
          const list = (tasksByDay.get(ymd(d)) ?? []).filter((t) => !t.scheduled_start);
          return (
            <div key={key} onDragOver={allowDrop(key)} onDragLeave={clearDrag} onDrop={(e) => onDrop(e, d, null)}
              className={cn("border-b border-l p-1 min-h-[56px] space-y-1 transition-colors", dragOver === key && "bg-accent/15 ring-2 ring-inset ring-accent/40")}>
              {list.map((t) => <TaskChip key={t.id} t={t} compact={view === "week"} />)}
              {list.length === 0 && <div className="text-[10px] text-muted-foreground/60 text-center pt-3">glisse ici</div>}
            </div>
          );
        })}
      </div>
      <div className="max-h-[70vh] overflow-y-auto" ref={(el) => { gridScrollRef.current = el; }} onDragLeave={clearDrag}>
        <div className="grid relative" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div>
            {hours.map((h) => <div key={h} style={{ height: HOUR_PX }} className="text-[10px] text-muted-foreground text-right pr-1.5 pt-0.5">{h}:00</div>)}
          </div>
          {days.map((d) => {
            const key = `grid-${ymd(d)}`;
            const events = [
              ...blocks.filter((b) => blockOccursOn(b, d)).map((b) => ({ kind: "block" as const, start: timeToMin(b.start_time), dur: b.duration_minutes, b })),
              ...(tasksByDay.get(ymd(d)) ?? []).filter((t) => t.scheduled_start).map((t) => ({ kind: "task" as const, start: timeToMin(t.scheduled_start), dur: t.estimated_minutes || 60, t })),
            ].sort((a, b) => a.start - b.start);
            // lane assignment
            const lanesEnd: number[] = [];
            const placed = events.map((ev) => {
              let lane = lanesEnd.findIndex((end) => end <= ev.start);
              if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(0); }
              lanesEnd[lane] = ev.start + ev.dur;
              return { ...ev, lane };
            });
            const laneCount = Math.max(1, lanesEnd.length);
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const isToday = ymd(d) === ymd(now);
            return (
              <div key={key} onDragOver={allowGridDrop(key)} onDragLeave={clearDrag} onDrop={(e) => dropOnGrid(e, d)}
                className={cn("relative border-l transition-colors", dragOver === key && "bg-accent/10")} style={{ height: hours.length * HOUR_PX }}>
                {dragHint?.key === key && (
                  <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: ((dragHint.min - START_H * 60) / 60) * HOUR_PX }}>
                    <div className="h-0.5 bg-accent" />
                    <div className="absolute right-1 -top-2.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground shadow">{minToTime(dragHint.min)}</div>
                  </div>
                )}
                {hours.map((h, i) => <div key={h} className={cn("absolute inset-x-0 border-t", i % 1 === 0 && "border-border/60")} style={{ top: i * HOUR_PX }} />)}
                {placed.map((ev) => {
                  const top = ((ev.start - START_H * 60) / 60) * HOUR_PX;
                  const height = Math.max(22, (ev.dur / 60) * HOUR_PX - 2);
                  const style: React.CSSProperties = { position: "absolute", top, height, left: `calc(${(ev.lane / laneCount) * 100}% + 2px)`, width: `calc(${100 / laneCount}% - 4px)` };
                  if (ev.kind === "block") {
                    const b = ev.b;
                    return (
                      <button key={`b-${b.id}`} onClick={() => openEditBlock(b)} style={{
                        ...style,
                        background: `repeating-linear-gradient(135deg, ${catBg(b.category, 0.1)} 0 6px, ${catBg(b.category, 0.2)} 6px 12px)`,
                        borderColor: catVar(b.category),
                      }} className="rounded-md border border-dashed px-2 py-1 text-left overflow-hidden hover:brightness-95">
                        <div className="flex items-center gap-1 text-xs font-medium truncate text-foreground"><Repeat className="h-3 w-3 shrink-0" style={{ color: catVar(b.category) }} />{b.title}</div>
                        {height > 34 && <div className="text-[10px] text-muted-foreground">{b.start_time.slice(0, 5)} · {fmtDur(b.duration_minutes)}</div>}
                      </button>
                    );
                  }
                  return <TaskChip key={`t-${ev.t.id}`} t={ev.t} style={style} compact={height < 34} />;
                })}
                {isToday && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
                  <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
                    <div className="h-0.5 bg-destructive" /><div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );

  // ---------- Month ----------
  const renderMonth = () => (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b text-[11px] uppercase tracking-wider text-muted-foreground">
        {DAY_NAMES.map((d) => <div key={d} className="px-2 py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {monthCells.map((d, i) => {
          const key = `m-${ymd(d)}`;
          const l = dayLoad(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = ymd(d) === ymd(new Date());
          return (
            <div key={key} onDragOver={allowDrop(key)} onDragLeave={clearDrag} onDrop={(e) => onDrop(e, d, null)}
              className={cn("min-h-[120px] border-b border-r p-1.5 space-y-1 transition-colors", !inMonth && "bg-muted/30 opacity-60", (i + 1) % 7 === 0 && "border-r-0", dragOver === key && "bg-accent/15 ring-2 ring-inset ring-accent/40")}>
              <div className="flex items-center justify-between">
                <button onClick={() => { setAnchor(d); setView("day"); }} className={cn("text-xs font-semibold px-1.5 rounded", isToday && "bg-accent text-accent-foreground")}>{d.getDate()}</button>
                <div className="flex gap-0.5">{l.bs.slice(0, 4).map((b) => <span key={b.id} className="h-1.5 w-1.5 rounded-full" style={{ background: catVar(b.category) }} title={b.title} />)}</div>
              </div>
              {l.ts.slice(0, 4).map((t) => <TaskChip key={t.id} t={t} compact />)}
              {l.ts.length > 4 && <div className="text-[10px] text-muted-foreground px-1">+{l.ts.length - 4} tâches</div>}
              {(l.minutes > 0 || l.count > 0) && <LoadBar d={d} />}
            </div>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1800px] mx-auto">
      <PageHeader
        title="Agenda"
        description={view === "month" ? `${backlog.length} tâche${backlog.length > 1 ? "s" : ""} à programmer` : `Charge planifiée : ${fmtDur(weekTotal)} · ${backlog.length} à programmer`}
        actions={<Button size="sm" onClick={openNewBlock}><Repeat className="h-4 w-4 mr-1" /> Période récurrente</Button>}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Button key={v} size="sm" variant={view === v ? "secondary" : "ghost"} className="h-7 px-3" onClick={() => setView(v)}>
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d); }}>Aujourd'hui</Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="text-lg font-semibold capitalize">{title}</div>
        <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: catVar(k) }} />{v}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className={cn("p-3 h-fit lg:sticky lg:top-4 space-y-2 transition-colors", dragOver === "backlog" && "ring-2 ring-accent/40 bg-accent/5")}
          onDragOver={allowDrop("backlog")} onDragLeave={clearDrag}
          onDrop={(e) => { e.preventDefault(); clearDrag(); const id = e.dataTransfer.getData("text/task"); if (id) updateTask(id, { scheduled_date: null, scheduled_start: null }); }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">À programmer</h2>
            <span className="text-xs text-muted-foreground">{backlog.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="h-8 pl-7 text-xs" />
          </div>
          <p className="text-[11px] text-muted-foreground">Glisse une tâche sur un jour ou une heure. Remets-la ici pour la déprogrammer.</p>
          <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-1">
            {backlog.map((t) => {
              const cat = taskCategory(t);
              return (
                <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
                  style={{ borderLeftColor: catVar(cat), background: catBg(cat, 0.08) }}
                  className="flex items-start gap-1.5 rounded-md border border-l-4 px-2 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-sm">
                  <GripVertical className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{t.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {CATEGORY_LABEL[cat]}{t.clients?.name ? ` · ${t.clients.name}` : ""}
                      {t.deadline ? ` · ⏰ ${new Date(t.deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {backlog.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Tout est programmé 🎉</div>}
          </div>
        </Card>

        <div className="min-w-0">{view === "month" ? renderMonth() : renderGrid()}</div>
      </div>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingBlock ? "Modifier la période" : "Nouvelle période récurrente"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input value={bForm.title} onChange={(e) => setBForm({ ...bForm, title: e.target.value })} placeholder="Ex. Comptabilité" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie</Label>
              <Select value={bForm.category} onValueChange={(v) => setBForm({ ...bForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: catVar(k) }} />{v}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Répétition</Label>
              <Select value={bForm.recurrence} onValueChange={(v: any) => setBForm({ ...bForm, recurrence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Tous les jours</SelectItem>
                  <SelectItem value="weekdays">Jours choisis</SelectItem>
                  <SelectItem value="weekly">Chaque semaine</SelectItem>
                  <SelectItem value="monthly">Chaque mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bForm.recurrence === "weekdays" && (
              <div className="col-span-2 flex gap-1">
                {DAY_NAMES.map((n, i) => {
                  const on = bForm.weekdays.includes(i + 1);
                  return <Button key={n} type="button" size="sm" variant={on ? "default" : "outline"} className="h-8 flex-1 px-0 text-xs"
                    onClick={() => setBForm({ ...bForm, weekdays: on ? bForm.weekdays.filter((x) => x !== i + 1) : [...bForm.weekdays, i + 1] })}>{n}</Button>;
                })}
              </div>
            )}
            {bForm.recurrence === "monthly" && (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Jour du mois</Label>
                <Input type="number" min={1} max={31} value={bForm.month_day ?? parseYmd(bForm.start_date).getDate()} onChange={(e) => setBForm({ ...bForm, month_day: Number(e.target.value) || null })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Heure de début</Label>
              <Input type="time" value={bForm.start_time} onChange={(e) => setBForm({ ...bForm, start_time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Durée</Label>
              <Select value={String(bForm.duration_minutes)} onValueChange={(v) => setBForm({ ...bForm, duration_minutes: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[15, 30, 45, 60, 90, 120, 180, 240].map((m) => <SelectItem key={m} value={String(m)}>{fmtDur(m)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{bForm.recurrence === "weekly" ? "À partir du (définit le jour)" : "À partir du"}</Label>
              <Input type="date" value={bForm.start_date} onChange={(e) => setBForm({ ...bForm, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Jusqu'au (facultatif)</Label>
              <Input type="date" value={bForm.end_date ?? ""} onChange={(e) => setBForm({ ...bForm, end_date: e.target.value || null })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={bForm.notes ?? ""} onChange={(e) => setBForm({ ...bForm, notes: e.target.value || null })} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>{editingBlock && <Button variant="destructive" size="sm" onClick={deleteBlock}>Supprimer</Button>}</div>
            <Button onClick={saveBlock}><Plus className="h-4 w-4 mr-1" />{editingBlock ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
