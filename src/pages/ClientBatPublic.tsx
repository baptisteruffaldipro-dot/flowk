import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ClientBatApproval from "@/components/ClientBatApproval";
import ClientOrderProgress, { ClientOrderHistory } from "@/components/ClientOrderProgress";
import DocumentViewer from "@/components/DocumentViewer";

import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import { BAT_STATUS_LABEL } from "@/lib/format";

export default function ClientBatPublic() {
  const { token } = useParams<{ token: string }>();
  const [bat, setBat] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  };
  useEffect(() => { load(); }, [token]);

  const validate = async (signedBy: string): Promise<boolean> => {
    if (!signedBy.trim()) { toast.error("Indiquez votre nom pour signer"); return false; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bat-public", {
      body: { action: "validate", token, signed_by: signedBy.trim() },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Erreur"); return false; }
    toast.success("BAT validé, merci !");
    await load();
    return true;
  };

  const reject = async (reason: string): Promise<boolean> => {
    if (!reason.trim()) { toast.error("Indiquez la raison"); return false; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("bat-public", {
      body: { action: "reject", token, reason: reason.trim() },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Erreur"); return false; }
    toast.success("Demande de modification envoyée");
    await load();
    return true;
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">{error}</div>;
  if (!bat) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;

  const canDecide = bat.file_path && bat.status !== "valide";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
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

      <div className="mb-8"><ClientOrderProgress step={bat.status === "valide" ? 2 : bat.file_path ? 1 : 0} events={[]} detail={bat.status === "valide" ? "BAT validé — récapitulatif et règlement auprès de l’atelier." : undefined} /></div>
      <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0">{fileUrl ? <DocumentViewer viewportClassName="h-[min(65vh,760px)]" src={fileUrl} isImage={/\.(png|jpe?g|webp|gif)(\?|$)/i.test(bat.file_path ?? "")} alt={bat.title} annotations={[]} canAnnotate={false} /> : <div className="bg-muted py-24 text-center text-sm text-muted-foreground">Le BAT est en cours de préparation.</div>}</div>
        <div className="min-w-0">{(canDecide || bat.status === "valide") && <ClientBatApproval busy={busy} approved={bat.status === "valide"} signedBy={bat.signed_by_name} signedAt={bat.signed_at ?? bat.validated_at} onApprove={validate} onCorrection={reject} />}</div>
      </section>
      {bat.validated_at && <ClientOrderHistory step={2} events={[{ label: "BAT validé", at: bat.validated_at, detail: bat.signed_by_name }]} />}
      <section className="border-y border-border py-6 mt-8">
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
      </section>

    </div>
  );
}