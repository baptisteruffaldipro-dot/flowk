import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PROJECT_TYPE_LABEL, fmtDateTime } from "@/lib/format";

const BRIEF_FIELDS: { key: string; label: string; type: "text" | "textarea" }[] = [
  { key: "objectif", label: "Quel est l'objectif principal du projet ?", type: "textarea" },
  { key: "cible", label: "Quelle est votre cible / clientèle ?", type: "textarea" },
  { key: "valeurs", label: "3 mots qui décrivent votre marque", type: "text" },
  { key: "concurrents", label: "Concurrents ou références qui vous inspirent", type: "textarea" },
  { key: "contraintes", label: "Contraintes (couleurs imposées, formats, deadline…)", type: "textarea" },
  { key: "livrables", label: "Livrables attendus", type: "textarea" },
];

export default function ClientProjectPortal() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [brief, setBrief] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    setProject(data);
    setBrief(data?.brief ?? {});
  };
  useEffect(() => { load(); }, [id]);

  const saveBrief = async (submit: boolean) => {
    setSaving(true);
    const update: any = { brief };
    if (submit) update.brief_submitted_at = new Date().toISOString();
    const { error } = await supabase.from("projects").update(update).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(submit ? "Brief envoyé !" : "Brouillon enregistré");
    load();
  };

  if (!project) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const submitted = !!project.brief_submitted_at;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/portail" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Retour
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{PROJECT_TYPE_LABEL[project.type]}</p>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Questionnaire / Brief</h2>
            {submitted && (
              <Badge className="bg-emerald-500 hover:bg-emerald-500 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Envoyé {fmtDateTime(project.brief_submitted_at)}
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {BRIEF_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={brief[f.key] ?? ""}
                    onChange={(e) => setBrief({ ...brief, [f.key]: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <Input
                    value={brief[f.key] ?? ""}
                    onChange={(e) => setBrief({ ...brief, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => saveBrief(false)} disabled={saving}>
              Enregistrer brouillon
            </Button>
            <Button size="sm" onClick={() => saveBrief(true)} disabled={saving}>
              {submitted ? "Mettre à jour" : "Envoyer le brief"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}