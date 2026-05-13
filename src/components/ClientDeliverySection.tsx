import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, FileWarning, Download, ExternalLink, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeDeliveryStatus, loadEntityInstallments,
  type DeliveryEntityType, type DeliveryGateRow, type InstallmentRow,
} from "@/lib/deliveryGate";
import { fmtMoney } from "@/lib/format";

type FileItem = { name: string; path?: string; url?: string };

type Props = {
  entityType: DeliveryEntityType;
  row: DeliveryGateRow;
  /** Liste des fichiers livrables (path dans le bucket) */
  deliverables: FileItem[];
  /** Bucket de stockage (par défaut "livrables", "logo-deliverables" pour logos) */
  bucket?: string;
  /** Récap financier optionnel à afficher (forfait, horaire, etc.) */
  pricingSummary?: { label: string; value: string }[];
};

export default function ClientDeliverySection({ entityType, row, deliverables, bucket, pricingSummary }: Props) {
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);

  useEffect(() => {
    loadEntityInstallments(entityType, row.id).then(setInstallments);
  }, [entityType, row.id]);

  const status = computeDeliveryStatus(entityType, row, installments);
  const totalDue = installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPaid = installments.reduce((s, i) => s + Number(i.paid_amount || 0), 0);

  const open = async (item: FileItem) => {
    if (status.state !== "available") return toast.error(status.reason);
    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!item.path) return;
    const b = bucket ?? (entityType === "logo_presentation" ? "logo-deliverables" : "livrables");
    const { data, error } = await supabase.storage.from(b).createSignedUrl(item.path, 60 * 5);
    if (error || !data) return toast.error("Lien indisponible");
    window.open(data.signedUrl, "_blank");
  };

  const badge = (() => {
    switch (status.state) {
      case "available":
        return <Badge className="bg-emerald-500 hover:bg-emerald-500"><Unlock className="h-3 w-3 mr-1" /> Disponible</Badge>;
      case "blocked_bat":
        return <Badge className="bg-amber-500 hover:bg-amber-500"><FileWarning className="h-3 w-3 mr-1" /> BAT à valider</Badge>;
      case "blocked_payment":
        return <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" /> Paiement requis</Badge>;
      case "no_invoice":
        return <Badge variant="outline">En préparation</Badge>;
    }
  })();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Livraison</h2>
        {badge}
      </div>

      {pricingSummary && pricingSummary.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1 mb-3">
          {pricingSummary.map((r) => (
            <div key={r.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {installments.length > 0 && (
        <div className="rounded-md border p-3 text-sm space-y-1 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Réglé</span>
            <span className="font-medium">{fmtMoney(totalPaid)} / {fmtMoney(totalDue)}</span>
          </div>
        </div>
      )}

      {row.invoice_url && (
        <a
          href={row.invoice_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-3"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Voir la facture
        </a>
      )}

      {deliverables.length === 0 ? (
        <div className="text-xs text-muted-foreground">Aucun fichier déposé pour le moment.</div>
      ) : (
        <div className="space-y-1">
          {deliverables.map((d, i) => {
            const isLink = !!d.url;
            return (
              <div key={d.path ?? d.url ?? i} className="flex items-center justify-between text-sm p-2 rounded hover:bg-secondary/60">
                <div className="flex items-center gap-2 min-w-0">
                  {isLink
                    ? <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{d.name}</span>
                </div>
                <Button
                  size="sm" variant={status.state === "available" ? "default" : "ghost"}
                  disabled={status.state !== "available"}
                  onClick={() => open(d)}
                  title={status.reason}
                >
                  {status.state === "available"
                    ? (isLink
                        ? <><ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir</>
                        : <><Download className="h-3.5 w-3.5 mr-1" /> Télécharger</>)
                    : <><Lock className="h-3.5 w-3.5 mr-1" /> Verrouillé</>}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {status.state !== "available" && (
        <p className="text-[11px] text-muted-foreground mt-3">{status.reason}.</p>
      )}
    </Card>
  );
}