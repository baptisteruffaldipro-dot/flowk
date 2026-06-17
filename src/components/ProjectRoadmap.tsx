import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown, ListChecks, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Phase = {
  id: string;
  project_id: string;
  title: string;
  objective: string | null;
  position: number;
  collapsed: boolean;
};
type Action = {
  id: string;
  phase_id: string;
  label: string;
  done: boolean;
  position: number;
  task_id: string | null;
};

const TEMPLATE_LAUNCH: { title: string; objective: string; actions: string[] }[] = [
  { title: "Phase 1 — Cadrage & fondations", objective: "Poser des bases solides sans produire trop tôt.", actions: ["Valider le nom commercial", "Valider le positionnement", "Définir l'offre V1"] },
  { title: "Phase 2 — Identité & crédibilité", objective: "Être crédible immédiatement.", actions: ["Identité graphique", "Univers visuel", "Plaquette commerciale", "Déclinaisons (carte, flyer)"] },
  { title: "Phase 3 — Preuve technologique", objective: "Prouver que ça marche vraiment.", actions: ["Prototype fonctionnel", "Démo / test", "Valider l'expérience utilisateur"] },
  { title: "Phase 4 — Écosystème web", objective: "Avoir une présence pro.", actions: ["Site vitrine", "Pages d'offres", "Contact / démo"] },
  { title: "Phase 5 — Stratégie de lancement", objective: "Obtenir les premiers clients tests.", actions: ["Liste de prospects", "Pitch 30s", "Calendrier de posts"] },
  { title: "Phase 6 — Lancement & itérations", objective: "Tester, ajuster, améliorer.", actions: ["Installation pilote", "Collecte des retours", "Étude de cas"] },
];

const DONE_STATUSES = new Set(["envoye", "a_facturer", "facture_envoyee", "payee", "archive"]);

