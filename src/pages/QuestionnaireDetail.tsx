import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Send, ArrowLeft, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QuestionnaireForm from "@/components/QuestionnaireForm";
import { QUESTIONNAIRE_TEMPLATES } from "@/lib/questionnaireTemplates";

const STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", complete: "Complété", archive: "Archivé",
};

export default function QuestionnaireDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!id) return;
    const [q, c, p] = await Promise.all([
      supabase.from("questionnaires" as any).select("*, clients(name), projects(name)").eq("id", id).single(),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("projects").select("id,name,client_id").order("name"),
    ]);
    if (q.data) {
      setItem(q.data);
      setAnswers(((q.data as any).answers as Record<string, any>) || {});
    }
    if (c.data) setClients(c.data);
    if (p.data) setProjects(p.data);
  };

  useEffect(() => { load(); }, [id]);

  if (!item) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const template = QUESTIONNAIRE_TEMPLATES[item.template];

  const save = async (extra: Record<string, any> = {}) => {
    setSaving(true);
    const { error } = await supabase.from("questionnaires" as any).update({ answers, ...extra }).eq("id", item.id);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("Enregistré");
    await load();
    return true;
  };

  const updateField = async (field: string, value: any) => {
    const { error } = await supabase.from("questionnaires" as any).update({ [field]: value }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const ensureShareToken = async () => {
    if (item.share_token) return item.share_token as string;
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("questionnaires" as any).update({ share_token: token, status: "envoye" }).eq("id", item.id);
    if (error) { toast.error(error.message); return null; }
    await load();
    return token;
  };

  const copyShareLink = async () => {
    const token = await ensureShareToken();
    if (!token) return;
    const url = `${window.location.origin}/q/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  const generateSummary = async () => {
    setGenerating(true);
    try {
      await save();
      const { data, error } = await supabase.functions.invoke("summarize-questionnaire", { body: { id: item.id } });
      if (error) throw error;
      toast.success("Résumé généré");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erreur génération résumé");
    } finally {
      setGenerating(false);
    }
  };

  const filteredProjects = item.client_id ? projects.filter((p) => p.client_id === item.client_id) : projects;

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from("questionnaires" as any).delete().eq("id", item.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Questionnaire supprimé");
    navigate("/questionnaires");
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/questionnaires")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Retour
      </Button>
      <PageHeader
        title={item.title}
        description={`${template?.label || item.template} · ${STATUS_LABEL[item.status]}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Copy className="h-4 w-4 mr-1.5" /> Lien client
            </Button>
            <Button size="sm" onClick={() => save()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Enregistrer
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1.5" /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce questionnaire ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est définitive. Les réponses et le résumé IA seront perdus.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <Tabs defaultValue="form" className="mt-6">
        <TabsList>
          <TabsTrigger value="form">Questionnaire</TabsTrigger>
          <TabsTrigger value="summary">Résumé brief IA</TabsTrigger>
          <TabsTrigger value="meta">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="mt-4">
          <Card className="p-6">
            {template ? (
              <QuestionnaireForm sections={template.sections} values={answers} onChange={setAnswers} />
            ) : (
              <div className="text-sm text-muted-foreground">Template introuvable.</div>
            )}
            <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
              <Button variant="outline" onClick={() => save({ status: "complete", submitted_at: new Date().toISOString() })}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Marquer complété
              </Button>
              <Button onClick={() => save()} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Enregistrer
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Synthèse créative</h3>
                <p className="text-xs text-muted-foreground">
                  {item.ai_summary_generated_at
                    ? `Généré le ${new Date(item.ai_summary_generated_at).toLocaleString("fr-FR")}`
                    : "Pas encore généré"}
                </p>
              </div>
              <Button onClick={generateSummary} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                {item.ai_summary ? "Régénérer" : "Générer"}
              </Button>
            </div>
            {item.ai_summary ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{item.ai_summary}</div>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded-lg">
                Remplissez le questionnaire puis cliquez sur "Générer" pour obtenir une synthèse exploitable.
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="meta" className="mt-4">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={item.status} onValueChange={(v) => updateField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Titre</Label>
                <Input defaultValue={item.title} onBlur={(e) => e.target.value !== item.title && updateField("title", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={item.client_id || "none"} onValueChange={(v) => updateField("client_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Projet</Label>
                <Select value={item.project_id || "none"} onValueChange={(v) => updateField("project_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {item.share_token && (
              <div className="space-y-1.5">
                <Label>Lien public client</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/q/${item.share_token}`} />
                  <Button variant="outline" onClick={copyShareLink}><Copy className="h-4 w-4" /></Button>
                </div>
                {item.filled_by_client && <Badge variant="secondary" className="mt-2">Rempli par le client</Badge>}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}