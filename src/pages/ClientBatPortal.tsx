import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ClientBatApproval from "@/components/ClientBatApproval";
import ClientOrderProgress, { ClientOrderHistory } from "@/components/ClientOrderProgress";

import { Badge } from "@/components/ui/badge";

import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import BatViewer from "@/components/BatViewer";
import { BAT_STATUS_LABEL } from "@/lib/format";

export default function ClientBatPortal() {
  const { id } = useParams();
  const [bat, setBat] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("bats").select("*, clients(name), projects(name)").eq("id", id).maybeSingle();
    setBat(data);

  };
  useEffect(() => { load(); }, [id]);

  const validate = async (signedBy: string): Promise<boolean> => {
    if (!signedBy.trim()) { toast.error("Indiquez votre nom pour signer"); return false; }
    setBusy(true);
    const { error } = await supabase.from("bats").update({
      status: "valide",
      validated_at: new Date().toISOString(),
      signed_by_name: signedBy.trim(),
      signed_at: new Date().toISOString(),
      rejected_at: null,
      rejection_reason: null,
    }).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("BAT validé, merci !");
    await load();
    return true;
  };

  const reject = async (reason: string): Promise<boolean> => {
    if (!reason.trim()) { toast.error("Indiquez la raison"); return false; }
    setBusy(true);
    const { error } = await supabase.from("bats").update({
      status: "rejete",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
      validated_at: null,
    }).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    toast.success("Demande de modification envoyée");
    await load();
    return true;
  };

  if (!bat) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const canDecide = bat.file_path && bat.status !== "valide";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
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

      <div className="mb-8"><ClientOrderProgress step={bat.status === "valide" ? 2 : bat.file_path ? 1 : 0} events={[]} detail={bat.status === "valide" ? "BAT validé — récapitulatif et règlement auprès de l’atelier." : undefined} /></div>
      <section className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0">{bat.file_path ? <BatViewer batId={bat.id} filePath={bat.file_path} canAnnotate={canDecide} canResolve={false} compact={bat.status === "valide"} /> : <div className="bg-muted py-24 text-center text-sm text-muted-foreground">Le BAT est en cours de préparation.</div>}</div>
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