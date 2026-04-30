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
import { computeTaskBilling } from "@/lib/billing";

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
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

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

  const createClient = async () => {
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: newClientName.trim(),
        email: newClientEmail.trim() || null,
        company: newClientCompany.trim() || null,
      })
      .select("id,name")
      .single();
    setCreatingClient(false);
    if (error || !data) {
      toast.error("Erreur lors de la création du client");
      return;
    }
    setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    await updateField({ client_id: data.id, project_id: null });
    setNewClientDialog(false);
    setNewClientName("");
    setNewClientEmail("");
    setNewClientCompany("");
    toast.success("Client créé");
  };

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

  const billing = useMemo(() => {
    if (!task) return null;
    return computeTaskBilling({
      billing_type: task.billing_type,
      flat_amount: task.flat_amount,
      hourly_rate: task.hourly_rate,
      estimated_minutes: task.estimated_minutes,
      total_minutes: totalMinutesLive,
      client_revisions_count: task.client_revisions_count,
      free_revisions: task.free_revisions,
      extra_revision_rate: task.extra_revision_rate,
    });
  }, [task, totalMinutesLive]);

  const invoiceAcompte = async () => {
    if (!task || !billing) return;
    if (task.acompte_invoiced) return toast.error("Acompte déjà facturé");
    if (billing.total <= 0) return toast.error("Renseigne un forfait ou un taux horaire");
    const { error } = await supabase.from("invoices").insert({
      client_id: task.client_id,
      task_id: task.id,
      label: `Acompte 50% — ${task.title}`,
      amount: Number(billing.acompte.toFixed(2)),
      status: "a_facturer",
    });
    if (error) return toast.error(error.message);
    await supabase.from("tasks").update({ acompte_invoiced: true }).eq("id", task.id);
    toast.success(`Acompte ${fmtMoney(billing.acompte)} ajouté à la facturation`);
    load();
  };

  const invoiceBalance = async (silent = false) => {
    if (!task || !billing) return;
    const acompteAmount = task.acompte_invoiced ? billing.acompte : 0;
    const balance = Number((billing.total - acompteAmount).toFixed(2));
    if (balance <= 0) {
      if (!silent) toast.error("Aucun solde à facturer");
      return;
    }
    // Évite les doublons : ne pas créer deux fois le solde pour la même tâche
    const { data: existing } = await supabase
      .from("invoices")
      .select("id,label")
      .eq("task_id", task.id)
      .ilike("label", "Solde%");
    if (existing && existing.length > 0) {
      if (!silent) toast.error("Solde déjà facturé");
      return;
    }
    const { error } = await supabase.from("invoices").insert({
      client_id: task.client_id,
      task_id: task.id,
      label: `Solde — ${task.title}`,
      amount: balance,
      status: "a_facturer",
    });
    if (error) return toast.error(error.message);
    if (!silent) toast.success(`Solde ${fmtMoney(balance)} ajouté à la facturation`);
    load();
  };

  // Auto-facturation du solde quand la tâche passe en "à facturer" (= livrée)
  const updateStatusWithAutoBalance = async (newStatus: string) => {
    const wasDelivered = task.status === "a_facturer" || task.status === "facturee" || task.status === "payee";
    await updateField({
      status: newStatus,
      delivered_at: newStatus === "a_facturer" && !task.delivered_at ? new Date().toISOString() : task.delivered_at,
    });
    if (newStatus === "a_facturer" && !wasDelivered) {
      // petit délai pour laisser load() rafraîchir, puis on tente le solde
      setTimeout(() => invoiceBalance(true), 400);
    }
  };

  if (!task) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const running = !!task.timer_started_at;
  const filteredProjects = projects.filter((p) => !task.client_id || p.client_id === task.client_id);

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
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
              onValueChange={(v) => {
                if (v === "__new__") {
                  setNewClientDialog(true);
                  return;
                }
                updateField({ client_id: v, project_id: null });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                <SelectItem value="__new__" className="text-primary font-medium">
                  + Nouveau client…
                </SelectItem>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Statut</div>
          <Select value={task.status} onValueChange={(v) => updateStatusWithAutoBalance(v)}>
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
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Deadline</div>
          <Input type="date" value={task.deadline ?? ""} onChange={(e) => updateField({ deadline: e.target.value || null })} className="mt-2" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Notes</h2>
          <Textarea
            value={task.notes ?? ""}
            onChange={(e) => setTask({ ...task, notes: e.target.value })}
            onBlur={() => updateField({ notes: task.notes })}
            rows={8}
            placeholder="Notes, brief, références…"
          />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <StatBlock label="Temps estimé" value={fmtMinutes(task.estimated_minutes)} />
        <StatBlock label="Temps passé" value={fmtMinutes(totalMinutesLive)} highlight={running} />
        <StatBlock label="Montant total" value={fmtMoney(billing?.total ?? null)} />
      </div>

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Facturation</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={invoiceAcompte} disabled={task.acompte_invoiced}>
              {task.acompte_invoiced ? "Acompte facturé" : `Facturer l'acompte (${fmtMoney(billing?.acompte ?? 0)})`}
            </Button>
            <Button size="sm" onClick={() => invoiceBalance(false)}>
              Facturer le solde
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Type de facturation</Label>
            <Select value={task.billing_type} onValueChange={(v) => updateField({ billing_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horaire">Horaire</SelectItem>
                <SelectItem value="forfait">Forfait (+ dépassement horaire)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {task.billing_type === "forfait" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Forfait (€)</Label>
              <Input
                type="number" step="0.01"
                value={task.flat_amount ?? ""}
                onChange={(e) => setTask({ ...task, flat_amount: e.target.value })}
                onBlur={() => updateField({ flat_amount: task.flat_amount === "" ? null : Number(task.flat_amount) })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Taux horaire (€) {task.billing_type === "forfait" && <span className="text-muted-foreground">— dépassement</span>}</Label>
            <Input
              type="number" step="0.01"
              value={task.hourly_rate ?? ""}
              onChange={(e) => setTask({ ...task, hourly_rate: e.target.value })}
              onBlur={() => updateField({ hourly_rate: task.hourly_rate === "" ? null : Number(task.hourly_rate) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Heures travaillées
              {Number(task.hourly_rate) > 0 && (
                <span className="text-muted-foreground"> — {fmtMoney(((task.total_minutes ?? 0) / 60) * Number(task.hourly_rate))}</span>
              )}
            </Label>
            <Input
              type="number" step="0.25" min="0"
              value={task.total_minutes != null ? (task.total_minutes / 60).toString() : ""}
              onChange={(e) => setTask({ ...task, total_minutes: e.target.value === "" ? 0 : Math.round(Number(e.target.value) * 60) })}
              onBlur={() => updateField({ total_minutes: task.total_minutes ?? 0 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Retours clients effectués</Label>
            <Input
              type="number"
              value={task.client_revisions_count ?? 0}
              onChange={(e) => updateField({ client_revisions_count: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Retours inclus (gratuits)</Label>
            <Input
              type="number"
              value={task.free_revisions ?? 0}
              onChange={(e) => updateField({ free_revisions: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tarif retour suppl. (€)</Label>
            <Input
              type="number" step="0.01"
              value={task.extra_revision_rate ?? ""}
              onChange={(e) => setTask({ ...task, extra_revision_rate: e.target.value })}
              onBlur={() => updateField({ extra_revision_rate: task.extra_revision_rate === "" ? null : Number(task.extra_revision_rate) })}
            />
          </div>
        </div>

        {billing && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1.5">
            <BillingRow label={task.billing_type === "forfait" ? "Forfait" : `Heures (${fmtMinutes(totalMinutesLive)})`} value={fmtMoney(billing.base)} />
            {billing.overrun > 0 && (
              <BillingRow label={`Dépassement horaire (${fmtMinutes(billing.overrunMinutes)})`} value={fmtMoney(billing.overrun)} muted />
            )}
            {billing.revisionsBilled > 0 && (
              <BillingRow label={`Retours suppl. (${billing.extraRevisions})`} value={fmtMoney(billing.revisionsBilled)} muted />
            )}
            <div className="border-t pt-1.5 mt-1.5 flex items-center justify-between font-semibold">
              <span>Total</span><span>{fmtMoney(billing.total)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Acompte 50% {task.acompte_invoiced && "(facturé)"}</span>
              <span>{fmtMoney(billing.acompte)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Solde restant</span>
              <span>{fmtMoney(billing.total - (task.acompte_invoiced ? billing.acompte : 0))}</span>
            </div>
          </div>
        )}
      </Card>

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

      <Dialog open={newClientDialog} onOpenChange={setNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>Créer un client et l'assigner à cette tâche.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Société</Label>
              <Input value={newClientCompany} onChange={(e) => setNewClientCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClientDialog(false)}>Annuler</Button>
            <Button onClick={createClient} disabled={!newClientName.trim() || creatingClient}>
              {creatingClient ? "Création…" : "Créer"}
            </Button>
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

function BillingRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}