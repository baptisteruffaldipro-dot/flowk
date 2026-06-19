import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, FolderKanban, Printer, Plus, ClipboardList, Sparkles, Loader2, Upload, X, UserPlus, CalendarPlus, FileQuestion } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PRESTATION_LABEL, PROJECT_TYPE_LABEL } from "@/lib/format";
import ClientSelectField from "@/components/ClientSelectField";

type Mode = null | "task" | "project" | "order" | "client" | "appointment";

export function QuickCreateMenu({ onCreated }: { onCreated?: () => void }) {
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
  const [client, setClient] = useState<any>({ name: "", company: "", email: "", phone: "" });
  const [appt, setAppt] = useState<any>({ title: "", client_id: "", project_id: "", start_at: "", duration_minutes: 60, type: "presentiel", location: "" });

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
      status: "a_commander",
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

  const createClient = async () => {
    const company = client.company?.trim() || "";
    const name = client.name?.trim() || "";
    if (!company && !name) return toast.error("Société ou contact requis");
    const { data, error } = await supabase.from("clients").insert({
      name: name || company,
      company: company || null,
      email: client.email?.trim() || null,
      phone: client.phone?.trim() || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Client créé");
    close();
    setClient({ name: "", company: "", email: "", phone: "" });
    onCreated?.();
    if (data?.id) navigate(`/clients/${data.id}`);
  };

  const createAppointment = async () => {
    if (!appt.title.trim()) return toast.error("Titre requis");
    if (!appt.start_at) return toast.error("Date/heure requise");
    const { error } = await supabase.from("appointments").insert({
      title: appt.title.trim(),
      client_id: appt.client_id || null,
      project_id: appt.project_id || null,
      start_at: new Date(appt.start_at).toISOString(),
      duration_minutes: Number(appt.duration_minutes) || 60,
      type: appt.type,
      location: appt.location?.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Rendez-vous créé");
    close();
    setAppt({ title: "", client_id: "", project_id: "", start_at: "", duration_minutes: 60, type: "presentiel", location: "" });
    onCreated?.();
    navigate("/rdv");
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

  const actions = [
    { key: "client" as Mode, label: "Nouveau client", icon: UserPlus, color: "sky" },
    { key: "task" as Mode, label: "Nouvelle tâche", icon: CheckSquare, color: "emerald" },
    { key: "project" as Mode, label: "Nouveau projet", icon: FolderKanban, color: "violet" },
    { key: "order" as Mode, label: "Commande", icon: Printer, color: "orange" },
    { key: "appointment" as Mode, label: "Nouveau RDV", icon: CalendarPlus, color: "rose" },
    { key: "request" as Mode, label: "Demande client", icon: FileQuestion, color: "indigo", onClick: () => navigate("/demandes") },
    { key: "questionnaire" as Mode, label: "Questionnaire", icon: ClipboardList, color: "teal", onClick: () => navigate("/questionnaires") },
  ];

  return (
    <>
      <Card className="p-5">
        <div className="mb-5">
          <div className="text-sm font-semibold tracking-tight">Créer rapidement</div>
          <div className="text-xs text-muted-foreground mt-0.5">Une tâche, un projet, une commande, une demande client ou un questionnaire</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {actions.map((a) => {
            const Icon = a.icon;
            const colorMap: Record<string, { bg: string; text: string; border: string; hoverBg: string }> = {
              sky: { bg: "bg-sky-50", text: "text-sky-600", border: "hover:border-sky-200", hoverBg: "hover:bg-sky-50/40" },
              emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "hover:border-emerald-200", hoverBg: "hover:bg-emerald-50/40" },
              violet: { bg: "bg-violet-50", text: "text-violet-600", border: "hover:border-violet-200", hoverBg: "hover:bg-violet-50/40" },
              orange: { bg: "bg-orange-50", text: "text-orange-600", border: "hover:border-orange-200", hoverBg: "hover:bg-orange-50/40" },
              rose: { bg: "bg-rose-50", text: "text-rose-600", border: "hover:border-rose-200", hoverBg: "hover:bg-rose-50/40" },
              indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "hover:border-indigo-200", hoverBg: "hover:bg-indigo-50/40" },
              teal: { bg: "bg-teal-50", text: "text-teal-600", border: "hover:border-teal-200", hoverBg: "hover:bg-teal-50/40" },
            };
            const c = colorMap[a.color];
            return (
              <button
                key={a.key}
                onClick={a.onClick ?? (() => setMode(a.key))}
                className={`group flex flex-col items-center gap-2.5 p-3.5 rounded-xl border border-border bg-card ${c.border} ${c.hoverBg} transition-all duration-200 cursor-pointer`}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${c.bg} ${c.text} group-hover:scale-105 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight">
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* TASK */}
      <Dialog open={mode === "task"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle tâche</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input autoFocus value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <ClientSelectField
                  value={task.client_id}
                  onChange={(v) => setTask({ ...task, client_id: v, project_id: "" })}
                  clients={clients}
                  onClientCreated={(c) => setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Projet</Label>
                <Select value={task.project_id} onValueChange={(v) => setTask({ ...task, project_id: v })} disabled={!task.client_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <ClientSelectField
                value={project.client_id}
                onChange={(v) => setProject({ ...project, client_id: v })}
                clients={clients}
                onClientCreated={(c) => setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                placeholder="Sélectionner"
              />
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
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle commande d'impression</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* IMPORT IA */}
            <div className="rounded-md border border-dashed border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" /> Import auto depuis l'imprimeur
              </div>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                onPaste={onPasteImport}
                placeholder="Collez le récap de commande (texte ou screenshot Ctrl+V) — l'IA remplit les champs."
                className="min-h-[70px] resize-none text-xs"
              />
              {importFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {importFiles.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 object-cover rounded border border-border" />
                      <button type="button" onClick={() => setImportFiles((p) => p.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 hover:bg-muted">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                  <Upload className="h-3.5 w-3.5" /> Joindre un screenshot
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => {
                      const fs = Array.from(e.target.files ?? []);
                      setImportFiles((p) => [...p, ...fs].slice(0, 5));
                      e.target.value = "";
                    }} />
                </label>
                <Button size="sm" onClick={runImport} disabled={importing || (!importText.trim() && importFiles.length === 0)} className="ml-auto">
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5 mr-1" /> Analyser</>}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Description *</Label>
                <Input autoFocus value={order.description} onChange={(e) => setOrder({ ...order, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client *</Label>
                <ClientSelectField
                  value={order.client_id}
                  onChange={(v) => setOrder({ ...order, client_id: v })}
                  clients={clients}
                  onClientCreated={(c) => setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Référence</Label>
                <Input value={order.reference} onChange={(e) => setOrder({ ...order, reference: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantité</Label>
                <Input type="number" value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <Input value={order.format} onChange={(e) => setOrder({ ...order, format: e.target.value })} placeholder="A4, 85×55 mm…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Grammage</Label>
                <Input value={order.grammage} onChange={(e) => setOrder({ ...order, grammage: e.target.value })} placeholder="350 g/m²" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Support</Label>
                <Input value={order.support} onChange={(e) => setOrder({ ...order, support: e.target.value })} placeholder="Couché brillant…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Couleurs</Label>
                <Input value={order.colors} onChange={(e) => setOrder({ ...order, colors: e.target.value })} placeholder="Quadri R°/V°" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Finitions</Label>
                <Input value={order.finitions} onChange={(e) => setOrder({ ...order, finitions: e.target.value })} placeholder="Pelliculage mat…" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Montant (€)</Label>
                <Input type="number" step="0.01" value={order.amount} onChange={(e) => setOrder({ ...order, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Observations</Label>
                <Textarea value={order.observations} onChange={(e) => setOrder({ ...order, observations: e.target.value })} className="min-h-[60px] text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createOrder}><Plus className="h-4 w-4 mr-1" />Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLIENT */}
      <Dialog open={mode === "client"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Société *</Label>
              <Input autoFocus value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact</Label>
              <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone</Label>
                <Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createClient}><Plus className="h-4 w-4 mr-1" />Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPOINTMENT */}
      <Dialog open={mode === "appointment"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau rendez-vous</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input autoFocus value={appt.title} onChange={(e) => setAppt({ ...appt, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <ClientSelectField
                  value={appt.client_id}
                  onChange={(v) => setAppt({ ...appt, client_id: v, project_id: "" })}
                  clients={clients}
                  onClientCreated={(c) => setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Projet</Label>
                <Select value={appt.project_id} onValueChange={(v) => setAppt({ ...appt, project_id: v })} disabled={!appt.client_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{projects.filter((p) => !appt.client_id || p.client_id === appt.client_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date / heure *</Label>
                <Input type="datetime-local" value={appt.start_at} onChange={(e) => setAppt({ ...appt, start_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Durée (min)</Label>
                <Input type="number" value={appt.duration_minutes} onChange={(e) => setAppt({ ...appt, duration_minutes: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={appt.type} onValueChange={(v) => setAppt({ ...appt, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presentiel">Présentiel</SelectItem>
                    <SelectItem value="visio">Visio</SelectItem>
                    <SelectItem value="telephone">Téléphone</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu / lien</Label>
                <Input value={appt.location} onChange={(e) => setAppt({ ...appt, location: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createAppointment}><Plus className="h-4 w-4 mr-1" />Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}