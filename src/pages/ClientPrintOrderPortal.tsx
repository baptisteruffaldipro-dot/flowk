import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, XCircle, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PRINT_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import BatViewer from "@/components/BatViewer";
import ClientDeliverySection from "@/components/ClientDeliverySection";
import PrintDeliveryInfo from "@/components/PrintDeliveryInfo";

export default function ClientPrintOrderPortal() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("print_orders").select("*").eq("id", id).maybeSingle();
    setOrder(data);
  };
  useEffect(() => { load(); }, [id]);

  const validate = async () => {
    const { error } = await supabase.from("print_orders").update({
      bat_validated_at: new Date().toISOString(),
      status: "a_commander",
      bat_rejected_at: null,
      bat_rejection_reason: null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("BAT validé, merci !");
    load();
  };

  const reject = async () => {
    if (!reason.trim()) return toast.error("Indiquez la raison");
    const { error } = await supabase.from("print_orders").update({
      bat_rejected_at: new Date().toISOString(),
      bat_rejection_reason: reason.trim(),
      bat_validated_at: null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Demande de modification envoyée");
    setShowReject(false);
    setReason("");
    load();
  };

  const download = async (path: string) => {
    const { data } = await supabase.storage.from("livrables").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!order) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const canDecide = order.bat_file_path && !order.bat_validated_at;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <Link to="/portail" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Retour
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{order.description}</h1>
        <div className="text-sm text-muted-foreground mt-1 mb-6 flex items-center gap-2">
          <Badge variant="outline">{PRINT_STATUS_LABEL[order.status]}</Badge>
          {order.bat_validated_at && <Badge className="bg-emerald-500 hover:bg-emerald-500">BAT validé</Badge>}
          {order.bat_rejected_at && <Badge variant="destructive">Modifications demandées</Badge>}
        </div>

        <div className="mb-6"><PrintDeliveryInfo order={order} /></div>

        {order.bat_file_path ? (
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-semibold">Bon à tirer (BAT)</h2>
                <p className="text-xs text-muted-foreground">Cliquez sur le document pour ajouter un commentaire</p>
              </div>
              {canDecide && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowReject(!showReject)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Demander modification
                  </Button>
                  <Button size="sm" onClick={validate} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valider le BAT
                  </Button>
                </div>
              )}
            </div>

            {showReject && canDecide && (
              <Card className="p-3 mb-4 bg-secondary/40">
                <Textarea
                  placeholder="Expliquez ce qui doit être modifié…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <Button size="sm" className="mt-2" onClick={reject}>Envoyer</Button>
              </Card>
            )}

            {order.bat_validated_at && (
              <div className="text-xs text-emerald-700 mb-3">Validé le {fmtDateTime(order.bat_validated_at)}</div>
            )}
            {order.bat_rejection_reason && (
              <div className="text-xs italic mb-3 p-3 bg-rose-50 border border-rose-200 rounded">
                Demande envoyée : "{order.bat_rejection_reason}"
              </div>
            )}

            <BatViewer
              printOrderId={order.id}
              filePath={order.bat_file_path}
              canAnnotate={canDecide}
              canResolve={false}
            />
          </Card>
        ) : (
          <Card className="p-8 text-sm text-muted-foreground text-center mb-6">
            Aucun BAT à valider pour le moment.
          </Card>
        )}

        {((order.deliverables ?? []).length > 0 || order.invoice_file_path || order.invoice_url) && (
          <ClientDeliverySection
            entityType="print_order"
            row={order}
            deliverables={order.deliverables ?? []}
            invoiceFilePath={order.invoice_file_path}
          />
        )}
      </div>
    </div>
  );
}