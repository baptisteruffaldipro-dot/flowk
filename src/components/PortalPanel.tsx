import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Link as LinkIcon, Plus, Trash2, Lock, Unlock, RefreshCcw, Upload, FileText, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { getPublicAppUrl } from "@/lib/publicUrl";
import { computeTaskBilling } from "@/lib/billing";

type EntityType = "task" | "project";

type Portal = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  client_id: string | null;
  share_token: string;
  is_published: boolean;
  status: string;
  client_validated_at: string | null;
  client_refused_at: string | null;
  refusal_reason: string | null;
  payment_method_requested: string | null;
  payment_link_url: string | null;
  client_declared_paid_at: string | null;
  client_declared_paid_note: string | null;
  admin_confirmed_paid_at: string | null;
  delivery_unlock_rule: "acompte" | "total" | "libre";
  payment_state?: "unpaid" | "deposit_paid" | "balance_unpaid" | "paid";
  delivery_override: boolean;
  delivery_locked?: boolean;
  admin_notes: string | null;
  payment_methods: string[];
  payment_terms: "deposit_50" | "full" | "libre";
  amount_due_ttc: number | string | null;
  print_order_id: string | null;
  print_order_ids?: string[] | null;
};

type Deliverable = { name: string; url: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  awaiting_validation: "En attente de validation",
  validated: "Validé",
  refused: "Refusé",
  payment_pending: "Paiement en attente",
  payment_link_requested: "Lien de paiement demandé",
  paid: "Payé",
  delivered: "Livré",
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  awaiting_validation: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  validated: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  refused: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  payment_pending: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  payment_link_requested: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  delivered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export default function PortalPanel({
  entityType,
  entityId,
  clientId,
  clientEmail,
  clientName,
  notifyTemplate,
  notifyContext,
}: {
  entityType: EntityType;
  entityId: string;
  clientId?: string | null;
  clientEmail?: string | null;
  clientName?: string | null;
  notifyTemplate?: "files-delivered" | "logo-ready";
  notifyContext?: { description?: string; portalUrl?: string };
}) {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [fetchedClient, setFetchedClient] = useState<{ email?: string | null; name?: string | null } | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string>("");
  const [invoiceFilePath, setInvoiceFilePath] = useState<string | null>(null);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [computedTotal, setComputedTotal] = useState<number>(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const invoiceInput = useRef<HTMLInputElement>(null);

  const table = entityType === "task" ? "tasks" : "projects";
  const effEmail = clientEmail || fetchedClient?.email || null;
  const effName = clientName || fetchedClient?.name || null;
  const bucket = "livrables";
  const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 an

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_portals" as any)
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();
    let row: any = data;
    if (data) {
      setPortal(data as any);
    } else {
      // Ensure a portal row exists even for old entities
      const { data: created } = await supabase
        .from("client_portals" as any)
        .insert({ entity_type: entityType, entity_id: entityId, client_id: clientId ?? null })
        .select("*")
        .maybeSingle();
      row = created;
      setPortal(created as any);
    }
    const table = entityType === "task" ? "tasks" : "projects";
    const { data: e } = await supabase.from(table).select("deliverable_files,invoice_url,invoice_file_path").eq("id", entityId).maybeSingle();
    setDeliverables(((e as any)?.deliverable_files as Deliverable[]) ?? []);
    setInvoiceUrl(((e as any)?.invoice_url as string) ?? "");
    setInvoiceFilePath(((e as any)?.invoice_file_path as string) ?? null);

    // Solde prestation calculé depuis la facturation de la tâche (ou des tâches du projet)
    const BILLING_COLS =
      "billing_type,hourly_rate,flat_amount,estimated_minutes,total_minutes,client_revisions_count,free_revisions,extra_revision_rate";
    let computed = 0;
    if (entityType === "task") {
      const { data: t } = await supabase.from("tasks").select(BILLING_COLS).eq("id", entityId).maybeSingle();
      if (t) computed = computeTaskBilling(t as any).total;
    } else {
      const { data: ts } = await supabase.from("tasks").select(BILLING_COLS).eq("project_id", entityId);
      computed = (ts ?? []).reduce((s: number, t: any) => s + computeTaskBilling(t).total, 0);
    }
    computed = Math.round(computed * 100) / 100;
    setComputedTotal(computed);
    if (row?.id && computed > 0 && Number(row.amount_due_ttc ?? 0) !== computed) {
      const { data: synced } = await supabase
        .from("client_portals" as any)
        .update({ amount_due_ttc: computed })
        .eq("id", row.id)
        .select("*")
        .maybeSingle();
      if (synced) setPortal(synced as any);
    }

    if (clientId) {
      const { data: po } = await supabase
        .from("print_orders")
        .select("id,reference,description,amount,status")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      setPrintOrders(po ?? []);
      if (!clientEmail || !clientName) {
        const { data: c } = await supabase
          .from("clients")
          .select("name,email")
          .eq("id", clientId)
          .maybeSingle();
        if (c) setFetchedClient({ email: (c as any).email, name: (c as any).name });
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  if (loading || !portal) {
    return <Card className="p-5 text-sm text-muted-foreground">Chargement du portail client…</Card>;
  }

  const publicUrl = `${getPublicAppUrl()}/p/c/${portal.share_token}`;

  const selectedPrintOrders: string[] =
    (portal.print_order_ids && portal.print_order_ids.length > 0
      ? portal.print_order_ids
      : portal.print_order_id
        ? [portal.print_order_id]
        : []) ?? [];

  const update = async (patch: Partial<Portal>) => {
    const { data, error } = await supabase
      .from("client_portals" as any)
      .update(patch)
      .eq("id", portal.id)
      .select("*")
      .maybeSingle();
    if (error) return toast.error(error.message);
    setPortal(data as any);
  };

  const togglePrintOrder = async (id: string, on: boolean) => {
    const next = on
      ? Array.from(new Set([...selectedPrintOrders, id]))
      : selectedPrintOrders.filter((x) => x !== id);
    await update({ print_order_ids: next, print_order_id: next[0] ?? null } as any);
  };

  const publish = async (v: boolean) => {
    await update({
      is_published: v,
      status: v && portal.status === "draft" ? ("awaiting_validation" as any) : portal.status,
    } as any);
    toast.success(v ? "Portail publié" : "Portail dépublié");
  };

  const regenerateToken = async () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    await update({
      share_token: token,
      is_published: true,
      status: portal.status === "draft" ? ("awaiting_validation" as any) : portal.status,
    } as any);
    toast.success("Nouveau lien généré");
  };

  const copy = async () => {
    if (!portal.is_published) {
      await update({
        is_published: true,
        status: portal.status === "draft" ? ("awaiting_validation" as any) : portal.status,
      } as any);
    }
    navigator.clipboard.writeText(publicUrl);
    toast.success("Lien copié");
  };

  const markDelivered = async () => {
    await update({ delivered_at: new Date().toISOString(), status: "delivered" } as any);
    toast.success("Marqué comme livré");
  };

  const toggleOverride = async () => {
    await update({ delivery_override: !portal.delivery_override } as any);
  };

  const toggleLocked = async () => {
    await update({ delivery_locked: !portal.delivery_locked } as any);
  };

  const saveDeliverables = async (list: Deliverable[]) => {
    const table = entityType === "task" ? "tasks" : "projects";
    const { error } = await supabase.from(table).update({ deliverable_files: list as any }).eq("id", entityId);
    if (error) return toast.error(error.message);
    setDeliverables(list);
  };

  const addDeliverable = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    saveDeliverables([...deliverables, { name: newName.trim(), url: newUrl.trim() }]);
    setNewName(""); setNewUrl("");
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const next = [...deliverables];
      for (const file of Array.from(files)) {
        const path = `${entityId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file);
        if (error) { toast.error(error.message); continue; }
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
        if (signed?.signedUrl) next.push({ name: file.name, url: signed.signedUrl });
      }
      await saveDeliverables(next);
      toast.success("Fichier(s) ajouté(s)");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const updateEntity = async (patch: Record<string, any>) => {
    const { error } = await supabase.from(table as any).update(patch as any).eq("id", entityId);
    if (error) toast.error(error.message);
  };

  const uploadInvoice = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingInvoice(true);
    try {
      if (invoiceFilePath) {
        await supabase.storage.from(bucket).remove([invoiceFilePath]);
      }
      const file = files[0];
      const path = `${entityId}/facture-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) { toast.error(error.message); return; }
      await updateEntity({ invoice_file_path: path });
      setInvoiceFilePath(path);
      toast.success("Facture ajoutée");
    } finally {
      setUploadingInvoice(false);
      if (invoiceInput.current) invoiceInput.current.value = "";
    }
  };

  const openInvoice = async () => {
    if (!invoiceFilePath) return;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(invoiceFilePath, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const removeInvoice = async () => {
    if (invoiceFilePath) await supabase.storage.from(bucket).remove([invoiceFilePath]);
    await updateEntity({ invoice_file_path: null });
    setInvoiceFilePath(null);
  };

  const sendNotice = async () => {
    if (!effEmail) return toast.error("Pas d'email client");
    if (!isUnlocked) return toast.error("Livraison verrouillée — débloquez d'abord");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: notifyTemplate ?? "files-delivered",
          recipientEmail: effEmail,
          idempotencyKey: `${notifyTemplate ?? "files-delivered"}-${entityId}-${Date.now()}`,
          templateData: {
            name: effName ?? "",
            description: notifyContext?.description ?? "",
            portalUrl: notifyContext?.portalUrl ?? publicUrl,
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

  const sendLinkByEmail = async () => {
    const to = (linkEmail || effEmail || "").trim();
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return toast.error("Email invalide");
    setSendingLink(true);
    try {
      if (!portal.is_published) await publish(true);
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "onboarding-ready",
          recipientEmail: to,
          idempotencyKey: `portal-link-${entityId}-${Date.now()}`,
          templateData: { name: effName ?? "", portalUrl: publicUrl },
        },
      });
      if (error || (data as any)?.error) throw error ?? new Error((data as any)?.error);
      toast.success(`Lien envoyé à ${to}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSendingLink(false);
    }
  };

  const payState: "unpaid" | "deposit_paid" | "balance_unpaid" | "paid" =
    portal.admin_confirmed_paid_at !== null ? "paid" : (portal.payment_state ?? "unpaid");

  const paidOk =
    portal.delivery_unlock_rule === "libre" ||
    (portal.delivery_unlock_rule === "acompte" &&
      (payState === "deposit_paid" || payState === "balance_unpaid" || payState === "paid")) ||
    (portal.delivery_unlock_rule === "total" && payState === "paid");

  const isUnlocked =
    !portal.delivery_locked &&
    (portal.delivery_override || portal.status === "delivered" || paidOk);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold">Livraison &amp; portail client</h2>
            <Badge className={`text-[10px] ${STATUS_TONE[portal.status] ?? ""}`} variant="outline">
              {STATUS_LABEL[portal.status] ?? portal.status}
            </Badge>
            {isUnlocked ? (
              <Badge variant="outline" className="text-[10px] gap-1"><Unlock className="h-3 w-3" /> Livraison déverrouillée</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-3 w-3" /> Livraison verrouillée</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Lien partageable — validation, paiement et téléchargement des livrables.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={portal.is_published} onCheckedChange={publish} />
          <span className="text-xs text-muted-foreground">{portal.is_published ? "Publié" : "Non publié"}</span>
        </div>
      </div>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 · Lien client</div>
      {/* Lien */}
      <div className="space-y-1.5">
        <Label className="text-xs">Lien à envoyer au client</Label>
        <div className="flex gap-2">
          <Input readOnly value={publicUrl} className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" /> Copier</Button>
          <Button size="sm" variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer"><LinkIcon className="h-3.5 w-3.5 mr-1" /> Ouvrir</a>
          </Button>
          <Button size="sm" variant="ghost" onClick={regenerateToken} title="Régénérer un lien (invalide l'ancien)">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Envoyer le lien par email</Label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            placeholder={effEmail || "email@client.fr"}
            className="text-xs"
          />
          <Button size="sm" onClick={sendLinkByEmail} disabled={sendingLink}>
            <Send className="h-3.5 w-3.5 mr-1" /> {sendingLink ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {effEmail ? `Par défaut : ${effEmail}` : "Aucun email client enregistré — saisis une adresse."}
        </p>
      </div>
      </section>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2 · Livrables</div>
        {deliverables.length === 0 && (
          <div className="text-xs text-muted-foreground">Aucun fichier. Uploade un fichier ou ajoute une URL (WeTransfer, Drive…).</div>
        )}
        <div className="space-y-1">
          {deliverables.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm rounded border border-border px-2 py-1.5">
              <span className="flex-1 truncate">{d.name}</span>
              <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline truncate max-w-[40%]">{d.url}</a>
              <Button size="icon" variant="ghost" onClick={() => saveDeliverables(deliverables.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
          <Input placeholder="Nom du fichier" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <Button size="sm" variant="outline" onClick={addDeliverable}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> {uploading ? "Upload…" : "Uploader un fichier"}
          </Button>
          {notifyTemplate && effEmail && (
            <Button size="sm" variant="outline" onClick={sendNotice} disabled={sending || !isUnlocked}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sending ? "Envoi…" : "Notifier le client"}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Facture &amp; commande d'impression</div>
      {/* Facture */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Lien de facture</Label>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://…"
              value={invoiceUrl}
              onChange={(e) => setInvoiceUrl(e.target.value)}
              onBlur={() => updateEntity({ invoice_url: invoiceUrl || null })}
            />
            {invoiceUrl && (
              <Button variant="outline" size="icon" asChild>
                <a href={invoiceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ou uploader la facture (PDF)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={invoiceInput}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => uploadInvoice(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => invoiceInput.current?.click()} disabled={uploadingInvoice}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {uploadingInvoice ? "Upload…" : invoiceFilePath ? "Remplacer" : "Uploader le PDF"}
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Moyens de paiement proposés</Label>
            <div className="flex flex-col gap-1.5">
              {[
                { key: "link", label: "Carte bancaire (lien)" },
                { key: "transfer", label: "Virement (RIB)" },
              ].map((m) => {
                const active = (portal.payment_methods ?? []).includes(m.key);
                return (
                  <label key={m.key} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={active}
                      onCheckedChange={(v) =>
                        update({
                          payment_methods: v
                            ? [...(portal.payment_methods ?? []), m.key]
                            : (portal.payment_methods ?? []).filter((x) => x !== m.key),
                        } as any)
                      }
                    />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Modalité de règlement</Label>
            <Select value={portal.payment_terms ?? "libre"} onValueChange={(v) => update({ payment_terms: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit_50">Acompte de 50 %</SelectItem>
                <SelectItem value="full">Totalité</SelectItem>
                <SelectItem value="libre">Libre</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs">Montant dû TTC</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => load()}
              >
                <RefreshCcw className="h-3 w-3 mr-1" /> Resynchroniser
              </Button>
            </div>
            <Input
              type="number"
              step="0.01"
              value={portal.amount_due_ttc ?? ""}
              onChange={(e) => setPortal({ ...portal, amount_due_ttc: e.target.value })}
              onBlur={() =>
                update({
                  amount_due_ttc: portal.amount_due_ttc === "" || portal.amount_due_ttc == null ? null : Number(portal.amount_due_ttc),
                } as any)
              }
            />
            <p className="text-[11px] text-muted-foreground">
              {computedTotal > 0
                ? `Synchronisé automatiquement avec la facturation ${entityType === "task" ? "de la tâche" : "des tâches du projet"} (${computedTotal.toFixed(2)} €).`
                : "Aucune facturation calculée — saisissez le montant manuellement."}
            </p>
          </div>
        </div>

        {(portal.payment_methods ?? []).includes("link") && (
          <div className="space-y-1.5">
            <Label className="text-xs">Lien de paiement carte (Stripe, SumUp, PayPal…)</Label>
            <Input
              type="url"
              placeholder="https://…"
              value={portal.payment_link_url ?? ""}
              onChange={(e) => setPortal({ ...portal, payment_link_url: e.target.value })}
              onBlur={() => update({ payment_link_url: portal.payment_link_url || null } as any)}
            />
          </div>
        )}

        <div className="space-y-1.5 pb-1">
          <Label className="text-xs">Commandes d'impression liées</Label>
          {printOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune commande d'impression pour ce client.</p>
          ) : (
            <div className="rounded-md border divide-y max-h-56 overflow-auto">
              {printOrders.map((o) => {
                const checked = selectedPrintOrders.includes(o.id);
                return (
                  <label key={o.id} className="flex items-start gap-2 p-2 text-sm cursor-pointer hover:bg-secondary/40">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => togglePrintOrder(o.id, Boolean(v))}
                      className="mt-0.5"
                    />
                    <span>
                      {(o.reference ? `${o.reference} — ` : "") + (o.description ?? "Commande")}
                      {o.amount != null && (
                        <span className="text-muted-foreground"> · {Number(o.amount).toFixed(2)} €</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {selectedPrintOrders.length === 0
              ? "Aucune commande affichée dans le portail client."
              : `${selectedPrintOrders.length} commande${selectedPrintOrders.length > 1 ? "s" : ""} affichée${selectedPrintOrders.length > 1 ? "s" : ""} dans le portail client.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={markDelivered} disabled={portal.status === "delivered"}>
            Marquer comme livré
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">4 · Accès au téléchargement</div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Règle de déblocage des livrables</Label>
          <Select value={portal.delivery_unlock_rule} onValueChange={(v) => update({ delivery_unlock_rule: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Solde total payé</SelectItem>
              <SelectItem value="acompte">Acompte payé</SelectItem>
              <SelectItem value="libre">Libre (aucun verrou)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Statut de règlement</Label>
          <Select
            value={payState}
            onValueChange={(v) =>
              update({
                payment_state: v,
                ...(v === "paid"
                  ? { admin_confirmed_paid_at: new Date().toISOString(), status: "paid" }
                  : { admin_confirmed_paid_at: null }),
              } as any)
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">Acompte non réglé</SelectItem>
              <SelectItem value="deposit_paid">Acompte réglé</SelectItem>
              <SelectItem value="balance_unpaid">Solde non réglé</SelectItem>
              <SelectItem value="paid">Solde réglé</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {paidOk
              ? "Règlement suffisant : téléchargement autorisé selon la règle choisie."
              : "Règlement insuffisant : aperçu seul, téléchargement bloqué."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Override manuel</Label>
          <div className="flex items-center gap-2">
            <Switch checked={portal.delivery_override} onCheckedChange={toggleOverride} />
            <span className="text-xs text-muted-foreground">
              Autoriser le téléchargement même sans paiement
            </span>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Switch checked={!!portal.delivery_locked} onCheckedChange={toggleLocked} />
            <span className="text-xs text-muted-foreground">
              Bloquer le téléchargement (prioritaire sur tout le reste)
            </span>
          </div>
        </div>
      </div>
      </section>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">5 · Notes internes</div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes admin (non visibles par le client)</Label>
        <Textarea
          rows={2}
          value={portal.admin_notes ?? ""}
          onChange={(e) => setPortal({ ...portal, admin_notes: e.target.value })}
          onBlur={() => update({ admin_notes: portal.admin_notes } as any)}
        />
      </div>
      </section>

    </Card>
  );
}