export default function ProjectRoadmap({ projectId, clientId }: { projectId: string; clientId: string | null }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [tasksById, setTasksById] = useState<Record<string, { id: string; title: string; status: string }>>({});
  const [loading, setLoading] = useState(true);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: ph } = await supabase.from("project_phases").select("*").eq("project_id", projectId).order("position");
    const phasesData = (ph ?? []) as Phase[];
    setPhases(phasesData);
    const phaseIds = phasesData.map((p) => p.id);
    if (phaseIds.length) {
      const { data: ac } = await supabase.from("phase_actions").select("*").in("phase_id", phaseIds).order("position");
      const actData = (ac ?? []) as Action[];
      setActions(actData);
      const taskIds = actData.map((a) => a.task_id).filter(Boolean) as string[];
      if (taskIds.length) {
        const { data: ts } = await supabase.from("tasks").select("id,title,status").in("id", taskIds);
        const map: Record<string, any> = {};
        (ts ?? []).forEach((t: any) => { map[t.id] = t; });
        setTasksById(map);
        // Auto-sync: action.done reflects task done-state
        for (const a of actData) {
          if (a.task_id && map[a.task_id]) {
            const expected = DONE_STATUSES.has(map[a.task_id].status);
            if (expected !== a.done) {
              await supabase.from("phase_actions").update({ done: expected }).eq("id", a.id);
              a.done = expected;
            }
          }
        }
        setActions([...actData]);
      } else {
        setTasksById({});
      }
    } else {
      setActions([]);
      setTasksById({});
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const addPhase = async (title?: string, objective?: string) => {
    const t = (title ?? newPhaseTitle).trim();
    if (!t) return;
    const pos = phases.length;
    const { error } = await supabase.from("project_phases").insert({ project_id: projectId, title: t, objective: objective ?? null, position: pos });
    if (error) return toast.error(error.message);
    setNewPhaseTitle("");
    load();
  };

  const applyTemplate = async () => {
    for (let i = 0; i < TEMPLATE_LAUNCH.length; i++) {
      const tpl = TEMPLATE_LAUNCH[i];
      const { data: ph } = await supabase
        .from("project_phases")
        .insert({ project_id: projectId, title: tpl.title, objective: tpl.objective, position: phases.length + i })
        .select()
        .single();
      if (ph) {
        await supabase.from("phase_actions").insert(
          tpl.actions.map((label, j) => ({ phase_id: ph.id, label, position: j }))
        );
      }
    }
    toast.success("Template appliqué");
    load();
  };

  const updatePhase = async (id: string, patch: Partial<Phase>) => {
    setPhases((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("project_phases").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deletePhase = async (id: string) => {
    if (!confirm("Supprimer cette phase et ses actions ?")) return;
    const { error } = await supabase.from("project_phases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const movePhase = async (id: string, dir: -1 | 1) => {
    const sorted = [...phases].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((p) => p.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("project_phases").update({ position: swap.position }).eq("id", id),
      supabase.from("project_phases").update({ position: sorted[idx].position }).eq("id", swap.id),
    ]);
    load();
  };

  const addAction = async (phaseId: string, label: string) => {
    const l = label.trim();
    if (!l) return;
    const pos = actions.filter((a) => a.phase_id === phaseId).length;
    const { error } = await supabase.from("phase_actions").insert({ phase_id: phaseId, label: l, position: pos });
    if (error) return toast.error(error.message);
    load();
  };

  const updateAction = async (id: string, patch: Partial<Action>) => {
    setActions((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from("phase_actions").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const toggleAction = async (a: Action) => {
    const next = !a.done;
    await updateAction(a.id, { done: next });
    if (a.task_id && tasksById[a.task_id]) {
      const newStatus = next ? "envoye" : "a_faire";
      await supabase.from("tasks").update({ status: newStatus }).eq("id", a.task_id);
      setTasksById({ ...tasksById, [a.task_id]: { ...tasksById[a.task_id], status: newStatus } });
    }
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from("phase_actions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const moveAction = async (id: string, dir: -1 | 1) => {
    const a = actions.find((x) => x.id === id);
    if (!a) return;
    const siblings = actions.filter((x) => x.phase_id === a.phase_id).sort((x, y) => x.position - y.position);
    const idx = siblings.findIndex((x) => x.id === id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("phase_actions").update({ position: swap.position }).eq("id", id),
      supabase.from("phase_actions").update({ position: a.position }).eq("id", swap.id),
    ]);
    load();
  };

  const promoteToTask = async (a: Action) => {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title: a.label, project_id: projectId, client_id: clientId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await supabase.from("phase_actions").update({ task_id: data.id }).eq("id", a.id);
    toast.success("Tâche créée");
    load();
  };

  const phaseProgress = (phaseId: string) => {
    const arr = actions.filter((a) => a.phase_id === phaseId);
    if (!arr.length) return { done: 0, total: 0, pct: 0 };
    const done = arr.filter((a) => a.done).length;
    return { done, total: arr.length, pct: Math.round((done / arr.length) * 100) };
  };
  const totalDone = actions.filter((a) => a.done).length;
  const totalPct = actions.length ? Math.round((totalDone / actions.length) * 100) : 0;

  const phaseDotColor = (pct: number) => {
    if (pct === 100) return "bg-emerald-500";
    if (pct > 0) return "bg-amber-500";
    return "bg-muted-foreground/40";
  };

  if (loading) return null;

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Roadmap</h2>
        </div>
        {actions.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{totalDone}/{actions.length} · {totalPct}%</span>
        )}
      </div>
      {actions.length > 0 && <Progress value={totalPct} className="h-1.5 mb-4" />}

      {phases.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-muted-foreground">Aucune phase. Crée ta première phase ou utilise un template.</p>
          <div className="flex items-center gap-2 justify-center max-w-md mx-auto">
            <Input
              placeholder="Phase 1 — Cadrage…"
              value={newPhaseTitle}
              onChange={(e) => setNewPhaseTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addPhase(); }}
            />
            <Button size="sm" onClick={() => addPhase()}><Plus className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" variant="outline" onClick={applyTemplate}>Utiliser le template lancement (6 phases)</Button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-3">
            {[...phases].sort((a, b) => a.position - b.position).map((phase, i, arr) => {
              const { done, total, pct } = phaseProgress(phase.id);
              const phaseActions = actions.filter((a) => a.phase_id === phase.id).sort((a, b) => a.position - b.position);
              return (
                <div key={phase.id} className="relative pl-7">
                  <span className={`absolute left-0 top-2 h-[15px] w-[15px] rounded-full border-2 border-background ${phaseDotColor(pct)}`} />
                  <div className="flex items-start gap-2">
                    <button onClick={() => updatePhase(phase.id, { collapsed: !phase.collapsed })} className="mt-1 text-muted-foreground hover:text-foreground">
                      {phase.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Input
                          value={phase.title}
                          onChange={(e) => setPhases((ps) => ps.map((p) => p.id === phase.id ? { ...p, title: e.target.value } : p))}
                          onBlur={(e) => updatePhase(phase.id, { title: e.target.value })}
                          className="h-7 text-sm font-medium border-transparent hover:border-input focus:border-input px-2"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{done}/{total} · {pct}%</span>
                        <div className="flex items-center shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => movePhase(phase.id, -1)}><ArrowUp className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === arr.length - 1} onClick={() => movePhase(phase.id, 1)}><ArrowDown className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deletePhase(phase.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      {!phase.collapsed && (
                        <>
                          <Textarea
                            value={phase.objective ?? ""}
                            onChange={(e) => setPhases((ps) => ps.map((p) => p.id === phase.id ? { ...p, objective: e.target.value } : p))}
                            onBlur={(e) => updatePhase(phase.id, { objective: e.target.value })}
                            placeholder="🎯 Objectif de la phase…"
                            rows={1}
                            className="mt-1 text-xs text-muted-foreground border-transparent hover:border-input focus:border-input resize-none min-h-0 py-1 px-2"
                          />
                          <Progress value={pct} className="h-1 mt-2 mb-2" />
                          <div className="space-y-0.5">
                            {phaseActions.map((a, ai) => (
                              <ActionRow
                                key={a.id}
                                action={a}
                                task={a.task_id ? tasksById[a.task_id] : undefined}
                                onToggle={() => toggleAction(a)}
                                onLabelChange={(label) => updateAction(a.id, { label })}
                                onDelete={() => deleteAction(a.id)}
                                onPromote={() => promoteToTask(a)}
                                onMoveUp={ai > 0 ? () => moveAction(a.id, -1) : undefined}
                                onMoveDown={ai < phaseActions.length - 1 ? () => moveAction(a.id, 1) : undefined}
                              />
                            ))}
                            <AddActionRow onAdd={(label) => addAction(phase.id, label)} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="relative pl-7 pt-1">
              <span className="absolute left-0 top-3 h-[15px] w-[15px] rounded-full border-2 border-background bg-muted-foreground/20" />
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  placeholder="Nouvelle phase…"
                  value={newPhaseTitle}
                  onChange={(e) => setNewPhaseTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addPhase(); }}
                  className="h-8"
                />
                <Button size="sm" variant="outline" onClick={() => addPhase()}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ActionRow({ action, task, onToggle, onLabelChange, onDelete, onPromote, onMoveUp, onMoveDown }: {
  action: Action;
  task?: { id: string; title: string; status: string };
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  onPromote: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [label, setLabel] = useState(action.label);
  useEffect(() => setLabel(action.label), [action.label]);
  return (
    <div className="group flex items-center gap-2 py-1 rounded hover:bg-secondary/40 px-1">
      <Checkbox checked={action.done} onCheckedChange={onToggle} />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== action.label && onLabelChange(label)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`h-7 border-transparent hover:border-input focus:border-input px-2 text-sm ${action.done ? "line-through text-muted-foreground" : ""}`}
      />
      {task ? (
        <Link to={`/taches/${task.id}`} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 inline-flex items-center gap-0.5">
          <ExternalLink className="h-3 w-3" /> tâche
        </Link>
      ) : (
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100" onClick={onPromote}>
          → tâche
        </Button>
      )}
      <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100">
        {onMoveUp && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveUp}><ArrowUp className="h-3 w-3" /></Button>}
        {onMoveDown && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onMoveDown}><ArrowDown className="h-3 w-3" /></Button>}
        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function AddActionRow({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => { if (value.trim()) { onAdd(value); setValue(""); } };
  return (
    <div className="flex items-center gap-2 py-1 px-1">
      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        onBlur={submit}
        placeholder="Ajouter une action…"
        className="h-7 border-transparent hover:border-input focus:border-input px-2 text-sm"
      />
    </div>
  );
}