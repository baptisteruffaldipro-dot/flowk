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
import { Copy, Link as LinkIcon, Plus, Trash2, CheckCircle2, Lock, Unlock, RefreshCcw, Upload, FileText, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { getPublicAppUrl } from "@/lib/publicUrl";

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
  payment_state?: "unpaid" | "deposit_paid" | "paid";
  delivery_override: boolean;
  delivery_locked?: boolean;
  admin_notes: string | null;
  payment_methods: string[];
  payment_terms: "deposit_50" | "full" | "libre";
  amount_due_ttc: number | string | null;
  print_order_id: string | null;
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
  const [invoiceUrl, setInvoiceUrl] = useState<string>("");
  const [invoiceFilePath, setInvoiceFilePath] = useState<string | null>(null);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [amountDue, setAmountDue] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  const invoiceInput = useRef<HTMLInputElement>(null);

  const table = entityType === "task" ? "tasks" : "projects";
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
    setAmountDue(row?.amount_due_ttc != null ? String(row.amount_due_ttc) : "");
    if (clientId) {
      const { data: po } = await supabase
        .from("print_orders")
        .select("id,reference,description,amount,status")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      setPrintOrders(po ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  if (loading || !portal) {
    return <Card className="p-5 text-sm text-muted-foreground">Chargement du portail client…</Card>;
  }

  const publicUrl = `${getPublicAppUrl()}/p/c/${portal.share_token}`;

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

  const markPaid = async () => {
    await update({ admin_confirmed_paid_at: new Date().toISOString(), status: "paid", payment_state: "paid" } as any);
    toast.success("Marqué comme payé — livraison débloquée");
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
    if (!clientEmail) return toast.error("Pas d'email client");
    if (!isUnlocked) return toast.error("Livraison verrouillée — débloquez d'abord");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: notifyTemplate ?? "files-delivered",
          recipientEmail: clientEmail,
          idempotencyKey: `${notifyTemplate ?? "files-delivered"}-${entityId}-${Date.now()}`,
          templateData: {
            name: clientName ?? "",
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

  const payState: "unpaid" | "deposit_paid" | "paid" =
    portal.admin_confirmed_paid_at !== null ? "paid" : (portal.payment_state ?? "unpaid");

  const paidOk =
    portal.delivery_unlock_rule === "libre" ||
    (portal.delivery_unlock_rule === "acompte" && (payState === "deposit_paid" || payState === "paid")) ||
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
          {notifyTemplate && clientEmail && (
            <Button size="sm" variant="outline" onClick={sendNotice} disabled={sending || !isUnlocked}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sending ? "Envoi…" : "Notifier le client"}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Facture &amp; paiement</div>
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

        <div className="grid sm:grid-cols-2 gap-4 pb-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Moyens de paiement proposés au client</Label>
            <div className="flex items-center gap-4 pt-1">
              {[
                { key: "link", label: "Carte bancaire (lien)" },
                { key: "transfer", label: "Virement (RIB)" },
              ].map((m) => {
                const methods = portal.payment_methods ?? [];
                const on = methods.includes(m.key);
                return (
                  <label key={m.key} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) =>
                        update({
                          payment_methods: v
                            ? [...methods.filter((x) => x !== m.key), m.key]
                            : methods.filter((x) => x !== m.key),
                        } as any)
                      }
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Modalité</Label>
              <Select value={portal.payment_terms ?? "full"} onValueChange={(v) => update({ payment_terms: v } as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit_50">Acompte 50 %</SelectItem>
                  <SelectItem value="full">Totalité avant livraison</SelectItem>
                  <SelectItem value="libre">Libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant TTC dû</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                onBlur={() => update({ amount_due_ttc: amountDue === "" ? null : Number(amountDue) } as any)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pb-1">
          <Label className="text-xs">Commande d'impression liée</Label>
          <Select
            value={portal.print_order_id ?? "none"}
            onValueChange={(v) => update({ print_order_id: v === "none" ? null : v } as any)}
          >
            <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              {printOrders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {(o.reference ? `${o.reference} — ` : "") + (o.description ?? "Commande")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {portal.print_order_id && (
            <p className="text-[11px] text-muted-foreground">
              La mention « régler la facture pour lancer la production » s'affichera côté client.
            </p>
          )}
        </div>

        {portal.client_declared_paid_at && !portal.admin_confirmed_paid_at && (
          <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded p-2">
            Le client a déclaré avoir payé {new Date(portal.client_declared_paid_at).toLocaleString("fr-FR")}.
            {portal.client_declared_paid_note && <> — {portal.client_declared_paid_note}</>}
          </div>
        )}
        {(portal.payment_methods ?? []).includes("link") && (
          <div className="space-y-1.5">
            <Label className="text-xs">Lien de paiement carte (à coller — depuis ta compta externe)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://…"
                value={portal.payment_link_url ?? ""}
                onChange={(e) => setPortal({ ...portal, payment_link_url: e.target.value })}
              />
              <Button size="sm" variant="outline" onClick={() => update({
                payment_link_url: portal.payment_link_url,
                payment_link_sent_at: new Date().toISOString(),
              } as any)}>
                Enregistrer
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Visible par le client dans le bloc Paiement.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={markPaid} disabled={!!portal.admin_confirmed_paid_at}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marquer comme payé
          </Button>
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
              <SelectItem value="unpaid">Acompte non réglé / solde non réglé</SelectItem>
              <SelectItem value="deposit_paid">Acompte réglé — solde non réglé</SelectItem>
              <SelectItem value="paid">Solde totalement réglé</SelectItem>
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