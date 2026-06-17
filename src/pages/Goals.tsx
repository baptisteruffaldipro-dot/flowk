import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Target, Archive, ArchiveRestore, Trophy, Calendar } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

const PALETTE = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6"];

export default function Goals() {
  const [goals, setGoals] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, { done: number; total: number }>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", color: PALETTE[0] });

  const load = async () => {
    const { data } = await supabase
      .from("goals")
      .select("id,title,description,deadline,color,status,archived,created_at")
      .order("created_at", { ascending: false });
    const list = data ?? [];
    setGoals(list);
    if (list.length) {
      const ids = list.map((g) => g.id);
      const [subs, gt, gp] = await Promise.all([
        supabase.from("subgoals").select("goal_id,done").in("goal_id", ids),
        supabase.from("goal_tasks").select("goal_id,tasks(status)").in("goal_id", ids),
        supabase.from("goal_projects").select("goal_id,projects(archived)").in("goal_id", ids),
      ]);
      const map: Record<string, { done: number; total: number }> = {};
      ids.forEach((id) => (map[id] = { done: 0, total: 0 }));
      (subs.data ?? []).forEach((s: any) => { map[s.goal_id].total++; if (s.done) map[s.goal_id].done++; });
      (gt.data ?? []).forEach((s: any) => { map[s.goal_id].total++; if (s.tasks?.status === "archive") map[s.goal_id].done++; });
      (gp.data ?? []).forEach((s: any) => { map[s.goal_id].total++; if (s.projects?.archived) map[s.goal_id].done++; });
      setProgressMap(map);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    const { error } = await supabase.from("goals").insert({
      title: form.title.trim(),
      description: form.description || null,
      deadline: form.deadline || null,
      color: form.color,
    });
    if (error) return toast.error(error.message);
    toast.success("Objectif créé");
    setForm({ title: "", description: "", deadline: "", color: PALETTE[0] });
    setOpen(false);
    load();
  };

  const toggleArchive = async (g: any) => {
    await supabase.from("goals").update({ archived: !g.archived }).eq("id", g.id);
    load();
  };

  const visible = goals.filter((g) => (showArchived ? g.archived : !g.archived));

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Objectifs"
        description={`${visible.length} objectif${visible.length > 1 ? "s" : ""}${showArchived ? " archivé(s)" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Voir actifs" : "Voir archivés"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouvel objectif</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouvel objectif</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Titre *</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Échéance</Label>
                      <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Couleur</Label>
                      <div className="flex gap-1.5 pt-1.5">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm({ ...form, color: c })}
                            className={`h-6 w-6 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {visible.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Aucun objectif. Crée ton premier objectif pour suivre ta progression ! 🎯
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((g) => {
            const p = progressMap[g.id] ?? { done: 0, total: 0 };
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
            const reached = pct === 100 && p.total > 0;
            return (
              <Card key={g.id} className="p-5 hover:shadow-md transition relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: g.color ?? "#6366f1" }} />
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (g.color ?? "#6366f1") + "20", color: g.color ?? "#6366f1" }}>
                    {reached ? <Trophy className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/objectifs/${g.id}`} className="font-semibold text-base hover:underline block truncate">{g.title}</Link>
                    {g.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{g.description}</p>}
                  </div>
                  <button onClick={() => toggleArchive(g)} className="text-muted-foreground hover:text-foreground" title={g.archived ? "Restaurer" : "Archiver"}>
                    {g.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{p.done} / {p.total} terminé{p.done > 1 ? "s" : ""}</span>
                    <span className="font-semibold" style={{ color: g.color ?? "#6366f1" }}>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
                {g.deadline && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[11px] inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {fmtDate(g.deadline)}
                    </Badge>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}