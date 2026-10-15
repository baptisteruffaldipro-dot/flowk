import PortalAnnotationsAdmin from "@/components/PortalAnnotationsAdmin";
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
import { Copy, Link as LinkIcon, Plus, Trash2, Lock, Unlock, RefreshCcw, Upload, FileText, ExternalLink, Send, MessageSquare, CheckCircle2 } from "lucide-react";
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
type PortalMessage = {
  id: string;
  author: string;
  body: string;
  created_at: string;
  kind?: string;
  resolved?: boolean;
};

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
  const [sendingReminder, setSendingReminder] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [fetchedClient, setFetchedClient] = useState<{ email?: string | null; name?: string | null } | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string>("");
  const [invoiceFilePath, setInvoiceFilePath] = useState<string | null>(null);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [computedTotal, setComputedTotal] = useState<number>(0);
  const [computedPresta, setComputedPresta] = useState<number>(0);
  const [computedPrint, setComputedPrint] = useState<number>(0);
  const [paymentSettings, setPaymentSettings] = useState<{
    iban?: string | null;
    bic?: string | null;
    account_holder?: string | null;
    bank_name?: string | null;
    transfer_note?: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [messageReply, setMessageReply] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingCorrection, setSendingCorrection] = useState(false);
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
    if (row?.id) {
      const { data: portalMessages } = await supabase
        .from("client_portal_messages")
        .select("id,author,body,created_at,kind,resolved")
        .eq("portal_id", row.id)
        .order("created_at", { ascending: true });
      setMessages((portalMessages as PortalMessage[] | null) ?? []);
    } else {
      setMessages([]);
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
    setComputedPresta(computed);

    // Ajout des commandes d'impression liées au portail
    const linkedIds: string[] =
      (row?.print_order_ids && row.print_order_ids.length > 0
        ? row.print_order_ids
        : row?.print_order_id
          ? [row.print_order_id]
          : []) ?? [];
    let printTotal = 0;
    if (linkedIds.length > 0) {
      const { data: linked } = await supabase.from("print_orders").select("id,amount").in("id", linkedIds);
      printTotal = (linked ?? []).reduce((s: number, o: any) => s + Number(o.amount || 0), 0);
    }
    printTotal = Math.round(printTotal * 100) / 100;
    setComputedPrint(printTotal);

    computed = Math.round((computed + printTotal) * 100) / 100;
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

    const { data: ps } = await supabase.from("payment_settings" as any).select("iban,bic,account_holder,bank_name,transfer_note").eq("id", 1).maybeSingle();
    setPaymentSettings(ps as any);

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
    await load();
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
    if (deliverables.length === 0) return toast.error("Ajoutez d'abord un fichier ou un lien");
    setSending(true);
    try {
      if (!portal.is_published) await publish(true);
      const { data, error } = await supabase.functions.invoke("send-app-email", {
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
      const { data, error } = await supabase.functions.invoke("send-app-email", {
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

  const sendPaymentReminder = async () => {
    if (!effEmail) return toast.error("Pas d'email client");
    setSendingReminder(true);
    try {
      if (!portal.is_published) await publish(true);
      const ht = Number(portal.amount_due_ttc ?? 0);
      const transferEnabled = (portal.payment_methods ?? []).includes("transfer");
      const { data, error } = await supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "payment-reminder",
          recipientEmail: effEmail,
          idempotencyKey: `payment-reminder-${entityId}-${Date.now()}`,
          templateData: {
            name: effName ?? "",
            portalUrl: publicUrl,
            paymentUrl: portal.payment_link_url ?? "",
            amountTtc: ht > 0 ? `${(ht * 1.2).toFixed(2).replace(".", ",")} € TTC` : "",
            transferEnabled,
            ribIban: paymentSettings?.iban ?? "",
            ribBic: paymentSettings?.bic ?? "",
            ribAccountHolder: paymentSettings?.account_holder ?? "",
            ribBankName: paymentSettings?.bank_name ?? "",
            ribTransferNote: paymentSettings?.transfer_note ?? "",
          },
        },
      });
      if (error || (data as any)?.error) throw error ?? new Error((data as any)?.error);
      toast.success("Relance paiement envoyée");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSendingReminder(false);
    }
  };

  const sendMessage = async () => {
    const body = messageReply.trim();
    if (!body) return;
    setSendingMessage(true);
    try {
      const { data, error } = await supabase
        .from("client_portal_messages")
        .insert({ portal_id: portal.id, author: "admin", body })
        .select("id,author,body,created_at")
        .single();
      if (error) throw error;
      setMessages((current) => [...current, data as PortalMessage]);
      setMessageReply("");
      if (notifyClient) {
        if (!effEmail) {
          toast.error("Message enregistré, mais aucun email client pour le prévenir");
        } else {
          if (!portal.is_published) await publish(true);
          const { data: r, error: e2 } = await supabase.functions.invoke("send-app-email", {
            body: {
              templateName: "portal-message",
              recipientEmail: effEmail,
              idempotencyKey: `portal-message-${(data as any).id}`,
              templateData: { name: effName ?? "", portalUrl: publicUrl, message: body, title: notifyContext?.description ?? "" },
            },
          });
          if (e2 || (r as any)?.error) toast.error("Message enregistré, mais l'email n'a pas pu partir");
          else toast.success("Message envoyé et client prévenu par email");
        }
      } else {
        toast.success("Message envoyé au client");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Impossible d’envoyer le message");
    } finally {
      setSendingMessage(false);
    }
  };

  const dispatchCorrection = async (body: string, sourceMessage?: PortalMessage) => {
    if (!portal?.id) return;
    setSendingCorrection(true);
    try {
      const { data, error } = await supabase
        .from("client_portal_messages")
        .insert({ portal_id: portal.id, author: "admin", body, kind: "correction" })
        .select("id,author,body,created_at,kind")
        .single();
      if (error) throw error;
      setMessages((current) => [...current, data as PortalMessage]);
      if (sourceMessage) {
        const { error: upErr } = await supabase
          .from("client_portal_messages")
          .update({ resolved: true })
          .eq("id", sourceMessage.id);
        if (upErr) throw upErr;
        setMessages((current) =>
          current.map((m) => (m.id === sourceMessage.id ? { ...m, resolved: true } : m))
        );
      }
      if (notifyClient && effEmail) {
        if (!portal.is_published) await publish(true);
        const { data: r, error: e2 } = await supabase.functions.invoke("send-app-email", {
          body: {
            templateName: "portal-corrected",
            recipientEmail: effEmail,
            idempotencyKey: `portal-corrected-${(data as any).id}`,
            templateData: {
              name: effName ?? "",
              portalUrl: publicUrl,
              message: body,
              title: notifyContext?.description ?? "",
            },
          },
        });
        if (e2 || (r as any)?.error) toast.error("Correction enregistrée, mais l'email n'a pas pu partir");
        else toast.success("Correction envoyée et client prévenu par email");
      } else {
        toast.success("Correction envoyée au client");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Impossible d’envoyer la correction");
    } finally {
      setSendingCorrection(false);
    }
  };

  const sendCorrection = () =>
    dispatchCorrection(
      messageReply.trim() ||
        "La modification demandée a été effectuée. Vous la trouverez dans votre espace client."
    ).then(() => setMessageReply(""));

  const sendCorrectionFor = (m: PortalMessage) => {
    const raw = m.body.replace(/^Observation du client\s*:?\s*/i, "").trim();
    const short = raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
    dispatchCorrection(
      short
        ? `Correction effectuée suite à votre observation : « ${short} »`
        : "Correction effectuée, vous la trouverez dans votre espace client.",
      m
    );
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

      {portal.status === "refused" && portal.refusal_reason && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 space-y-1">
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            Motif du refus client{portal.client_refused_at ? ` — ${new Date(portal.client_refused_at).toLocaleString("fr-FR")}` : ""}
          </div>
          <p className="text-sm whitespace-pre-wrap">{portal.refusal_reason}</p>
        </div>
      )}

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
              {(() => {
                const rv = (((portal as any).deliverable_reviews ?? []) as any[]).find((r) => r.file === d.name);
                if (rv?.status === "approved") return (
                  <Badge
                    className="text-[10px] bg-emerald-500 hover:bg-emerald-500"
                    title={rv.certificate_id ? `Certificat ${rv.certificate_id} — signé par ${rv.signed_by} le ${new Date(rv.at).toLocaleString("fr-FR")}` : undefined}
                  >
                    BAT validé{rv.signed_by ? ` · ${rv.signed_by} · ${new Date(rv.at).toLocaleDateString("fr-FR")}` : ""}
                  </Badge>
                );
                if (rv?.status === "changes_requested") return <Badge variant="destructive" className="text-[10px]">Modif. demandée</Badge>;
                return <Badge variant="outline" className="text-[10px]">BAT en attente</Badge>;
              })()}
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
            <Button size="sm" variant="outline" onClick={sendNotice} disabled={sending || deliverables.length === 0}>
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
              <Label className="text-xs">Montant dû HT</Label>
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
                ? `Synchronisé automatiquement : prestation ${computedPresta.toFixed(2)} € HT${computedPrint > 0 ? ` + impression ${computedPrint.toFixed(2)} € HT` : ""} = ${computedTotal.toFixed(2)} € HT.`
                : "Aucune facturation calculée — saisissez le montant HT manuellement."}
            </p>
            {portal.amount_due_ttc != null && portal.amount_due_ttc !== "" && (
              <div className="rounded-md border border-border/60 bg-background p-2.5 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prestation + impression HT</span>
                  <span className="tabular-nums">{Number(portal.amount_due_ttc).toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>TVA 20 %</span>
                  <span className="tabular-nums">{(Number(portal.amount_due_ttc) * 0.2).toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
                  <span className="text-sm font-semibold">Total TTC à payer</span>
                  <span className="text-lg font-semibold tabular-nums">{(Number(portal.amount_due_ttc) * 1.2).toFixed(2)} €</span>
                </div>
              </div>
            )}

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

        <div className="space-y-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={sendPaymentReminder}
            disabled={sendingReminder || !effEmail}
            title={effEmail ? `Relancer ${effEmail}` : "Aucun email client renseigné"}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {sendingReminder ? "Envoi…" : "Relancer le paiement par email"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Rappelle au client des moyens de règlement disponibles (carte ou virement) et que toute commande d'impression doit être réglée avant son lancement.
          </p>

        </div>

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

      {portal?.id && <PortalAnnotationsAdmin portalId={portal.id} />}

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          5 · Échanges
          {messages.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{messages.length}</Badge>}
        </div>
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun message pour le moment.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md p-3 text-sm ${
                  message.author === "client"
                    ? "bg-primary/10"
                    : message.kind === "correction"
                      ? "bg-emerald-500/10"
                      : "bg-muted/50"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                  <span>
                    {message.author === "client" ? "Client" : "Studio"} ·{" "}
                    {new Date(message.created_at).toLocaleString("fr-FR")}
                  </span>
                  {message.kind === "correction" && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[9px] uppercase">
                      Corrigé
                    </Badge>
                  )}
                  {message.author === "client" && message.resolved && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[9px] uppercase">
                      <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                      Corrigé
                    </Badge>
                  )}
                  {message.author === "client" && !message.resolved && (
                    <button
                      onClick={() => sendCorrectionFor(message)}
                      disabled={sendingCorrection}
                      title="Prévenir le client que cette observation a été traitée"
                      className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {sendingCorrection ? "Envoi…" : "Corrigé"}
                    </button>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{message.body}</div>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2 border-t border-border/60 pt-3">
          <Textarea
            rows={3}
            placeholder="Répondre au client…"
            value={messageReply}
            onChange={(event) => setMessageReply(event.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
            Prévenir le client par email{effEmail ? ` (${effEmail})` : " — aucun email enregistré"}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={sendMessage} disabled={!messageReply.trim() || sendingMessage}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sendingMessage ? "Envoi…" : "Envoyer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={sendCorrection}
              disabled={sendingCorrection}
              title="Prévenir le client que la modification demandée a été faite"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {sendingCorrection ? "Envoi…" : "Corrigé"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">6 · Notes internes</div>
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