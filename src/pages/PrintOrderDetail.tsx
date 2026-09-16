import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, Download, Trash2, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PRINT_STATUS_LABEL, PRINT_PAYMENT_LABEL, fmtMoney, fmtDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BatViewer from "@/components/BatViewer";
import PrintProductsEditor, { PrintProduct } from "@/components/PrintProductsEditor";
import DeliveryGateCard from "@/components/DeliveryGateCard";
import ClientSelectField from "@/components/ClientSelectField";
import BusinessUnitCard from "@/components/finance/BusinessUnitCard";

export default function PrintOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const batInput = useRef<HTMLInputElement>(null);
  const livInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState<PrintProduct[]>([]);
  const [savingProducts, setSavingProducts] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [savingForm, setSavingForm] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; company?: string | null }[]>([]);
  const [editingClient, setEditingClient] = useState(false);


  const load = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("print_orders")
      .select("*, clients(id,name,email,portal_user_id)")
      .eq("id", id)
      .maybeSingle();
    setOrder(data);
    setProducts(((data as any)?.products as PrintProduct[]) ?? []);
    setForm({
      description: data?.description ?? "",
      reference: data?.reference ?? "",
      quantity: data?.quantity ?? "",
      format: data?.format ?? "",
      grammage: data?.grammage ?? "",
      support: data?.support ?? "",
      colors: data?.colors ?? "",
      finitions: data?.finitions ?? "",
      observations: data?.observations ?? "",
      amount: data?.amount ?? "",
    });
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    supabase.from("clients").select("id,name,company").order("name").then(({ data }) => {
      setClients((data as any) ?? []);
    });
  }, []);

  const changeClient = async (clientId: string) => {
    if (!id || !clientId) return;
    const { error } = await supabase.from("print_orders").update({ client_id: clientId }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Client mis à jour");
    setEditingClient(false);
    load();
  };



  const uploadBat = async (file: File) => {
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("bat").upload(path, file, { upsert: false });
    if (error) { setUploading(false); return toast.error(error.message); }
    await supabase.from("print_orders").update({
      bat_file_path: path,
      bat_uploaded_at: new Date().toISOString(),
      status: "a_commander",
      bat_validated_at: null,
      bat_rejected_at: null,
      bat_rejection_reason: null,
    }).eq("id", id);
    setUploading(false);
    toast.success("BAT envoyé. Le client peut maintenant le valider.");
    load();
  };

  const uploadLivrable = async (files: FileList) => {
    if (!order) return;
    setUploading(true);
    const newOnes: any[] = [];
    for (const file of Array.from(files)) {
      const path = `${order.client_id}/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("livrables").upload(path, file);
      if (error) { toast.error(error.message); continue; }
      newOnes.push({ path, name: file.name });
    }
    const updated = [...(order.deliverables ?? []), ...newOnes];
    await supabase.from("print_orders").update({ deliverables: updated }).eq("id", id);
    setUploading(false);
    load();
  };

  const removeDeliverable = async (path: string) => {
    await supabase.storage.from("livrables").remove([path]);
    const updated = (order.deliverables ?? []).filter((d: any) => d.path !== path);
    await supabase.from("print_orders").update({ deliverables: updated }).eq("id", id);
    load();
  };

  const downloadLivrable = async (path: string) => {
    const { data } = await supabase.storage.from("livrables").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const updateStatus = async (status: string) => {
    await supabase.from("print_orders").update({ status: status as any }).eq("id", id);
    load();
  };

  const updatePayment = async (payment_status: string) => {
    await supabase.from("print_orders").update({ payment_status: payment_status as any }).eq("id", id);
    load();
  };

  const updateEstimatedDelivery = async (value: string) => {
    await supabase.from("print_orders").update({ estimated_delivery_date: value || null }).eq("id", id);
    load();
  };

  const saveProducts = async () => {
    setSavingProducts(true);
    const { error } = await supabase.from("print_orders").update({ products: products as any }).eq("id", id);
    setSavingProducts(false);
    if (error) return toast.error(error.message);
    toast.success("Produits enregistrés");
    load();
  };

  const saveForm = async () => {
    setSavingForm(true);
    const payload: any = {
      description: form.description?.trim() || order.description,
      reference: form.reference || null,
      quantity: form.quantity === "" || form.quantity === null ? null : Number(form.quantity),
      format: form.format || null,
      grammage: form.grammage || null,
      support: form.support || null,
      colors: form.colors || null,
      finitions: form.finitions || null,
      observations: form.observations || null,
      amount: form.amount === "" || form.amount === null ? null : Number(form.amount),
    };
    const { error } = await supabase.from("print_orders").update(payload).eq("id", id);
    setSavingForm(false);
    if (error) return toast.error(error.message);
    toast.success("Commande mise à jour");
    setEditing(false);
    load();
  };

  const notify = async (kind: "bat_ready" | "delivered") => {
    if (!order?.clients?.email) return toast.error("Email client manquant");
    const { error } = await supabase.functions.invoke("send-app-email", {
      body: {
        templateName: kind === "bat_ready" ? "bat-ready" : "files-delivered",
        recipientEmail: order.clients.email,
        idempotencyKey: `${kind}-${id}-${Date.now()}`,
        templateData: {
          name: order.clients.name,
          description: order.description,
          portalUrl: `${window.location.origin}/portail`,
        },
      },
    });
    if (error) toast.error("Email indisponible — configurez d'abord les emails");
    else toast.success("Notification envoyée au client");
  };

  const deleteOrder = async () => {
    if (!id) return;
    try {
      const { data: invs } = await supabase.from("invoices").select("id").eq("print_order_id", id).limit(1);
      if (invs && invs.length > 0) {
        return toast.error("Impossible : des factures sont liées à cette commande.");
      }
      // Nettoyage best-effort des annotations & fichiers
      await supabase.from("bat_annotations").delete().eq("print_order_id", id);
      const paths = [
        ...(order?.bat_file_path ? [order.bat_file_path] : []),
      ];
      if (paths.length) await supabase.storage.from("bat").remove(paths);
      const livPaths = (order?.deliverables ?? []).map((d: any) => d.path).filter(Boolean);
      if (livPaths.length) await supabase.storage.from("livrables").remove(livPaths);
      const { error } = await supabase.from("print_orders").delete().eq("id", id);
      if (error) throw error;
      toast.success("Commande supprimée");
      navigate("/impressions");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la suppression");
    }
  };

  if (!order) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <Link to="/impressions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Impressions
      </Link>
      <PageHeader
        title={order.description}
        description={`${order.clients?.name} • ${fmtMoney(order.amount ? Number(order.amount) : null)}`}
        actions={
          <div className="flex gap-2">
            <Select value={order.status} onValueChange={updateStatus}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRINT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={order.payment_status ?? "non_regle"} onValueChange={updatePayment}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRINT_PAYMENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Action définitive. BAT, livrables et annotations seront supprimés. Les factures liées doivent être supprimées au préalable.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">BAT</div>
          {order.bat_validated_at ? (
            <div className="mt-1 text-sm">
              <Badge className="bg-emerald-500 hover:bg-emerald-500">Validé</Badge>
              <div className="text-xs text-muted-foreground mt-1">{fmtDateTime(order.bat_validated_at)}</div>
            </div>
          ) : order.bat_rejected_at ? (
            <div className="mt-1 text-sm">
              <Badge variant="destructive">Modifications demandées</Badge>
              {order.bat_rejection_reason && <div className="text-xs mt-1 italic">"{order.bat_rejection_reason}"</div>}
            </div>
          ) : order.bat_file_path ? (
            <div className="mt-1 text-sm">
              <Badge variant="outline">En attente client</Badge>
              <div className="text-xs text-muted-foreground mt-1">Envoyé {fmtDateTime(order.bat_uploaded_at)}</div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Aucun BAT envoyé</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Client</div>
            {!editingClient && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingClient(true)}>
                Changer
              </Button>
            )}
          </div>
          {editingClient ? (
            <div className="mt-2 space-y-2">
              <ClientSelectField
                value={order.client_id ?? ""}
                onChange={changeClient}
                clients={clients}
                onClientCreated={(c) => setClients((p) => [...p, c])}
                showCompany
              />
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingClient(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            <>
              <div className="text-sm mt-1">{order.clients?.name}</div>
              <div className="text-xs text-muted-foreground">{order.clients?.email ?? "—"}</div>
              {!order.clients?.portal_user_id && (
                <div className="text-[10px] text-amber-600 mt-1">Portail non activé</div>
              )}
            </>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Livrables</div>
          <div className="text-sm mt-1">{(order.deliverables ?? []).length} fichier(s)</div>
        </Card>
      </div>

      <BusinessUnitCard
        entity="print_order"
        id={order.id}
        businessUnitId={(order as any).business_unit_id ?? null}
        clientId={order.client_id}
        label={order.description ?? "Commande d'impression"}
        amountHt={Number(order.amount ?? 0)}
      />

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Détails de la commande</h2>
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); load(); }}>Annuler</Button>
              <Button size="sm" onClick={saveForm} disabled={savingForm}>
                {savingForm ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
          )}
        </div>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
              <Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Référence</Label>
              <Input className="mt-1" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quantité</Label>
              <Input className="mt-1" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Format</Label>
              <Input className="mt-1" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Grammage</Label>
              <Input className="mt-1" value={form.grammage} onChange={(e) => setForm({ ...form, grammage: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Support</Label>
              <Input className="mt-1" value={form.support} onChange={(e) => setForm({ ...form, support: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Couleurs</Label>
              <Input className="mt-1" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Finitions</Label>
              <Input className="mt-1" value={form.finitions} onChange={(e) => setForm({ ...form, finitions: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observations</Label>
              <Textarea className="mt-1" rows={3} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant €</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date de livraison estimée</Label>
              <Input
                type="date"
                className="mt-1 max-w-xs"
                value={order.estimated_delivery_date ?? ""}
                onChange={(e) => updateEstimatedDelivery(e.target.value)}
              />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Référence</div>
            <div>{order.reference || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Quantité</div>
            <div>{order.quantity ? `${order.quantity} ex.` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Format</div>
            <div>{order.format || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Grammage</div>
            <div>{order.grammage || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Support</div>
            <div>{order.support || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Couleurs</div>
            <div>{order.colors || "—"}</div>
          </div>
          <div className="col-span-2 md:col-span-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Finitions</div>
            <div>{order.finitions || "—"}</div>
          </div>
          <div className="col-span-2 md:col-span-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Observations</div>
            <div className="whitespace-pre-wrap">{order.observations || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Montant</div>
            <div>{fmtMoney(order.amount ? Number(order.amount) : null)}</div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date de livraison estimée</Label>
            <Input
              type="date"
              className="mt-1 max-w-xs"
              value={order.estimated_delivery_date ?? ""}
              onChange={(e) => updateEstimatedDelivery(e.target.value)}
            />
          </div>
        </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">Produits additionnels</h2>
            <p className="text-xs text-muted-foreground">Plusieurs produits regroupés dans cette commande</p>
          </div>
          <Button size="sm" onClick={saveProducts} disabled={savingProducts}>
            {savingProducts ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
        <PrintProductsEditor value={products} onChange={setProducts} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Bon à tirer</h2>
            <div className="flex gap-2">
              <input
                ref={batInput}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadBat(e.target.files[0])}
              />
              <Button size="sm" variant="outline" onClick={() => batInput.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5 mr-1" /> {order.bat_file_path ? "Remplacer" : "Envoyer BAT"}
              </Button>
              {order.bat_file_path && order.clients?.portal_user_id && !order.bat_validated_at && (
                <Button size="sm" onClick={() => notify("bat_ready")}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Notifier
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload une image (PNG/JPG) pour permettre les annotations cliquables, ou un PDF pour visualisation.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Fichiers livrés au client</h2>
            <div className="flex gap-2">
              <input
                ref={livInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadLivrable(e.target.files)}
              />
              <Button size="sm" variant="outline" onClick={() => livInput.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Ajouter
              </Button>
              {(order.deliverables ?? []).length > 0 && order.clients?.portal_user_id && (
                <Button size="sm" onClick={() => notify("delivered")}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Notifier
                </Button>
              )}
            </div>
          </div>
          {(order.deliverables ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground py-3">Aucun fichier</div>
          ) : (
            <div className="space-y-1">
              {(order.deliverables ?? []).filter((d: any) => d.path).map((d: any) => (
                <div key={d.path} className="flex items-center justify-between text-sm p-2 rounded hover:bg-secondary/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{d.name}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => downloadLivrable(d.path)}><Download className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeDeliverable(d.path)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {order.bat_file_path && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Visionneuse BAT & annotations</h2>
          <BatViewer
            printOrderId={order.id}
            filePath={order.bat_file_path}
            canAnnotate={false}
            canResolve={true}
          />
        </Card>
      )}

      <div className="mt-4">
        <DeliveryGateCard
          entityType="print_order"
          table="print_orders"
          row={order}
          clientEmail={order.clients?.email ?? null}
          clientName={order.clients?.name ?? null}
          notifyTemplate="files-delivered"
          notifyContext={{ description: order.description, portalUrl: `${window.location.origin}/portail/impression/${order.id}` }}
          onUpdated={load}
        />
      </div>
    </div>
  );
}