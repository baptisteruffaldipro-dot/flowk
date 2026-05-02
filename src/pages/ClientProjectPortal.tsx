import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, FileCheck2, Clock, Euro, Repeat, Truck, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { PROJECT_TYPE_LABEL, fmtDate, fmtDateTime } from "@/lib/format";

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
  const [tasks, setTasks] = useState<any[]>([]);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [bats, setBats] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    const [p, t, po, b] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("tasks").select("id,title,status,deadline,total_minutes,flat_amount,hourly_rate,billing_type,client_revisions_count,free_revisions,delivered_at").eq("project_id", id),
      supabase.from("print_orders").select("id,description,status,amount,estimated_delivery_date").eq("project_id", id),
      supabase.from("bats").select("id,title,status,validated_at").eq("project_id", id),
    ]);
    setProject(p.data);
    setBrief((p.data?.brief as Record<string, string>) ?? {});
    setTasks(t.data ?? []);
    setPrintOrders(po.data ?? []);
    setBats(b.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const recap = useMemo(() => {
    const totalMinutes = tasks.reduce((s, t) => s + (t.total_minutes || 0), 0);
    const estimated = tasks.reduce((s, t) => {
      if (t.billing_type === "forfait") return s + (Number(t.flat_amount) || 0);
      const rate = Number(t.hourly_rate) || 0;
      return s + ((t.total_minutes || 0) / 60) * rate;
    }, 0)
      + printOrders.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const usedRevisions = tasks.reduce((s, t) => s + (t.client_revisions_count || 0), 0);
    const freeRevisions = tasks.reduce((s, t) => s + (t.free_revisions || 0), 0);
    const batsToValidate = bats.filter((b) => b.status !== "valide" && b.status !== "rejete").length;
    const batsAvailable = bats.length;
    const nextPrintDelivery = printOrders
      .map((p) => p.estimated_delivery_date)
      .filter(Boolean)
      .sort()[0];
    return { totalMinutes, estimated, usedRevisions, freeRevisions, batsToValidate, batsAvailable, nextPrintDelivery };
  }, [tasks, printOrders, bats]);

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
  const hours = Math.floor(recap.totalMinutes / 60);
  const mins = recap.totalMinutes % 60;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/portail" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Retour
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{PROJECT_TYPE_LABEL[project.type]}</p>

        {/* Récap onboarding projet */}
        <Card className="p-6 mb-4">
          <h2 className="text-sm font-semibold mb-4">Récapitulatif du projet</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Euro className="h-3 w-3" /> Montant estimé</div>
              <div className="text-lg font-semibold">{recap.estimated.toFixed(2)} €</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" /> Temps réel passé</div>
              <div className="text-lg font-semibold">{hours}h{String(mins).padStart(2, "0")}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Repeat className="h-3 w-3" /> Retours utilisés</div>
              <div className="text-lg font-semibold">{recap.usedRevisions}<span className="text-sm text-muted-foreground"> / {recap.freeRevisions} inclus</span></div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> Deadline annoncée</div>
              <div className="text-lg font-semibold">{project.deadline ? fmtDate(project.deadline) : "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Truck className="h-3 w-3" /> Livraison impression</div>
              <div className="text-lg font-semibold">{recap.nextPrintDelivery ? fmtDate(recap.nextPrintDelivery) : "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><FileCheck2 className="h-3 w-3" /> BAT</div>
              <div className="text-lg font-semibold">
                {recap.batsAvailable === 0 ? "—" : (
                  <>
                    {recap.batsAvailable} dispo
                    {recap.batsToValidate > 0 && (
                      <Badge className="ml-2 text-[10px] bg-amber-500 hover:bg-amber-500">{recap.batsToValidate} à valider</Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {bats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-1">
              <div className="text-xs text-muted-foreground mb-2">BAT disponibles</div>
              {bats.map((b) => (
                <Link key={b.id} to={`/portail/bat/${b.id}`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/60 text-sm">
                  <span className="truncate flex items-center gap-2"><FileCheck2 className="h-3.5 w-3.5 text-muted-foreground" />{b.title}</span>
                  <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

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