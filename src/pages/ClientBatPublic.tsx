import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BAT_STATUS_LABEL, fmtDateTime } from "@/lib/format";

export default function ClientBatPublic() {
  const { token } = useParams<{ token: string }>();
  const [bat, setBat] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState("");
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!token) return;
    const { data, error } = await supabase.functions.invoke("bat-public", {
      body: { action: "get", token },
    });
    if (error || !data || data.error) {
      setError(data?.error || "BAT introuvable");
      return;
    }
    setBat(data.bat);
    setFileUrl(data.fileUrl);
    if (data.bat?.signed_by_name) setSignedBy(data.bat.signed_by_name);
  };
  useEffect(() => { load(); }, [token]);

  const validate = async () => {
    if (!signedBy.trim()) return toast.error("Indiquez votre nom pour signer");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bat-public", {
      body: { action: "validate", token, signed_by: signedBy.trim() },
    });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Erreur");
    toast.success("BAT validé, merci !");
    load();
  };

  const reject = async () => {
    if (!reason.trim()) return toast.error("Indiquez la raison");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bat-public", {
      body: { action: "reject", token, reason: reason.trim() },
    });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Erreur");
    toast.success("Demande de modification envoyée");
    setShowReject(false);
    setReason("");
    load();
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">{error}</div>;
  if (!bat) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;

  const canDecide = bat.file_path && bat.status !== "valide";

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{bat.title}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            {bat.clients?.name && <span>{bat.clients.name}</span>}
            {bat.reference && <span>· {bat.reference}</span>}
            <Badge variant="outline">{BAT_STATUS_LABEL[bat.status]}</Badge>
          </div>
        </div>
      </div>

      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold mb-3">Spécifications</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ["Nombre de modèles", bat.models_count],
            ["Format", bat.format],
            ["Support", bat.support],
            ["Couleurs", bat.colors],
            ["Finitions", bat.finitions],
            ["Face imprimée", bat.printed_face],
            ["Coins", bat.corners],
            ["Pelliculage", bat.lamination],
            ["Dorure à chaud", bat.hot_foil],
            ["Couleur de la dorure", bat.foil_color],
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
        {bat.pricing_text && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">Tarifs (HT)</div>
            <div className="text-sm whitespace-pre-wrap">{bat.pricing_text}</div>
          </div>
        )}
      </Card>

      {fileUrl ? (
        <Card className="p-0 overflow-hidden">
          <iframe src={fileUrl} className="w-full h-[80vh]" title="BAT PDF" />
        </Card>
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
              <Button onClick={validate} disabled={busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Bon à tirer — Valider
              </Button>
              <Button variant="outline" onClick={() => setShowReject(true)} disabled={busy}>
                <XCircle className="h-4 w-4 mr-1" /> Demander des modifications
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs">Précisez les modifications souhaitées</Label>
              <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
              <div className="flex gap-2">
                <Button onClick={reject} variant="destructive" disabled={busy}>Envoyer</Button>
                <Button variant="ghost" onClick={() => setShowReject(false)} disabled={busy}>Annuler</Button>
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