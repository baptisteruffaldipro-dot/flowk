import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Entity = "task" | "project";

type Goal = { id: string; title: string; color: string | null };

export default function GoalsTagSelector({ entityType, entityId }: { entityType: Entity; entityId: string }) {
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const table = entityType === "task" ? "goal_tasks" : "goal_projects";
  const fk = entityType === "task" ? "task_id" : "project_id";

  const load = async () => {
    const [g, l] = await Promise.all([
      supabase.from("goals").select("id,title,color").eq("archived", false).order("created_at", { ascending: false }),
      supabase.from(table as any).select("goal_id").eq(fk, entityId),
    ]);
    setAllGoals((g.data as any) ?? []);
    setLinkedIds(new Set(((l.data as any) ?? []).map((r: any) => r.goal_id)));
  };

  useEffect(() => { if (entityId) load(); /* eslint-disable-next-line */ }, [entityId, entityType]);

  const toggle = async (goal: Goal) => {
    if (linkedIds.has(goal.id)) {
      const { error } = await supabase.from(table as any).delete().eq("goal_id", goal.id).eq(fk, entityId);
      if (error) return toast.error(error.message);
      const next = new Set(linkedIds); next.delete(goal.id); setLinkedIds(next);
    } else {
      const row: any = { goal_id: goal.id }; row[fk] = entityId;
      const { error } = await supabase.from(table as any).insert(row);
      if (error) return toast.error(error.message);
      setLinkedIds(new Set(linkedIds).add(goal.id));
    }
  };

  const createAndLink = async () => {
    const title = q.trim();
    if (!title) return;
    setCreating(true);
    const { data, error } = await supabase.from("goals").insert({ title }).select("id,title,color").single();
    setCreating(false);
    if (error || !data) return toast.error(error?.message ?? "Erreur");
    const row: any = { goal_id: data.id }; row[fk] = entityId;
    await supabase.from(table as any).insert(row);
    setAllGoals([data as any, ...allGoals]);
    setLinkedIds(new Set(linkedIds).add(data.id));
    setQ("");
    toast.success("Objectif créé");
  };

  const linked = allGoals.filter((g) => linkedIds.has(g.id));
  const filtered = q ? allGoals.filter((g) => g.title.toLowerCase().includes(q.toLowerCase())) : allGoals;
  const exactMatch = allGoals.some((g) => g.title.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {linked.map((g) => (
        <Badge
          key={g.id}
          variant="outline"
          className="text-[11px] font-medium px-2 py-0.5 gap-1 inline-flex items-center"
          style={{ borderColor: (g.color ?? "#6366f1") + "55", background: (g.color ?? "#6366f1") + "15", color: g.color ?? "#6366f1" }}
        >
          <Link to={`/objectifs/${g.id}`} className="inline-flex items-center gap-1 hover:underline">
            <Target className="h-3 w-3" /> {g.title}
          </Link>
          <button type="button" onClick={() => toggle(g)} className="hover:opacity-70" aria-label="Retirer">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 cursor-pointer hover:bg-accent border-dashed text-muted-foreground inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Objectif
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher ou créer…"
            className="h-8 text-xs mb-2"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent inline-flex items-center gap-2 ${linkedIds.has(g.id) ? "bg-accent/60 font-medium" : ""}`}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: g.color ?? "#6366f1" }} />
                <span className="flex-1 truncate">{g.title}</span>
                {linkedIds.has(g.id) && <span className="text-muted-foreground">✓</span>}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Aucun objectif</div>}
          </div>
          {q.trim() && !exactMatch && (
            <Button size="sm" variant="outline" className="w-full mt-2 h-8 text-xs" onClick={createAndLink} disabled={creating}>
              <Plus className="h-3 w-3 mr-1" /> Créer « {q.trim()} »
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}