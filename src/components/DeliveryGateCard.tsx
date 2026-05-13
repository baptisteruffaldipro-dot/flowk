import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Unlock, FileWarning, CheckCircle2, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import {
  computeDeliveryStatus, loadEntityInstallments, UNLOCK_RULE_LABEL,
  type DeliveryEntityType, type DeliveryGateRow,
} from "@/lib/deliveryGate";

type Props = {
  entityType: DeliveryEntityType;
  /** table name to update */
  table: "tasks" | "print_orders" | "logo_presentations";
  row: DeliveryGateRow & { client_id?: string | null };
  onUpdated: () => void;
  /** envoie l'email "fichiers prêts" via send-transactional-email */
  notifyTemplate?: "files-delivered" | "logo-ready";
  /** données passées à l'email */
  notifyContext?: { description?: string; portalUrl?: string };
  clientEmail?: string | null;
  clientName?: string | null;
};

export default function DeliveryGateCard({
  entityType, table, row, onUpdated, notifyTemplate, notifyContext, clientEmail, clientName,
}: Props) {
  const [installments, setInstallments] = useState<{ amount: number | string; paid_amount: number | string }[]>([]);
  const [invoiceUrl, setInvoiceUrl] = useState(row.invoice_url ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadEntityInstallments(entityType, row.id).then(setInstallments);
  }, [entityType, row.id]);

  useEffect(() => { setInvoiceUrl(row.invoice_url ?? ""); }, [row.invoice_url]);

  const status = computeDeliveryStatus(entityType, row, installments);

  const update = async (patch: Record<string, any>) => {
    const { error } = await supabase.from(table as any).update(patch).eq("id", row.id);
    if (error) return toast.error(error.message);
    onUpdated();
  };

  const toggleOverride = async (next: boolean) => {
    await update({
      delivery_override: next,
      delivery_override_at: next ? new Date().toISOString() : null,
      delivery_override_by: next ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
    });
    toast.success(next ? "Téléchargement autorisé manuellement" : "Override désactivé");
  };

  const sendNotice = async () => {
    if (!clientEmail) return toast.error("Pas d'email client");
    if (status.state !== "available") return toast.error("Livraison non disponible — débloquez d'abord");
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          template: notifyTemplate ?? "files-delivered",
          to: clientEmail,
          data: {
            name: clientName ?? "",
            description: notifyContext?.description ?? "",
            portalUrl: notifyContext?.portalUrl ?? `${window.location.origin}/portail`,
          },
        },
      });
      if (error) throw error;
      toast.success("Email envoyé au client");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  const badge = (() => {
    switch (status.state) {
      case "available":
        return <Badge className="bg-emerald-500 hover:bg-emerald-500"><Unlock className="h-3 w-3 mr-1" /> Disponible</Badge>;
      case "blocked_bat":
        return <Badge className="bg-amber-500 hover:bg-amber-500"><FileWarning className="h-3 w-3 mr-1" /> BAT en attente</Badge>;
      case "blocked_payment":
        return <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" /> Paiement requis</Badge>;
      case "no_invoice":
        return <Badge variant="outline"><FileWarning className="h-3 w-3 mr-1" /> Facture à créer</Badge>;
    }
  })();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Livraison au client</h2>
        {badge}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Règle de déblocage</Label>
          <Select
            value={row.delivery_unlock_rule}
            onValueChange={(v) => update({ delivery_unlock_rule: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="acompte">{UNLOCK_RULE_LABEL.acompte}</SelectItem>
              <SelectItem value="total">{UNLOCK_RULE_LABEL.total}</SelectItem>
              <SelectItem value="libre">{UNLOCK_RULE_LABEL.libre}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Lien de facture (Tiime, etc.)</Label>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://…"
              value={invoiceUrl}
              onChange={(e) => setInvoiceUrl(e.target.value)}
              onBlur={() => invoiceUrl !== (row.invoice_url ?? "") && update({ invoice_url: invoiceUrl || null })}
            />
            {invoiceUrl && (
              <Button variant="outline" size="icon" asChild>
                <a href={invoiceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Tu peux aussi joindre un PDF dans les pièces jointes / livrables.</p>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30 mb-3">
        <div>
          <div className="text-sm font-medium">Autoriser le téléchargement maintenant</div>
          <div className="text-[11px] text-muted-foreground">Bypass paiement et BAT — à n'utiliser que pour un cas particulier.</div>
        </div>
        <Switch checked={row.delivery_override} onCheckedChange={toggleOverride} />
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        État : <span className="font-medium text-foreground">{status.reason}</span>
        {row.delivery_override && row.delivery_override_at && (
          <> · override activé le {new Date(row.delivery_override_at).toLocaleString("fr-FR")}</>
        )}
      </div>

      {notifyTemplate && (
        <Button size="sm" variant="outline" onClick={sendNotice} disabled={sending || status.state !== "available"}>
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {sending ? "Envoi…" : "Notifier le client que les fichiers sont prêts"}
        </Button>
      )}
    </Card>
  );
}