import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import QuestionnaireForm from "@/components/QuestionnaireForm";
import { QUESTIONNAIRE_TEMPLATES } from "@/lib/questionnaireTemplates";

export default function QuestionnairePublic() {
  const { token } = useParams();
  const [item, setItem] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data } = await supabase.functions.invoke("get-public-questionnaire", { body: { token } });
      if (data?.questionnaire) {
        setItem(data.questionnaire);
        setAnswers(data.questionnaire.answers || {});
        setSubmitted(data.questionnaire.status === "complete");
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.functions.invoke("submit-public-questionnaire", {
      body: { token, answers },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Brief envoyé, merci !");
    setSubmitted(true);
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (!item) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="p-8 max-w-md text-center">
        <h1 className="text-lg font-semibold mb-2">Lien invalide</h1>
        <p className="text-sm text-muted-foreground">Ce questionnaire n'existe pas ou n'est plus accessible.</p>
      </Card>
    </div>
  );

  const template = QUESTIONNAIRE_TEMPLATES[item.template];

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="p-8 max-w-md text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-2">Brief reçu</h1>
          <p className="text-sm text-muted-foreground">Merci, vos réponses ont bien été transmises.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{item.title}</h1>
          <p className="text-sm text-muted-foreground">{template?.label} · {template?.description}</p>
        </div>
        <Card className="p-6">
          {template && <QuestionnaireForm sections={template.sections} values={answers} onChange={setAnswers} />}
          <div className="flex justify-end mt-6 pt-6 border-t">
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Envoyer le brief
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}