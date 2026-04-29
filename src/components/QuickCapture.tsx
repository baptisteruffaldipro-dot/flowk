import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Inbox, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Source = "sms"|"whatsapp"|"email"|"instagram"|"messenger"|"telephone"|"autre";
const SOURCE_LABEL: Record<Source,string> = {
  sms:"SMS", whatsapp:"WhatsApp", email:"Email", instagram:"Instagram",
  messenger:"Messenger", telephone:"Téléphone", autre:"Autre",
};

type Action = {
  type: "add_note"|"create_task"|"create_project"|"create_subtask"|"count_revision"|"set_deadline"|"create_client"|"create_print_order";
  label: string;
  target?: "task"|"project"|"print_order"|"client";
  target_id?: string|null;
  task_title?: string|null;
  prestation?: string|null;
  project_name?: string|null;
  project_type?: string|null;
  subtask_title?: string|null;
  deadline?: string|null;
  client_name?: string|null;
  client_email?: string|null;
  print_description?: string|null;
};

type AiResult = {
  summary: string;
  link: { client_id: string|null; project_id: string|null; task_id: string|null; print_order_id: string|null; confidence: "low"|"medium"|"high" };
  actions: Action[];
};

interface Props { open: boolean; onOpenChange: (o:boolean)=>void; }

