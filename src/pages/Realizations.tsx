import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CalendarClock, FolderKanban, ListChecks, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/format";

type Item = {
  id: string;
  kind: "task" | "project";
  title: string;
  date: string; // ISO
  past: boolean;
  client?: string | null;
  href: string;
  meta?: string;
};

export default function Realizations() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  useEffect(() => {
    (async () => {
      const [tasks, projects] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,delivered_at,deadline,status,client_id,project_id,clients(name),projects(name)")
          .order("delivered_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id,name,deadline,created_at,archived,client_id,clients(name)")
          .order("deadline", { ascending: false }),
      ]);
      const now = new Date();
      const list: Item[] = [];
      (tasks.data ?? []).forEach((t: any) => {
        const date = t.delivered_at || t.deadline;
        if (!date) return;
        list.push({
          id: `t-${t.id}`,
          kind: "task",
          title: t.title,
          date,
          past: !!t.delivered_at || new Date(date) < now,
          client: t.clients?.name,
          href: `/taches/${t.id}`,
          meta: t.delivered_at ? "Livrée" : "Deadline",
        });
      });
      (projects.data ?? []).forEach((p: any) => {
        if (!p.deadline) return;
        list.push({
          id: `p-${p.id}`,
          kind: "project",
          title: p.name,
          date: p.deadline,
          past: !!p.archived || new Date(p.deadline) < now,
          client: p.clients?.name,
          href: `/projets/${p.id}`,
          meta: p.archived ? "Terminé" : "Livraison prévue",
        });
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItems(list);
      setLoading(false);
    })();
  }, []);

  const { upcoming, past } = useMemo(() => {
    const u: Item[] = [];
    const p: Item[] = [];
    items.forEach((i) => (i.past ? p.push(i) : u.push(i)));
    u.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { upcoming: u, past: p };
  }, [items]);

  const groupByMonth = (list: Item[]) => {
    const map = new Map<string, Item[]>();
    list.forEach((i) => {
      const d = new Date(i.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return Array.from(map.entries());
  };

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((i) => {
      const key = ymd(new Date(i.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return map;
  }, [items]);

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const weekLabel = (() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("fr-FR", opts);
    if (sameMonth) {
      return `${weekStart.getDate()} – ${end.getDate()} ${fmt(end, { month: "long", year: "numeric" })}`;
    }
    return `${fmt(weekStart, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  const renderGroup = (title: string, list: Item[], emptyMsg: string) => (
    <Card className="p-5 mb-4">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4" /> {title}
        <Badge variant="outline" className="ml-1 text-[10px]">{list.length}</Badge>
      </h2>
      {list.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">{emptyMsg}</div>
      ) : (
        <div className="space-y-6">
          {groupByMonth(list).map(([key, group]) => (
            <div key={key}>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 capitalize">
                {monthLabel(key)}
              </div>
              <div className="border-l border-border ml-2 pl-4 space-y-2">
                {group.map((i) => (
                  <Link
                    key={i.id}
                    to={i.href}
                    className="flex items-center gap-3 p-2.5 -ml-6 pl-6 rounded hover:bg-secondary/60 relative"
                  >
                    <span className="absolute left-[-5px] top-4 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-shrink-0">
                      {i.kind === "task" ? (
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{i.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {i.client ?? "Sans client"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(i.date)}</div>
                    <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                      {i.past && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      {i.meta}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <PageHeader
        title="Agenda des réalisations"
        description="Vue chronologique des tâches livrées et des projets terminés ou à venir"
      />
      {loading ? (
        <div className="text-sm text-muted-foreground p-8">Chargement…</div>
      ) : (
        <>
          <Card className="p-5 mb-4">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Vue semaine
            </h2>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => shiftWeek(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                    Aujourd'hui
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => shiftWeek(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-medium capitalize">{weekLabel}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                {weekDays.map((d) => {
                  const key = ymd(d);
                  const dayItems = itemsByDay.get(key) ?? [];
                  const isToday = ymd(new Date()) === key;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={key}
                      className={`rounded-md border min-h-[180px] flex flex-col ${isToday ? "border-primary bg-primary/5" : "border-border"} ${isWeekend && !isToday ? "bg-secondary/30" : ""}`}
                    >
                      <div className="px-2 py-1.5 border-b border-border flex items-center justify-between">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {d.toLocaleDateString("fr-FR", { weekday: "short" })}
                        </div>
                        <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
                      </div>
                      <div className="p-1.5 space-y-1 flex-1">
                        {dayItems.length === 0 ? (
                          <div className="text-[11px] text-muted-foreground/60 text-center py-2">—</div>
                        ) : dayItems.map((i) => (
                          <Link
                            key={i.id}
                            to={i.href}
                            className={`block p-1.5 rounded text-[11px] hover:opacity-80 ${i.past ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-foreground"}`}
                          >
                            <div className="flex items-center gap-1 font-medium truncate">
                              {i.kind === "task" ? <ListChecks className="h-3 w-3 shrink-0" /> : <FolderKanban className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{i.title}</span>
                            </div>
                            {i.client && <div className="truncate text-muted-foreground">{i.client}</div>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/40" /> À venir</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-secondary border border-border" /> Passé / livré</div>
              </div>
          </Card>
          {renderGroup("À venir", upcoming, "Aucune livraison à venir")}
          {renderGroup("Réalisations passées", past, "Aucune réalisation pour l'instant")}
        </>
      )}
    </div>
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=dim, 1=lun
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  return x;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}