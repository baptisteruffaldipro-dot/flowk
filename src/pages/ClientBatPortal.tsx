import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import BatViewer from "@/components/BatViewer";
import { BAT_STATUS_LABEL, fmtDateTime } from "@/lib/format";

export default function ClientBatPortal() {
  const { id } = useParams();
  const [bat, setBat] = useState<any>(null);
  const [signedBy, setSignedBy] = useState("");
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("bats").select("*, clients(name), projects(name)").eq("id", id).maybeSingle();
    setBat(data);
    if (data?.signed_by_name) setSignedBy(data.signed_by_name);
  };
  useEffect(() => { load(); }, [id]);

  const validate = async () => {
    if (!signedBy.trim()) return toast.error("Indiquez votre nom pour signer");
    const { error } = await supabase.from("bats").update({
      status: "valide",
      validated_at: new Date().toISOString(),
      signed_by_name: signedBy.trim(),
      signed_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("BAT validé, merci !");
    load();
  };

  const reject = async () => {
    if (!reason.trim()) return toast.error("Indiquez la raison");
    const { error } = await supabase.from("bats").update({
      status: "rejete",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
      validated_at: null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Demande de modification envoyée");
    setShowReject(false);
    setReason("");
    load();
  };

  if (!bat) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const canDecide = bat.file_path && bat.status !== "valide";

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Link to="/portail" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Mes projets
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{bat.title}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            {bat.reference && <span>{bat.reference}</span>}
            <Badge variant="outline">{BAT_STATUS_LABEL[bat.status]}</Badge>
          </div>
        </div>
      </div>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">Spécifications</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ["Quantité", bat.quantity],
            ["Format", bat.format],
            ["Support", bat.support],
            ["Couleurs", bat.colors],
            ["Finitions", bat.finitions],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div>{val ?? "—"}</div>
            </div>
          ))}
        </div>
        {bat.observations && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-1">Observations</div>
            <div className="text-sm whitespace-pre-wrap">{bat.observations}</div>
          </div>
        )}
      </Card>

      {bat.file_path ? (
        <BatViewer batId={bat.id} filePath={bat.file_path} canAnnotate={canDecide} canResolve={false} />
      ) : (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Le BAT est en cours de préparation.
        </Card>
      )}

      {canDecide && (
        <Card className="p-5 mt-6">
          <h2 className="text-sm font-semibold mb-3">Validation du Bon à Tirer</h2>
          <p className="text-xs text-muted-foreground mb-4">
            En signant, vous reconnaissez avoir vérifié l'orthographe, la mise en page, les visuels,
            les couleurs (rendu écran à titre indicatif), le format et toutes les indications techniques.
            Votre signature vaut accord pour lancement de l'impression. Toute erreur non signalée avant
            validation ne pourra engager la responsabilité du studio.
          </p>
          {!showReject ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 flex-1 min-w-[220px]">
                <Label className="text-xs">Votre nom (signature) *</Label>
                <Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} maxLength={100} />
              </div>
              <Button onClick={validate}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Bon à tirer — Valider
              </Button>
              <Button variant="outline" onClick={() => setShowReject(true)}>
                <XCircle className="h-4 w-4 mr-1" /> Demander des modifications
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs">Précisez les modifications souhaitées</Label>
              <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
              <div className="flex gap-2">
                <Button onClick={reject} variant="destructive">Envoyer</Button>
                <Button variant="ghost" onClick={() => setShowReject(false)}>Annuler</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {bat.validated_at && (
        <Card className="p-5 mt-6 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>BAT validé le <strong>{fmtDateTime(bat.validated_at)}</strong>{bat.signed_by_name && <> par <strong>{bat.signed_by_name}</strong></>}.</span>
          </div>
        </Card>
      )}
    </div>
  );
}