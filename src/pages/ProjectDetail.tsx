import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PROJECT_TYPE_LABEL, STATUS_LABEL, PRINT_STATUS_LABEL, BAT_STATUS_LABEL, INVOICE_STATUS_LABEL, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [linkValue, setLinkValue] = useState<string>("");
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [bats, setBats] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    const [p, t, c, all] = await Promise.all([
      supabase.from("projects").select("*, clients(id,name)").eq("id", id).maybeSingle(),
      supabase.from("tasks").select("id,title,status").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("tasks").select("id,title,status,client_id,project_id,clients(name)").is("project_id", null).order("created_at", { ascending: false }),
    ]);
    setProject(p.data);
    setNotes(p.data?.notes ?? "");
    setTasks(t.data ?? []);
    setClients(c.data ?? []);
    setAvailableTasks(all.data ?? []);

    const clientId = p.data?.client_id;
    if (clientId) {
      const taskIds = (t.data ?? []).map((x: any) => x.id);
      const [po, ba, st, qs, ap] = await Promise.all([
        supabase.from("print_orders").select("id,description,status,created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("bats").select("id,title,status,created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("brand_strategies").select("id,project_name,version,updated_at").eq("client_id", clientId).order("updated_at", { ascending: false }),
        supabase.from("questionnaires").select("id,title,template,status,created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("appointments").select("id,title,start_at,status").eq("client_id", clientId).order("start_at", { ascending: false }),
      ]);
      setPrintOrders(po.data ?? []);
      setBats(ba.data ?? []);
      setStrategies(st.data ?? []);
      setQuestionnaires(qs.data ?? []);
      setAppointments(ap.data ?? []);

      const printIds = (po.data ?? []).map((x: any) => x.id);
      const invQueries: any[] = [];
      if (taskIds.length) invQueries.push(supabase.from("invoices").select("*").in("task_id", taskIds));
      if (printIds.length) invQueries.push(supabase.from("invoices").select("*").in("print_order_id", printIds));
      const invResults = await Promise.all(invQueries);
      const merged: any[] = [];
      const seen = new Set<string>();
      invResults.forEach((r: any) => (r.data ?? []).forEach((row: any) => {
        if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
      }));
      merged.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      setInvoices(merged);
    } else {
      setPrintOrders([]); setBats([]); setStrategies([]); setQuestionnaires([]); setAppointments([]); setInvoices([]);
    }
  };
  useEffect(() => { load(); }, [id]);

  const linkTask = async (taskId: string) => {
    if (!taskId || !id) return;
    const t = availableTasks.find((x) => x.id === taskId);
    const patch: any = { project_id: id };
    // Aligner le client de la tâche sur celui du projet si manquant ou différent
    if (project?.client_id && t?.client_id !== project.client_id) {
      patch.client_id = project.client_id;
    }
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) return toast.error(error.message);
    toast.success("Tâche liée au projet");
    setLinkValue("");
    load();
  };

  const saveNotes = async () => {
    const { error } = await supabase.from("projects").update({ notes }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Enregistré");
  };

  const updateField = async (patch: any) => {
    setProject({ ...project, ...patch });
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const saveName = async () => {
    if (!project.name?.trim()) return toast.error("Nom requis");
    const { error } = await supabase.from("projects").update({ name: project.name.trim() }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const deleteProject = async () => {
    if (!id) return;
    if (tasks.length > 0) {
      return toast.error(`Impossible : ${tasks.length} tâche(s) liée(s). Supprime-les d'abord.`);
    }
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Projet supprimé");
    navigate("/projets");
  };

  if (!project) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">
      <Link to="/projets" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Projets
      </Link>
      <PageHeader
        title="Projet"
        description={`${project.clients?.name ?? ""}${project.created_at ? ` · Créé le ${fmtDate(project.created_at)}` : ""}`}
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Action définitive. Les tâches liées doivent être supprimées au préalable.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={deleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      <Card className="p-5 mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom</Label>
            <Input
              value={project.name ?? ""}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              onBlur={saveName}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client</Label>
            <Select value={project.client_id} onValueChange={(v) => updateField({ client_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <Select value={project.type} onValueChange={(v) => updateField({ type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date de livraison annoncée</Label>
            <Input
              type="date"
              value={project.deadline ?? ""}
              onChange={(e) => updateField({ deadline: e.target.value || null })}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Brief & notes</h2>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="Brief, indications du client, idées…"
          />
          <Button size="sm" className="mt-3" onClick={saveNotes}>Enregistrer</Button>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Tâches du projet</h2>
          <div className="mb-3">
            <Label className="text-xs">Lier une tâche existante</Label>
            <Select value={linkValue} onValueChange={linkTask}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={availableTasks.length ? "Sélectionner une tâche…" : "Aucune tâche disponible"} />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const sameClient = availableTasks.filter((t) => t.client_id === project?.client_id);
                  const others = availableTasks.filter((t) => t.client_id !== project?.client_id);
                  return (
                    <>
                      {sameClient.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                      {others.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title} — {t.clients?.name ?? "Sans client"}
                        </SelectItem>
                      ))}
                    </>
                  );
                })()}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            {tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Aucune tâche</div>
            ) : tasks.map((t) => (
              <Link key={t.id} to={`/taches/${t.id}`} className="flex items-center justify-between p-2.5 rounded hover:bg-secondary/60 text-sm">
                <span className="truncate">{t.title}</span>
                <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[t.status]}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold">Activité du client</h2>
          <span className="text-xs text-muted-foreground">{project.clients?.name}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Impressions ({printOrders.length})</h3>
            <div className="space-y-1">
              {printOrders.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Aucune</div>
              ) : printOrders.map((o) => (
                <Link key={o.id} to={`/impressions/${o.id}`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm gap-2">
                  <span className="truncate">{o.description}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{PRINT_STATUS_LABEL[o.status] ?? o.status}</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">BAT ({bats.length})</h3>
            <div className="space-y-1">
              {bats.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Aucun</div>
              ) : bats.map((b) => (
                <Link key={b.id} to={`/bats/${b.id}`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm gap-2">
                  <span className="truncate">{b.title}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{BAT_STATUS_LABEL[b.status] ?? b.status}</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Stratégies de marque ({strategies.length})</h3>
            <div className="space-y-1">
              {strategies.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Aucune</div>
              ) : strategies.map((s) => (
                <Link key={s.id} to={`/strategie/${s.id}`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm gap-2">
                  <span className="truncate">{s.project_name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(s.updated_at)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Briefs / Questionnaires ({questionnaires.length})</h3>
            <div className="space-y-1">
              {questionnaires.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Aucun</div>
              ) : questionnaires.map((q) => (
                <Link key={q.id} to={`/questionnaires/${q.id}`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm gap-2">
                  <span className="truncate">{q.title}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{q.status}</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Rendez-vous ({appointments.length})</h3>
            <div className="space-y-1">
              {appointments.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">Aucun</div>
              ) : appointments.map((a) => (
                <Link key={a.id} to={`/agenda`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm gap-2">
                  <span className="truncate">{a.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtDateTime(a.start_at)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 mt-4">
        {(() => {
          const total = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
          const paid = invoices.filter((i) => i.status === "payee").reduce((s, i) => s + Number(i.amount ?? 0), 0);
          const pending = total - paid;
          return (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold">Facturation ({invoices.length})</h2>
                <span className="text-xs text-muted-foreground">
                  Total {fmtMoney(total)} · Payé {fmtMoney(paid)} · Reste {fmtMoney(pending)}
                </span>
              </div>
              <div className="space-y-1">
                {invoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Aucune facture</div>
                ) : invoices.map((i) => (
                  <Link key={i.id} to="/facturation" className="flex items-center justify-between p-2.5 rounded hover:bg-secondary/60 text-sm gap-2">
                    <span className="truncate">{i.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium">{fmtMoney(Number(i.amount))}</span>
                      <Badge variant="outline" className="text-[10px]">{INVOICE_STATUS_LABEL[i.status] ?? i.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          );
        })()}
      </Card>
    </div>
  );
}