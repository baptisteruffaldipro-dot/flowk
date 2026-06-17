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
import { ArrowLeft, Play, Pause, Plus, Trash2, Paperclip, Download, Upload, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { GripVertical } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { STATUS_LABEL, PRESTATION_LABEL, PRIORITY_LABEL, fmtMinutes, fmtMoney, fmtDate } from "@/lib/format";
import { computeTaskBilling } from "@/lib/billing";
import PrestationPicker from "@/components/PrestationPicker";
import DeliveryGateCard from "@/components/DeliveryGateCard";
import NewBatDialog from "@/components/NewBatDialog";
import NewTiimeInvoiceDialog from "@/components/NewTiimeInvoiceDialog";
import GoalsTagSelector from "@/components/GoalsTagSelector";

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
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [batDialogOpen, setBatDialogOpen] = useState(false);
  const [tiimeDialogOpen, setTiimeDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const load = async () => {
    if (!id) return;
    const [t, s, e, c, p, q] = await Promise.all([
      supabase.from("tasks").select("*, clients(id,name,email), projects(id,name)").eq("id", id).maybeSingle(),
      supabase.from("subtasks").select("*").eq("task_id", id).order("position"),
      supabase.from("time_entries").select("*").eq("task_id", id).order("started_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id").order("name"),
      supabase.from("questionnaires").select("id,title,client_id,project_id,template").order("updated_at", { ascending: false }),
    ]);
    setTask(t.data);
    setSubtasks(s.data ?? []);
    setEntries(e.data ?? []);
    setClients(c.data ?? []);
    setProjects(p.data ?? []);
    setQuestionnaires(q.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const createClient = async () => {
    const company = newClientCompany.trim();
    const name = newClientName.trim();
    if (!company && !name) { toast.error("Société ou contact requis"); return; }
    setCreatingClient(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: name || company,
        email: newClientEmail.trim() || null,
        company: company || null,
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

  const renameSub = async (s: any, title: string) => {
    const next = title.trim();
    if (!next || next === s.title) return;
    setSubtasks((prev) => prev.map((x) => (x.id === s.id ? { ...x, title: next } : x)));
    const { error } = await supabase.from("subtasks").update({ title: next }).eq("id", s.id);
    if (error) toast.error(error.message);
  };

  const reorderSubs = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(subtasks, oldIndex, newIndex);
    setSubtasks(reordered);
    await Promise.all(
      reordered.map((s, idx) =>
        s.position === idx
          ? Promise.resolve()
          : supabase.from("subtasks").update({ position: idx }).eq("id", s.id)
      )
    );
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
    if (newStatus === "bat" && !task.bat_id) {
      setBatDialogOpen(true);
    }
    if (newStatus === "tiime") {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id,tiime_invoice_id")
        .eq("task_id", task.id)
        .not("tiime_invoice_id", "is", null)
        .maybeSingle();
      if (!existing) setTiimeDialogOpen(true);
    }
  };

  if (!task) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const running = !!task.timer_started_at;
  const filteredProjects = projects.filter((p) => !task.client_id || p.client_id === task.client_id);
  const filteredQuestionnaires = questionnaires.filter((q) =>
    (!task.client_id || q.client_id === task.client_id) &&
    (!task.project_id || !q.project_id || q.project_id === task.project_id)
  );
  const prestations: string[] = (task.prestations && task.prestations.length > 0)
    ? task.prestations
    : (task.prestation ? [task.prestation] : []);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <Card className="p-4 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Statut</div>
          <Select value={task.status} onValueChange={(v) => updateStatusWithAutoBalance(v)}>
            <SelectTrigger className="mt-2 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
        <Card className="p-4 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Priorité</div>
          <Select value={task.priority ?? "secondaire"} onValueChange={(v) => updateField({ priority: v })}>
            <SelectTrigger className="mt-2 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
        <Card className="p-4 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Prestations</div>
          <PrestationPicker
            value={prestations}
            onChange={(next) => {
              // La colonne legacy `prestation` est un ENUM Postgres ; on n'y écrit
              // que des valeurs connues (sinon on garde l'ancienne ou on retombe sur "autre").
              const known = Object.keys(PRESTATION_LABEL);
              const firstKnown = next.find((k) => known.includes(k));
              updateField({
                prestations: next,
                prestation: firstKnown ?? (known.includes(task.prestation) ? task.prestation : "autre"),
              });
            }}
          />
        </Card>
        <Card className="p-4 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Objectifs</div>
          <GoalsTagSelector entityType="task" entityId={task.id} />
        </Card>
        {!["envoye", "a_facturer", "facture_envoyee", "facturee", "payee", "archive"].includes(task.status) && (
          <Card className="p-4 min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Deadline</div>
            <Input type="date" value={task.deadline ?? ""} onChange={(e) => updateField({ deadline: e.target.value || null })} className="mt-2 w-full min-w-0" />
          </Card>
        )}
      </div>

      <Card className="p-4 mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Brief / questionnaire rattaché</Label>
          <div className="flex items-center gap-2">
            <Select
              value={task.questionnaire_id ?? ""}
              onValueChange={(v) => updateField({ questionnaire_id: v || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder={filteredQuestionnaires.length === 0 ? "Aucun questionnaire disponible" : "Sélectionner un brief / questionnaire"} />
              </SelectTrigger>
              <SelectContent>
                {filteredQuestionnaires.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {task.questionnaire_id && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/questionnaires/${task.questionnaire_id}`}>Ouvrir</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => updateField({ questionnaire_id: null })}>
                  Détacher
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4 sm:p-5 min-w-0">
          <h2 className="text-sm font-semibold mb-3">Notes</h2>
          <Textarea
            value={task.notes ?? ""}
            onChange={(e) => setTask({ ...task, notes: e.target.value })}
            onBlur={() => updateField({ notes: task.notes })}
            rows={8}
            placeholder="Notes, brief, références…"
          />
          <NoteAttachments task={task} onChange={load} />
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs font-semibold text-muted-foreground mb-2">Objectifs</div>
            <GoalsTagSelector entityType="task" entityId={task.id} />
          </div>
        </Card>

        <Card className="p-4 sm:p-5 min-w-0">
          <h2 className="text-sm font-semibold mb-3">Sous-tâches</h2>
          <SubtaskList
            subtasks={subtasks}
            onToggle={toggleSub}
            onRemove={removeSub}
            onRename={renameSub}
            onReorder={reorderSubs}
          />
          <div className="flex gap-2 min-w-0">
            <Input
              placeholder="Ajouter une sous-tâche"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
              className="min-w-0"
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

      <Card className="p-4 sm:p-5 mb-4 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-sm font-semibold">Facturation</h2>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
            <Button size="sm" variant="outline" onClick={invoiceAcompte} disabled={task.acompte_invoiced} className="w-full sm:w-auto min-w-0 justify-center whitespace-normal text-center">
              {task.acompte_invoiced ? "Acompte facturé" : `Facturer l'acompte (${fmtMoney(billing?.acompte ?? 0)})`}
            </Button>
            <Button size="sm" onClick={() => invoiceBalance(false)} className="w-full sm:w-auto">
              Facturer le solde
            </Button>
          </div>
        </div>

        {/* Type de facturation + champs conditionnels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Type de facturation</Label>
            <Select value={task.billing_type} onValueChange={(v) => updateField({ billing_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horaire">Horaire</SelectItem>
                <SelectItem value="forfait">Forfait</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {task.billing_type === "horaire" ? (
            <>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Taux horaire (€)</Label>
                <Input
                  type="number" step="0.01"
                  value={task.hourly_rate ?? ""}
                  onChange={(e) => setTask({ ...task, hourly_rate: e.target.value })}
                  onBlur={() => updateField({ hourly_rate: task.hourly_rate === "" ? null : Number(task.hourly_rate) })}
                />
              </div>
            </>
          ) : (
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

      <div className="mb-4">
        <DeliveryGateCard
          entityType="task"
          table="tasks"
          row={task}
          clientEmail={(task as any).clients?.email ?? null}
          clientName={(task as any).clients?.name ?? null}
          notifyTemplate="files-delivered"
          notifyContext={{ description: task.title, portalUrl: `${window.location.origin}/portail` }}
          onUpdated={load}
        />
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

      <Dialog open={newClientDialog} onOpenChange={setNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>Créer un client et l'assigner à cette tâche.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Société *</Label>
              <Input value={newClientCompany} onChange={(e) => setNewClientCompany(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact</Label>
              <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClientDialog(false)}>Annuler</Button>
            <Button onClick={createClient} disabled={(!newClientName.trim() && !newClientCompany.trim()) || creatingClient}>
              {creatingClient ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewBatDialog
        task={task}
        open={batDialogOpen}
        onOpenChange={setBatDialogOpen}
        onCreated={() => { setBatDialogOpen(false); load(); }}
      />
      <NewTiimeInvoiceDialog
        task={task}
        open={tiimeDialogOpen}
        onOpenChange={setTiimeDialogOpen}
        onCreated={() => { setTiimeDialogOpen(false); load(); }}
      />
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

function NoteAttachments({ task, onChange }: { task: any; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const attachments: { name: string; path: string; size?: number }[] = task.note_attachments ?? [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: Record<string, string> = {};
      for (const a of attachments) {
        const { data } = await supabase.storage.from("livrables").createSignedUrl(a.path, 60 * 60);
        if (data?.signedUrl) entries[a.path] = data.signedUrl;
      }
      if (!cancelled) setPreviews(entries);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(attachments.map((a) => a.path))]);

  const kind = (name: string): "image" | "pdf" | "video" | "audio" | "other" => {
    const ext = name.toLowerCase().split(".").pop() || "";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (["mp4", "webm", "mov"].includes(ext)) return "video";
    if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
    return "other";
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next = [...attachments];
      for (const file of Array.from(files)) {
        const path = `task-notes/${task.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("livrables").upload(path, file);
        if (error) {
          toast.error(`Erreur upload ${file.name}: ${error.message}`);
          continue;
        }
        next.push({ name: file.name, path, size: file.size });
      }
      const { error: upErr } = await supabase.from("tasks").update({ note_attachments: next }).eq("id", task.id);
      if (upErr) toast.error(upErr.message);
      else { toast.success("Fichier(s) ajouté(s)"); onChange(); }
    } finally {
      setUploading(false);
    }
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("livrables").createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Erreur lien");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (path: string) => {
    await supabase.storage.from("livrables").remove([path]);
    const next = attachments.filter((a) => a.path !== path);
    const { error } = await supabase.from("tasks").update({ note_attachments: next }).eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Fichier supprimé");
    onChange();
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5"><Paperclip className="h-3 w-3" /> Pièces jointes</Label>
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => { upload(e.target.files); e.target.value = ""; }}
          />
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-secondary">
            <Upload className="h-3 w-3" /> {uploading ? "Envoi…" : "Ajouter"}
          </span>
        </label>
      </div>
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((a, i) => {
            const url = previews[a.path];
            const k = kind(a.name);
            return (
              <div key={a.path} className="rounded border bg-muted/20 overflow-hidden flex flex-col">
                <button
                  type="button"
                  onClick={() => setViewerIndex(i)}
                  className="bg-background/40 flex items-center justify-center group relative cursor-zoom-in"
                  style={{ minHeight: 120 }}
                  title="Ouvrir"
                >
                  {url && k === "image" && (
                    <img src={url} alt={a.name} className="max-h-48 w-full object-contain" />
                  )}
                  {url && k === "pdf" && (
                    <iframe src={url} title={a.name} className="w-full h-48 pointer-events-none" />
                  )}
                  {url && k === "video" && (
                    <video src={url} className="w-full max-h-48" />
                  )}
                  {url && k === "audio" && (
                    <div className="flex items-center justify-center h-28 w-full text-muted-foreground gap-2">
                      <Paperclip className="h-5 w-5" /> Audio
                    </div>
                  )}
                  {(!url || k === "other") && (
                    <div className="flex items-center justify-center h-28 w-full text-muted-foreground">
                      <Paperclip className="h-6 w-6" />
                    </div>
                  )}
                  <span className="absolute top-1 right-1 bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition">
                    <Maximize2 className="h-3 w-3" />
                  </span>
                </button>
                <div className="flex items-center justify-between gap-2 text-xs p-2 border-t">
                  <span className="truncate flex-1" title={a.name}>{a.name}</span>
                  <button onClick={() => download(a.path)} className="text-muted-foreground hover:text-foreground" title="Télécharger">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(a.path)} className="text-muted-foreground hover:text-destructive" title="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewerIndex !== null && attachments[viewerIndex] && (
        <Dialog open onOpenChange={(o) => !o && setViewerIndex(null)}>
          <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 bg-background">
            <DialogHeader className="px-4 py-3 border-b">
              <DialogTitle className="text-sm truncate pr-8">
                {attachments[viewerIndex].name}
                <span className="text-muted-foreground font-normal ml-2">
                  {viewerIndex + 1} / {attachments.length}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="relative bg-black/5 flex items-center justify-center" style={{ minHeight: "70vh" }}>
              {(() => {
                const a = attachments[viewerIndex];
                const url = previews[a.path];
                const k = kind(a.name);
                if (!url) return <div className="text-sm text-muted-foreground">Chargement…</div>;
                if (k === "image") return <img src={url} alt={a.name} className="max-h-[80vh] max-w-full object-contain" />;
                if (k === "pdf") return <iframe src={url} title={a.name} className="w-full" style={{ height: "80vh" }} />;
                if (k === "video") return <video src={url} controls autoPlay className="max-h-[80vh] max-w-full" />;
                if (k === "audio") return <audio src={url} controls className="w-full max-w-md" />;
                return (
                  <div className="text-center space-y-3 p-8">
                    <Paperclip className="h-10 w-10 mx-auto text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Aperçu indisponible pour ce type de fichier.</div>
                    <Button size="sm" onClick={() => download(a.path)}>
                      <Download className="h-4 w-4 mr-1" /> Télécharger
                    </Button>
                  </div>
                );
              })()}
              {attachments.length > 1 && (
                <>
                  <button
                    onClick={() => setViewerIndex((i) => (i! - 1 + attachments.length) % attachments.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background border rounded-full p-2"
                    title="Précédent"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewerIndex((i) => (i! + 1) % attachments.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background border rounded-full p-2"
                    title="Suivant"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            <DialogFooter className="px-4 py-3 border-t sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => download(attachments[viewerIndex].path)}>
                <Download className="h-4 w-4 mr-1" /> Télécharger
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SubtaskList({
  subtasks, onToggle, onRemove, onRename, onReorder,
}: {
  subtasks: any[];
  onToggle: (s: any) => void;
  onRemove: (id: string) => void;
  onRename: (s: any, title: string) => void;
  onReorder: (e: DragEndEvent) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  return (
    <div className="space-y-1.5 mb-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map((s) => (
            <SortableSubtask key={s.id} s={s} onToggle={onToggle} onRemove={onRemove} onRename={onRename} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableSubtask({
  s, onToggle, onRemove, onRename,
}: {
  s: any;
  onToggle: (s: any) => void;
  onRemove: (id: string) => void;
  onRename: (s: any, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(s.title);
  useEffect(() => { setValue(s.title); }, [s.title]);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== s.title) onRename(s, value);
    else setValue(s.title);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 group rounded ${isDragging ? "bg-muted/50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground opacity-0 group-hover:opacity-100 touch-none"
        title="Réordonner"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox checked={s.done} onCheckedChange={() => onToggle(s)} />
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setValue(s.title); setEditing(false); }
          }}
          className="h-7 text-sm flex-1 min-w-0"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 min-w-0 break-words text-sm cursor-text ${s.done ? "line-through text-muted-foreground" : ""}`}
        >
          {s.title}
        </span>
      )}
      <button onClick={() => onRemove(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}