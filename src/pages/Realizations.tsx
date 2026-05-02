import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CalendarClock, FolderKanban, ListChecks } from "lucide-react";
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
          {renderGroup("À venir", upcoming, "Aucune livraison à venir")}
          {renderGroup("Réalisations passées", past, "Aucune réalisation pour l'instant")}
        </>
      )}
    </div>
  );
}