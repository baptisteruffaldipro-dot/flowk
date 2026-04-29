import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Play, Pause, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { STATUS_LABEL, PRESTATION_LABEL, PRIORITY_LABEL, fmtMinutes, fmtMoney, fmtDate } from "@/lib/format";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [newSub, setNewSub] = useState("");
  const [estimDialog, setEstimDialog] = useState(false);
  const [estimValue, setEstimValue] = useState<string>("");
  const [tick, setTick] = useState(0);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    const [t, s, e, c, p] = await Promise.all([
      supabase.from("tasks").select("*, clients(id,name), projects(id,name)").eq("id", id).maybeSingle(),
      supabase.from("subtasks").select("*").eq("task_id", id).order("position"),
      supabase.from("time_entries").select("*").eq("task_id", id).order("started_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id").order("name"),
    ]);
    setTask(t.data);
    setSubtasks(s.data ?? []);
    setEntries(e.data ?? []);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  // Tick every second when timer is running
  useEffect(() => {
    if (!task?.timer_started_at) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [task?.timer_started_at]);

  const liveSeconds = useMemo(() => {
    if (!task?.timer_started_at) return 0;
    return Math.floor((Date.now() - new Date(task.timer_started_at).getTime()) / 1000);
  }, [task?.timer_started_at, tick]);

  const liveMinutes = Math.floor(liveSeconds / 60);
  const totalMinutesLive = (task?.total_minutes ?? 0) + liveMinutes;

  const askEstimAndStart = () => {
    setEstimValue(String(task?.estimated_minutes ?? 0));
    setEstimDialog(true);
  };

  const confirmStart = async () => {
    const est = Number(estimValue) || 0;
    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({ estimated_minutes: est, timer_started_at: startedAt })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("time_entries").insert({
      task_id: id, started_at: startedAt, estimated_minutes_at_start: est,
    });
    setEstimDialog(false);
    toast.success("Timer démarré");
    load();
  };

  const stopTimer = async () => {
    if (!task?.timer_started_at) return;
    const startedAt = task.timer_started_at;
    const endedAt = new Date().toISOString();
    const dur = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
    const newTotal = (task.total_minutes ?? 0) + dur;
    const { error } = await supabase.from("tasks").update({ timer_started_at: null, total_minutes: newTotal }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase
      .from("time_entries")
      .update({ ended_at: endedAt, duration_minutes: dur })
      .eq("task_id", id)
      .is("ended_at", null);
    const diff = newTotal - (task.estimated_minutes ?? 0);
    toast.success(`Timer arrêté — ${fmtMinutes(dur)} ajouté${diff > 0 ? ` (dépassement: ${fmtMinutes(diff)})` : ""}`);
    load();
  };

  const updateField = async (patch: any) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addSubtask = async () => {
    if (!newSub.trim()) return;
    const { error } = await supabase.from("subtasks").insert({ task_id: id, title: newSub.trim(), position: subtasks.length });
    if (error) return toast.error(error.message);
    setNewSub("");
    load();
  };

  const toggleSub = async (s: any) => {
    await supabase.from("subtasks").update({ done: !s.done }).eq("id", s.id);
    load();
  };

  const removeSub = async (id2: string) => {
    await supabase.from("subtasks").delete().eq("id", id2);
    load();
  };

  const deleteTask = async () => {
    if (!id) return;
    await supabase.from("subtasks").delete().eq("task_id", id);
    await supabase.from("time_entries").delete().eq("task_id", id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tâche supprimée");
    navigate("/taches");
  };

  const computeAmount = () => {
    if (!task) return null;
    if (task.billing_type === "forfait") return task.flat_amount ? Number(task.flat_amount) : null;
    if (!task.hourly_rate) return null;
    return (totalMinutesLive / 60) * Number(task.hourly_rate);
  };

  if (!task) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const running = !!task.timer_started_at;
  const filteredProjects = projects.filter((p) => !task.client_id || p.client_id === task.client_id);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to="/taches" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Tâches
      </Link>
      <PageHeader
        title="Tâche"
        description={`${task.clients?.name ?? "Sans client"} • ${PRESTATION_LABEL[task.prestation] ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            {running ? (
              <Button onClick={stopTimer} variant="destructive" size="sm" className="gap-2">
                <Pause className="h-4 w-4" /> Stop ({fmtMinutes(totalMinutesLive)})
              </Button>
            ) : (
              <Button onClick={askEstimAndStart} size="sm" className="gap-2">
                <Play className="h-4 w-4" /> Démarrer
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est définitive. Sous-tâches et historique du timer seront aussi supprimés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Card className="p-4 mb-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Titre</Label>
          <Input
            value={task.title ?? ""}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            onBlur={() => updateField({ title: task.title })}
            className="text-base font-semibold"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Client</Label>
            <Select
              value={task.client_id ?? ""}
              onValueChange={(v) => updateField({ client_id: v, project_id: null })}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Projet</Label>
            <Select
              value={task.project_id ?? ""}
              onValueChange={(v) => updateField({ project_id: v })}
              disabled={!task.client_id}
            >
              <SelectTrigger><SelectValue placeholder={task.client_id ? "Sélectionner" : "Choisir un client d'abord"} /></SelectTrigger>
              <SelectContent>
                {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Statut</div>
          <Select value={task.status} onValueChange={(v) => updateField({ status: v })}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Priorité</div>
          <Select value={task.priority ?? "secondaire"} onValueChange={(v) => updateField({ priority: v })}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Prestation</div>
          <Select value={task.prestation} onValueChange={(v) => updateField({ prestation: v })}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRESTATION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Deadline</div>
          <Input type="date" value={task.deadline ?? ""} onChange={(e) => updateField({ deadline: e.target.value || null })} className="mt-2" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <StatBlock label="Temps estimé" value={fmtMinutes(task.estimated_minutes)} />
        <StatBlock label="Temps passé" value={fmtMinutes(totalMinutesLive)} highlight={running} />
        <StatBlock label="Montant" value={fmtMoney(computeAmount())} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Notes</h2>
          <Textarea
            value={task.notes ?? ""}
            onChange={(e) => setTask({ ...task, notes: e.target.value })}
            onBlur={() => updateField({ notes: task.notes })}
            rows={6}
            placeholder="Notes, brief, références…"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Retours clients</Label>
              <Input
                type="number"
                value={task.client_revisions_count}
                onChange={(e) => updateField({ client_revisions_count: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{task.billing_type === "horaire" ? "Taux/h (€)" : "Forfait (€)"}</Label>
              <Input
                type="number" step="0.01"
                value={(task.billing_type === "horaire" ? task.hourly_rate : task.flat_amount) ?? ""}
                onChange={(e) => updateField(task.billing_type === "horaire" ? { hourly_rate: Number(e.target.value) || null } : { flat_amount: Number(e.target.value) || null })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Sous-tâches</h2>
          <div className="space-y-1.5 mb-3">
            {subtasks.map((s) => (
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
              placeholder="Ajouter une sous-tâche"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
            />
            <Button size="sm" variant="outline" onClick={addSubtask}><Plus className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>

      {entries.length > 0 && (
        <Card className="p-5 mt-4">
          <h2 className="text-sm font-semibold mb-3">Historique du timer</h2>
          <div className="space-y-1 text-xs text-muted-foreground">
            {entries.slice(0, 10).map((e) => (
              <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span>{fmtDate(e.started_at)} • {new Date(e.started_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{e.duration_minutes ? fmtMinutes(e.duration_minutes) : <Badge variant="outline" className="text-[10px]">en cours</Badge>}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={estimDialog} onOpenChange={setEstimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Démarrer le timer</DialogTitle>
            <DialogDescription>
              Confirme ou ajuste le temps estimé pour cette session — utile pour comparer avec le temps réel ensuite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Temps estimé (minutes)</Label>
            <Input type="number" value={estimValue} onChange={(e) => setEstimValue(e.target.value)} autoFocus />
            <div className="text-xs text-muted-foreground">Déjà cumulé : {fmtMinutes(task.total_minutes)}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstimDialog(false)}>Annuler</Button>
            <Button onClick={confirmStart}><Play className="h-4 w-4 mr-1" /> Démarrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? "border-accent" : ""}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-semibold mt-2 ${highlight ? "text-accent" : ""}`}>{value}</div>
    </Card>
  );
}