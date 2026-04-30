import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, FolderKanban, Printer, Plus, ClipboardList, Sparkles, Loader2, Upload, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PRESTATION_LABEL, PROJECT_TYPE_LABEL } from "@/lib/format";

type Mode = null | "task" | "project" | "order";

export default function QuickCreate({ onCreated }: { onCreated?: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Forms
  const [task, setTask] = useState<any>({ title: "", client_id: "", project_id: "", prestation: "creation", deadline: "", billing_type: "horaire", hourly_rate: "", flat_amount: "", estimated_minutes: "" });
  const [project, setProject] = useState<any>({ name: "", client_id: "", type: "autre" });
  const emptyOrder = {
    description: "", client_id: "", amount: "",
    reference: "", quantity: "", format: "", grammage: "",
    support: "", colors: "", finitions: "", observations: "",
  };
  const [order, setOrder] = useState<any>(emptyOrder);
  const [importText, setImportText] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (mode) {
      Promise.all([
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("projects").select("id,name,client_id"),
      ]).then(([c, p]) => {
        setClients(c.data ?? []);
        setProjects(p.data ?? []);
      });
    }
  }, [mode]);

  const close = () => setMode(null);

  const createTask = async () => {
    if (!task.title.trim()) return toast.error("Titre requis");
    const { data, error } = await supabase.from("tasks").insert({
      title: task.title.trim(),
      client_id: task.client_id || null,
      project_id: task.project_id || null,
      prestation: task.prestation,
      deadline: task.deadline || null,
      billing_type: task.billing_type,
      hourly_rate: task.hourly_rate ? Number(task.hourly_rate) : null,
      flat_amount: task.flat_amount ? Number(task.flat_amount) : null,
      estimated_minutes: task.estimated_minutes ? Number(task.estimated_minutes) : 0,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Tâche créée");
    close();
    setTask({ title: "", client_id: "", project_id: "", prestation: "creation", deadline: "", billing_type: "horaire", hourly_rate: "", flat_amount: "", estimated_minutes: "" });
    onCreated?.();
    if (data?.id) navigate(`/taches/${data.id}`);
  };

  const createProject = async () => {
    if (!project.name.trim()) return toast.error("Nom requis");
    if (!project.client_id) return toast.error("Client requis");
    const { data, error } = await supabase.from("projects").insert({
      name: project.name.trim(),
      client_id: project.client_id,
      type: project.type,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Projet créé");
    close();
    setProject({ name: "", client_id: "", type: "autre" });
    onCreated?.();
    if (data?.id) navigate(`/projets/${data.id}`);
  };

  const createOrder = async () => {
    if (!order.description.trim()) return toast.error("Description requise");
    if (!order.client_id) return toast.error("Client requis");
    const payload: any = {
      description: order.description.trim(),
      client_id: order.client_id,
      amount: order.amount ? Number(order.amount) : null,
      reference: order.reference?.trim() || null,
      quantity: order.quantity ? Number(order.quantity) : null,
      format: order.format?.trim() || null,
      grammage: order.grammage?.trim() || null,
      support: order.support?.trim() || null,
      colors: order.colors?.trim() || null,
      finitions: order.finitions?.trim() || null,
      observations: order.observations?.trim() || null,
      status: "bat_en_attente",
    };
    const { data, error } = await supabase.from("print_orders").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Commande créée");
    close();
    setOrder(emptyOrder);
    setImportText(""); setImportFiles([]);
    onCreated?.();
    if (data?.id) navigate(`/impressions/${data.id}`);
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const onPasteImport = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgs = items.filter((it) => it.kind === "file" && it.type.startsWith("image/"));
    if (imgs.length > 0) {
      e.preventDefault();
      const files = imgs.map((it) => it.getAsFile()).filter(Boolean) as File[];
      setImportFiles((prev) => [...prev, ...files].slice(0, 5));
      toast.success(`${files.length} image${files.length > 1 ? "s" : ""} collée${files.length > 1 ? "s" : ""}`);
    }
  };

  const runImport = async () => {
    if (!importText.trim() && importFiles.length === 0) {
      return toast.error("Collez du texte ou une image de la commande");
    }
    setImporting(true);
    try {
      const images: string[] = [];
      for (const f of importFiles) {
        if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} > 8 Mo`); continue; }
        images.push(await fileToDataUrl(f));
      }
      const { data, error } = await supabase.functions.invoke("parse-print-order", {
        body: { text: importText, images },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as any;
      setOrder((prev: any) => ({
        ...prev,
        description: r.description ?? prev.description,
        reference: r.reference ?? prev.reference,
        quantity: r.quantity != null ? String(r.quantity) : prev.quantity,
        format: r.format ?? prev.format,
        grammage: r.grammage ?? prev.grammage,
        support: r.support ?? prev.support,
        colors: r.colors ?? prev.colors,
        finitions: r.finitions ?? prev.finitions,
        observations: r.observations ?? prev.observations,
        amount: r.amount != null ? String(r.amount) : prev.amount,
      }));
      toast.success("Commande pré-remplie ✨");
    } catch (e: any) {
      toast.error(e?.message ?? "Import impossible");
    } finally {
      setImporting(false);
    }
  };

  const filteredProjects = projects.filter((p) => !task.client_id || p.client_id === task.client_id);

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">Créer rapidement</div>
            <div className="text-xs text-muted-foreground mt-0.5">Une tâche, un projet, une commande ou un questionnaire client</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode("task")} className="justify-start">
            <CheckSquare className="h-4 w-4 mr-2" /> Nouvelle tâche
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode("project")} className="justify-start">
            <FolderKanban className="h-4 w-4 mr-2" /> Nouveau projet
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode("order")} className="justify-start">
            <Printer className="h-4 w-4 mr-2" /> Nouvelle commande
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/questionnaires")} className="justify-start">
            <ClipboardList className="h-4 w-4 mr-2" /> Questionnaire client
          </Button>
        </div>
      </Card>

      {/* TASK */}
      <Dialog open={mode === "task"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle tâche</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input autoFocus value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select value={task.client_id} onValueChange={(v) => setTask({ ...task, client_id: v, project_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Projet</Label>
                <Select value={task.project_id} onValueChange={(v) => setTask({ ...task, project_id: v })} disabled={!task.client_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prestation</Label>
                <Select value={task.prestation} onValueChange={(v) => setTask({ ...task, prestation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRESTATION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Deadline</Label>
                <Input type="date" value={task.deadline} onChange={(e) => setTask({ ...task, deadline: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Facturation</Label>
                <Select value={task.billing_type} onValueChange={(v) => setTask({ ...task, billing_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horaire">Horaire</SelectItem>
                    <SelectItem value="forfait">Forfait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {task.billing_type === "horaire" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux/h (€)</Label>
                  <Input type="number" step="0.01" value={task.hourly_rate} onChange={(e) => setTask({ ...task, hourly_rate: e.target.value })} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Forfait (€)</Label>
                  <Input type="number" step="0.01" value={task.flat_amount} onChange={(e) => setTask({ ...task, flat_amount: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Estim. (min)</Label>
                <Input type="number" value={task.estimated_minutes} onChange={(e) => setTask({ ...task, estimated_minutes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createTask}><Plus className="h-4 w-4 mr-1" />Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PROJECT */}
      <Dialog open={mode === "project"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau projet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input autoFocus value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client *</Label>
              <Select value={project.client_id} onValueChange={(v) => setProject({ ...project, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={project.type} onValueChange={(v) => setProject({ ...project, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={createProject}><Plus className="h-4 w-4 mr-1" />Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ORDER */}
      <Dialog open={mode === "order"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle commande d'impression</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Description *</Label>
              <Input autoFocus value={order.description} onChange={(e) => setOrder({ ...order, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client *</Label>
              <Select value={order.client_id} onValueChange={(v) => setOrder({ ...order, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant (€)</Label>
              <Input type="number" step="0.01" value={order.amount} onChange={(e) => setOrder({ ...order, amount: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={createOrder}><Plus className="h-4 w-4 mr-1" />Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}