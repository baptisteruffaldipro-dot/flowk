import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Unlock, FileWarning, CheckCircle2, ExternalLink, Send, Upload, Link2, Trash2, FileText, Download } from "lucide-react";
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
  /** bucket de stockage pour les fichiers livrables */
  bucket?: string;
};

export default function DeliveryGateCard({
  entityType, table, row, onUpdated, notifyTemplate, notifyContext, clientEmail, clientName, bucket,
}: Props) {
  const [installments, setInstallments] = useState<{ amount: number | string; paid_amount: number | string }[]>([]);
  const [invoiceUrl, setInvoiceUrl] = useState(row.invoice_url ?? "");
  const [sending, setSending] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const invoiceInput = useRef<HTMLInputElement>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const storageBucket = bucket ?? (entityType === "logo_presentation" ? "logo-deliverables" : "livrables");
  const deliverables: { name: string; path?: string; url?: string }[] = (row as any).deliverables ?? [];
  const invoiceFilePath: string | null = (row as any).invoice_file_path ?? null;

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

  const saveDeliverables = async (next: typeof deliverables) => {
    const { error } = await supabase.from(table as any).update({ deliverables: next }).eq("id", row.id);
    if (error) return toast.error(error.message);
    onUpdated();
  };

  const addLink = async () => {
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return toast.error("Lien invalide (http(s)://…)");
    const name = linkName.trim() || url.replace(/^https?:\/\//, "").slice(0, 60);
    await saveDeliverables([...deliverables, { name, url }]);
    setLinkUrl(""); setLinkName("");
    toast.success("Lien ajouté");
  };

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const next = [...deliverables];
      for (const file of Array.from(files)) {
        const path = `${row.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from(storageBucket).upload(path, file);
        if (error) { toast.error(error.message); continue; }
        next.push({ name: file.name, path });
      }
      await saveDeliverables(next);
      toast.success("Fichier(s) ajouté(s)");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeItem = async (item: { path?: string; url?: string }) => {
    if (item.path) {
      await supabase.storage.from(storageBucket).remove([item.path]);
    }
    await saveDeliverables(deliverables.filter((d) => (d.path ?? d.url) !== (item.path ?? item.url)));
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Lien indisponible");
    window.open(data.signedUrl, "_blank");
  };

  const uploadInvoice = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingInvoice(true);
    try {
      // remove previous if any
      if (invoiceFilePath) {
        await supabase.storage.from(storageBucket).remove([invoiceFilePath]);
      }
      const path = `${row.id}/facture-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from(storageBucket).upload(path, file);
      if (error) { toast.error(error.message); return; }
      await update({ invoice_file_path: path });
      toast.success("Facture ajoutée");
    } finally {
      setUploadingInvoice(false);
      if (invoiceInput.current) invoiceInput.current.value = "";
    }
  };

  const removeInvoice = async () => {
    if (invoiceFilePath) await supabase.storage.from(storageBucket).remove([invoiceFilePath]);
    await update({ invoice_file_path: null });
  };

  const openInvoice = async () => {
    if (!invoiceFilePath) return;
    const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(invoiceFilePath, 60 * 5);
    if (error || !data) return toast.error("Lien indisponible");
    window.open(data.signedUrl, "_blank");
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
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: notifyTemplate ?? "files-delivered",
          recipientEmail: clientEmail,
          idempotencyKey: `${notifyTemplate ?? "files-delivered"}-${row.id}-${Date.now()}`,
          templateData: {
            name: clientName ?? "",
            description: notifyContext?.description ?? "",
            portalUrl: notifyContext?.portalUrl ?? `${window.location.origin}/portail`,
          },
        },
      });
      if (error || (data as any)?.error) throw error ?? new Error((data as any)?.error);
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
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={invoiceInput}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => uploadInvoice(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => invoiceInput.current?.click()} disabled={uploadingInvoice}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {uploadingInvoice ? "Upload…" : invoiceFilePath ? "Remplacer le PDF" : "Uploader le PDF"}
            </Button>
            {invoiceFilePath && (
              <>
                <Button size="sm" variant="ghost" onClick={openInvoice}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Voir
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={removeInvoice}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
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

      <div className="border-t pt-4 mb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold">Fichiers livrables</div>
          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> {uploading ? "Upload…" : "Uploader un fichier"}
            </Button>
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-xs">Ajouter un lien externe (Google Drive, WeTransfer, Dropbox…)</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="url"
              placeholder="https://drive.google.com/…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Libellé (optionnel)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="sm:w-48"
            />
            <Button size="sm" variant="secondary" onClick={addLink} disabled={!linkUrl.trim()}>
              <Link2 className="h-3.5 w-3.5 mr-1.5" /> Ajouter
            </Button>
          </div>
        </div>

        {deliverables.length === 0 ? (
          <div className="text-xs text-muted-foreground">Aucun livrable pour le moment.</div>
        ) : (
          <div className="space-y-1">
            {deliverables.map((d, i) => {
              const isLink = !!d.url;
              return (
                <div key={d.path ?? d.url ?? i} className="flex items-center justify-between text-sm p-2 rounded hover:bg-secondary/60 border">
                  <div className="flex items-center gap-2 min-w-0">
                    {isLink
                      ? <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{d.name}</span>
                    {isLink && <span className="text-[10px] text-muted-foreground">(lien)</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isLink ? (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={d.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    ) : d.path ? (
                      <Button size="sm" variant="ghost" onClick={() => downloadFile(d.path!)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(d)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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