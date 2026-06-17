import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Target, Trophy, TrendingUp, Calendar, FolderKanban, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

export default function GoalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState<any>(null);
  const [subgoals, setSubgoals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [newSub, setNewSub] = useState("");

  const load = async () => {
    if (!id) return;
    const [g, s, gt, gp] = await Promise.all([
      supabase.from("goals").select("*").eq("id", id).single(),
      supabase.from("subgoals").select("*").eq("goal_id", id).order("position"),
      supabase.from("goal_tasks").select("task_id,tasks(id,title,status,updated_at,deadline,clients(name))").eq("goal_id", id),
      supabase.from("goal_projects").select("project_id,projects(id,name,archived,updated_at,deadline,clients(name))").eq("goal_id", id),
    ]);
    setGoal(g.data);
    setSubgoals(s.data ?? []);
    setTasks(((gt.data as any) ?? []).map((r: any) => r.tasks).filter(Boolean));
    setProjects(((gp.data as any) ?? []).map((r: any) => r.projects).filter(Boolean));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const stats = useMemo(() => {
    const items: { done: boolean; date: string | null }[] = [];
    subgoals.forEach((s) => items.push({ done: s.done, date: s.done_at }));
    tasks.forEach((t) => items.push({ done: t.status === "archive", date: t.status === "archive" ? t.updated_at : null }));
    projects.forEach((p) => items.push({ done: !!p.archived, date: p.archived ? p.updated_at : null }));
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { items, total, done, pct };
  }, [subgoals, tasks, projects]);

  const chartData = useMemo(() => {
    const done = stats.items.filter((i) => i.done && i.date).map((i) => new Date(i.date!));
    if (done.length === 0) {
      const today = new Date();
      return [
        { date: new Date(today.getTime() - 7 * 86400000).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), value: 0, pct: 0 },
        { date: today.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), value: 0, pct: 0 },
      ];
    }
    done.sort((a, b) => a.getTime() - b.getTime());
    const start = done[0];
    const end = goal?.deadline ? new Date(goal.deadline) : new Date();
    const points: { date: string; value: number; pct: number }[] = [];
    const day = 86400000;
    const cursor = new Date(start.getTime() - day);
    let cumul = 0;
    points.push({ date: cursor.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), value: 0, pct: 0 });
    const lastDate = new Date(Math.max(end.getTime(), done[done.length - 1].getTime()));
    for (let t = start.getTime(); t <= lastDate.getTime(); t += day) {
      const d = new Date(t);
      const todayDone = done.filter((x) => x.toDateString() === d.toDateString()).length;
      if (todayDone > 0) {
        cumul += todayDone;
        points.push({
          date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          value: cumul,
          pct: stats.total ? Math.round((cumul / stats.total) * 100) : 0,
        });
      }
    }
    points.push({
      date: lastDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      value: cumul,
      pct: stats.total ? Math.round((cumul / stats.total) * 100) : 0,
    });
    return points;
  }, [stats, goal]);

  const addSub = async () => {
    const title = newSub.trim();
    if (!title || !id) return;
    const { error } = await supabase.from("subgoals").insert({ goal_id: id, title, position: subgoals.length });
    if (error) return toast.error(error.message);
    setNewSub("");
    load();
  };

  const toggleSub = async (s: any) => {
    await supabase.from("subgoals").update({ done: !s.done, done_at: !s.done ? new Date().toISOString() : null }).eq("id", s.id);
    load();
  };

  const removeSub = async (sid: string) => {
    await supabase.from("subgoals").delete().eq("id", sid);
    load();
  };

  const updateGoal = async (patch: any) => {
    if (!id) return;
    await supabase.from("goals").update(patch).eq("id", id);
    load();
  };

  const removeGoal = async () => {
    if (!id || !confirm("Supprimer cet objectif ?")) return;
    await supabase.from("goals").delete().eq("id", id);
    toast.success("Objectif supprimé");
    navigate("/objectifs");
  };

  if (!goal) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const color = goal.color ?? "#6366f1";
  const reached = stats.pct === 100 && stats.total > 0;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <Link to="/objectifs" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Tous les objectifs
      </Link>
      <PageHeader
        title={goal.title}
        description={goal.description ?? undefined}
        actions={
          <Button size="sm" variant="ghost" onClick={removeGoal} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground mb-1">Progression</div>
          <div className="text-3xl font-bold" style={{ color }}>{stats.pct}%</div>
          <Progress value={stats.pct} className="h-2 mt-3" />
          <div className="text-xs text-muted-foreground mt-2">{stats.done} / {stats.total} terminé{stats.done > 1 ? "s" : ""}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Échéance</div>
          <Input
            type="date"
            value={goal.deadline ?? ""}
            onChange={(e) => updateGoal({ deadline: e.target.value || null })}
            className="h-9 text-sm"
          />
          {goal.deadline && <div className="text-xs text-muted-foreground mt-2">{fmtDate(goal.deadline)}</div>}
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Élan</div>
          <div className="text-3xl font-bold">{stats.done}</div>
          <div className="text-xs text-muted-foreground mt-2">étape{stats.done > 1 ? "s" : ""} accomplie{stats.done > 1 ? "s" : ""}</div>
          {reached && <div className="mt-2 text-sm font-semibold text-emerald-600">🎉 Bravo, objectif atteint !</div>}
        </Card>
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Courbe de progression</h2>
          <span className="text-xs text-muted-foreground">% accompli dans le temps</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="goalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="%" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`${v}%`, "Progression"]}
              />
              <Area type="monotone" dataKey="pct" stroke={color} strokeWidth={2.5} fill="url(#goalGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold mb-3">Sous-objectifs</h2>
          <div className="space-y-1.5 mb-3">
            {subgoals.length === 0 && <div className="text-xs text-muted-foreground italic">Aucun sous-objectif</div>}
            {subgoals.map((s) => (
              <div key={s.id} className="flex items-center gap-2 group">
                <Checkbox checked={s.done} onCheckedChange={() => toggleSub(s)} />
                <span className={`flex-1 text-sm ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</span>
                <button onClick={() => removeSub(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ajouter un sous-objectif"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSub()}
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={addSub}><Plus className="h-4 w-4" /></Button>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Projets liés ({projects.length})</h2>
              {projects.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Aucun projet lié. Ajoute cet objectif depuis la fiche d'un projet.</div>
              ) : (
                <div className="space-y-1">
                  {projects.map((p) => (
                    <Link key={p.id} to={`/projets/${p.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm">
                      <Checkbox checked={!!p.archived} disabled />
                      <span className={`flex-1 truncate ${p.archived ? "line-through text-muted-foreground" : ""}`}>{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.clients?.name ?? ""}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><ListChecks className="h-4 w-4" /> Tâches liées ({tasks.length})</h2>
              {tasks.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Aucune tâche liée. Ajoute cet objectif depuis la fiche d'une tâche.</div>
              ) : (
                <div className="space-y-1">
                  {tasks.map((t) => (
                    <Link key={t.id} to={`/taches/${t.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm">
                      <Checkbox checked={t.status === "archive"} disabled />
                      <span className={`flex-1 truncate ${t.status === "archive" ? "line-through text-muted-foreground" : ""}`}>{t.title || "Sans titre"}</span>
                      <span className="text-xs text-muted-foreground">{t.clients?.name ?? ""}</span>
                      {t.deadline && <Badge variant="outline" className="text-[10px]">{fmtDate(t.deadline)}</Badge>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-4">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={goal.description ?? ""}
          onChange={(e) => setGoal({ ...goal, description: e.target.value })}
          onBlur={() => updateGoal({ description: goal.description })}
          rows={3}
          className="mt-1.5"
          placeholder="Pourquoi cet objectif est important pour toi…"
        />
      </Card>
    </div>
  );
}