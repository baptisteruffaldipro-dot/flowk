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
import { PROJECT_TYPE_LABEL, STATUS_LABEL } from "@/lib/format";
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
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to="/projets" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Projets
      </Link>
      <PageHeader
        title="Projet"
        description={project.clients?.name ?? ""}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
    </div>
  );
}