export default function QuickCapture({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [source, setSource] = useState<Source>("autre");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  // editable link state
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [printOrderId, setPrintOrderId] = useState<string>("");
  const [selectedActions, setSelectedActions] = useState<Set<number>>(new Set());

  // lists
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [c,p,t,o] = await Promise.all([
        supabase.from("clients").select("id,name,company").order("name"),
        supabase.from("projects").select("id,name,client_id").order("updated_at", { ascending: false }),
        supabase.from("tasks").select("id,title,client_id,project_id").neq("status","archive").order("updated_at", { ascending: false }),
        supabase.from("print_orders").select("id,description,client_id,project_id").order("updated_at", { ascending: false }),
      ]);
      setClients(c.data ?? []); setProjects(p.data ?? []);
      setTasks(t.data ?? []); setOrders(o.data ?? []);
    })();
  }, [open]);

  const reset = () => {
    setContent(""); setSource("autre"); setAi(null); setCaptureId(null);
    setClientId(""); setProjectId(""); setTaskId(""); setPrintOrderId("");
    setSelectedActions(new Set());
    setImageFile(null); setImagePreview(null); setUploadedPath(null);
  };
  useEffect(() => { if (!open) reset(); }, [open]);

  const filteredProjects = useMemo(() => clientId ? projects.filter(p => p.client_id === clientId) : projects, [projects, clientId]);
  const filteredTasks = useMemo(() => {
    let t = tasks;
    if (clientId) t = t.filter(x => x.client_id === clientId);
    if (projectId) t = t.filter(x => x.project_id === projectId);
    return t;
  }, [tasks, clientId, projectId]);
  const filteredOrders = useMemo(() => clientId ? orders.filter(o => o.client_id === clientId) : orders, [orders, clientId]);

  const onPickImage = (file: File | null) => {
    if (!file) { setImageFile(null); setImagePreview(null); return; }
    if (!file.type.startsWith("image/")) { toast.error("Fichier image attendu"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image > 10 Mo"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const analyze = async () => {
    if (!content.trim() && !imageFile) return;
    setAnalyzing(true); setAi(null); setCaptureId(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      // 0) Upload image first if present
      let imagePath: string | null = uploadedPath;
      if (imageFile && !imagePath) {
        const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${u.user!.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("quick-captures").upload(path, imageFile, {
          contentType: imageFile.type, upsert: false,
        });
        if (upErr) throw upErr;
        imagePath = path;
        setUploadedPath(path);
      }
      // 1) Save the raw capture immediately
      const { data: cap, error: capErr } = await supabase.from("quick_captures").insert({
        content: content || (imagePath ? "[Image]" : ""), source, created_by: u.user!.id,
      }).select("id").single();
      if (capErr) throw capErr;
      setCaptureId(cap.id);

      // 2) Ask the AI
      const { data, error } = await supabase.functions.invoke("analyze-capture", { body: { content, source, image_path: imagePath } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data as AiResult;
      setAi(result);
      if ((data as any)?.ocr_text && !content.trim()) {
        setContent((data as any).ocr_text);
      }
      setClientId(result.link.client_id ?? "");
      setProjectId(result.link.project_id ?? "");
      setTaskId(result.link.task_id ?? "");
      setPrintOrderId(result.link.print_order_id ?? "");
      // Pré-cocher en priorité les actions de création (tâche / projet)
      const preselect = new Set<number>();
      result.actions.forEach((a, i) => {
        if (a.type === "create_task" || a.type === "create_project") preselect.add(i);
      });
      if (preselect.size === 0 && result.actions.length > 0) preselect.add(0);
      setSelectedActions(preselect);

      await supabase.from("quick_captures").update({
        ai_summary: result.summary,
        ai_suggestions: result as any,
      }).eq("id", cap.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse impossible");
    } finally {
      setAnalyzing(false);
    }
  };

  const noteText = () => {
    const stamp = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    return `\n\n— ${stamp} via ${SOURCE_LABEL[source]}\n${content.trim()}${ai?.summary ? `\n→ ${ai.summary}` : ""}`;
  };

  const apply = async (archive: boolean) => {
    if (!captureId) return;
    setSaving(true);
    try {
      // Apply selected actions
      const acts = (ai?.actions ?? []).filter((_, i) => selectedActions.has(i));
      for (const a of acts) {
        if (a.type === "add_note") {
          if (taskId) {
            const { data: cur } = await supabase.from("tasks").select("notes").eq("id", taskId).single();
            await supabase.from("tasks").update({ notes: (cur?.notes ?? "") + noteText() }).eq("id", taskId);
          } else if (projectId) {
            const { data: cur } = await supabase.from("projects").select("notes").eq("id", projectId).single();
            await supabase.from("projects").update({ notes: (cur?.notes ?? "") + noteText() }).eq("id", projectId);
          } else if (clientId) {
            const { data: cur } = await supabase.from("clients").select("notes").eq("id", clientId).single();
            await supabase.from("clients").update({ notes: (cur?.notes ?? "") + noteText() }).eq("id", clientId);
          } else {
            toast.error("Choisissez une cible pour la note");
            continue;
          }
        } else if (a.type === "create_task") {
          if (!clientId) { toast.error("Client requis pour créer une tâche"); continue; }
          await supabase.from("tasks").insert({
            title: a.task_title || ai?.summary?.slice(0, 80) || "Nouvelle tâche",
            client_id: clientId, project_id: projectId || null,
            notes: noteText(), deadline: a.deadline || null,
          });
        } else if (a.type === "create_subtask") {
          if (!taskId) { toast.error("Tâche requise pour la sous-tâche"); continue; }
          await supabase.from("subtasks").insert({ task_id: taskId, title: a.subtask_title || a.label });
        } else if (a.type === "count_revision") {
          if (!taskId) { toast.error("Tâche requise pour le compteur de retours"); continue; }
          const { data: cur } = await supabase.from("tasks").select("client_revisions_count,notes").eq("id", taskId).single();
          await supabase.from("tasks").update({
            client_revisions_count: (cur?.client_revisions_count ?? 0) + 1,
            notes: (cur?.notes ?? "") + noteText(),
          }).eq("id", taskId);
        } else if (a.type === "set_deadline") {
          if (!taskId || !a.deadline) { toast.error("Tâche + date requises"); continue; }
          await supabase.from("tasks").update({ deadline: a.deadline }).eq("id", taskId);
        } else if (a.type === "create_client") {
          const { data: nc } = await supabase.from("clients").insert({
            name: a.client_name || "Nouveau client", email: a.client_email || null,
          }).select("id").single();
          if (nc?.id) setClientId(nc.id);
        } else if (a.type === "create_print_order") {
          if (!clientId) { toast.error("Client requis pour la commande"); continue; }
          await supabase.from("print_orders").insert({
            client_id: clientId, project_id: projectId || null,
            description: a.print_description || ai?.summary?.slice(0, 80) || "Nouvelle commande",
          });
        }
      }

      await supabase.from("quick_captures").update({
        status: archive ? "archive" : "traite",
        client_id: clientId || null,
        project_id: projectId || null,
        task_id: taskId || null,
        print_order_id: printOrderId || null,
        processed_at: new Date().toISOString(),
      }).eq("id", captureId);

      toast.success(archive ? "Capture archivée" : "Capture traitée");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'application");
    } finally {
      setSaving(false);
    }
  };

  const sendToInbox = async () => {
    if (!captureId) {
      // Save without analyzing
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("quick_captures").insert({ content, source, created_by: u.user!.id });
    }
    toast.success("Capture envoyée à l'inbox");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Capture rapide
          </DialogTitle>
          <DialogDescription>
            Collez un message client : l'IA propose un rattachement et des actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <div className="space-y-2">
              <Textarea
                autoFocus value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Collez ici le SMS, l'email, le DM Instagram, ou prenez une note rapide…"
                className="min-h-[120px] resize-none"
                maxLength={8000}
              />
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Aperçu" className="max-h-32 rounded-md border border-border" />
                  <button
                    type="button"
                    onClick={() => onPickImage(null)}
                    className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 hover:bg-muted"
                    aria-label="Retirer l'image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5" />
                {imageFile ? "Changer l'image" : "Joindre une image (screen, photo…)"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as Source)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={analyze} disabled={(!content.trim() && !imageFile) || analyzing} className="w-full" size="sm">
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Sparkles className="h-3.5 w-3.5 mr-1" /> Analyser</>}
              </Button>
            </div>
          </div>

          {ai && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm">{ai.summary}</div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Confiance : {ai.link.confidence}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Client</Label>
                  <Select value={clientId || "__none"} onValueChange={(v) => { setClientId(v === "__none" ? "" : v); setProjectId(""); setTaskId(""); setPrintOrderId(""); }}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Aucun</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Projet</Label>
                  <Select value={projectId || "__none"} onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Aucun</SelectItem>
                      {filteredProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tâche</Label>
                  <Select value={taskId || "__none"} onValueChange={(v) => setTaskId(v === "__none" ? "" : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Aucune</SelectItem>
                      {filteredTasks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Commande impression</Label>
                  <Select value={printOrderId || "__none"} onValueChange={(v) => setPrintOrderId(v === "__none" ? "" : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Aucune</SelectItem>
                      {filteredOrders.map(o => <SelectItem key={o.id} value={o.id}>{o.description}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Actions suggérées</Label>
                <div className="space-y-1 mt-1">
                  {ai.actions.map((a, i) => (
                    <label key={i} className="flex items-start gap-2 p-2 rounded hover:bg-background cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedActions.has(i)}
                        onCheckedChange={(c) => {
                          const s = new Set(selectedActions);
                          if (c) s.add(i); else s.delete(i);
                          setSelectedActions(s);
                        }}
                      />
                      <div className="flex-1">
                        <div>{a.label}</div>
                        {a.deadline && <div className="text-xs text-muted-foreground">Deadline : {a.deadline}</div>}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); navigate("/inbox"); }}>
              <Inbox className="h-3.5 w-3.5 mr-1" /> Voir l'inbox
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={sendToInbox} disabled={!content.trim() || saving}>
                Envoyer à l'inbox
              </Button>
              <Button size="sm" onClick={() => apply(false)} disabled={!ai || saving || selectedActions.size === 0}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Appliquer"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}