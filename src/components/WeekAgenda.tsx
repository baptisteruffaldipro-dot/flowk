import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronLeft, ChevronRight, FolderKanban, ListChecks } from "lucide-react";

type Item = {
  id: string;
  kind: "task" | "project";
  title: string;
  date: string;
  past: boolean;
  client?: string | null;
  href: string;
};

export default function WeekAgenda() {
  const [items, setItems] = useState<Item[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  useEffect(() => {
    (async () => {
      const [tasks, projects] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,delivered_at,deadline,status,client_id,project_id,clients(name),projects(name)"),
        supabase
          .from("projects")
          .select("id,name,deadline,created_at,archived,client_id,clients(name)"),
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
        });
      });
      setItems(list);
    })();
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

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

  return (
    <Card className="p-5">
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
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  return x;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}