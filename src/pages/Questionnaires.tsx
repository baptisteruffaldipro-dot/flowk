import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_OPTIONS, QUESTIONNAIRE_TEMPLATES } from "@/lib/questionnaireTemplates";

const STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  complete: "Complété",
  archive: "Archivé",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  brouillon: "outline", envoye: "secondary", complete: "default", archive: "destructive",
};

export default function Questionnaires() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ template: "logo", title: "", client_id: "", project_id: "" });

  const load = async () => {
    const [q, c, p] = await Promise.all([
      supabase.from("questionnaires" as any).select("*, clients(name), projects(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id").order("name"),
    ]);
    if (q.data) setItems(q.data as any[]);
    if (c.data) setClients(c.data);
    if (p.data) setProjects(p.data);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) { toast.error("Titre requis"); return; }
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      template: form.template,
      title: form.title.trim(),
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      created_by: u.user?.id,
    };
    const { data, error } = await supabase.from("questionnaires" as any).insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Questionnaire créé");
    setOpen(false);
    setForm({ template: "logo", title: "", client_id: "", project_id: "" });
    navigate(`/questionnaires/${(data as any).id}`);
  };

  const filteredProjects = form.client_id ? projects.filter((p) => p.client_id === form.client_id) : projects;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Questionnaires"
        subtitle="Briefs clients structurés avec synthèse IA"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1.5" /> Nouveau</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau questionnaire</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.template} onValueChange={(v) => setForm({ ...form, template: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div>
                            <div className="font-medium">{t.label}</div>
                            <div className="text-xs text-muted-foreground">{t.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Titre</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief logo Acme..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Client (optionnel)</Label>
                  <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v, project_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Projet (optionnel)</Label>
                  <Select value={form.project_id || "none"} onValueChange={(v) => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={create}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="space-y-2">
        {items.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Aucun questionnaire. Créez-en un pour commencer.
          </Card>
        )}
        {items.map((q) => (
          <Link key={q.id} to={`/questionnaires/${q.id}`}>
            <Card className="p-4 hover:bg-secondary/40 transition-colors flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{q.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {QUESTIONNAIRE_TEMPLATES[q.template]?.label}
                  {q.clients?.name && <> · {q.clients.name}</>}
                  {q.projects?.name && <> · {q.projects.name}</>}
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[q.status]}>{STATUS_LABEL[q.status]}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}