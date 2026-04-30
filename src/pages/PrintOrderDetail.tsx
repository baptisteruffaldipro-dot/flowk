import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, Download, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { PRINT_STATUS_LABEL, PRINT_PAYMENT_LABEL, fmtMoney, fmtDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BatViewer from "@/components/BatViewer";

export default function PrintOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const batInput = useRef<HTMLInputElement>(null);
  const livInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("print_orders")
      .select("*, clients(id,name,email,portal_user_id)")
      .eq("id", id)
      .maybeSingle();
    setOrder(data);
  };

  useEffect(() => { load(); }, [id]);

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

  const notify = async (kind: "bat_ready" | "delivered") => {
    if (!order?.clients?.email) return toast.error("Email client manquant");
    const { error } = await supabase.functions.invoke("send-transactional-email", {
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

  if (!order) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
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
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Client</div>
          <div className="text-sm mt-1">{order.clients?.name}</div>
          <div className="text-xs text-muted-foreground">{order.clients?.email ?? "—"}</div>
          {!order.clients?.portal_user_id && (
            <div className="text-[10px] text-amber-600 mt-1">Portail non activé</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Livrables</div>
          <div className="text-sm mt-1">{(order.deliverables ?? []).length} fichier(s)</div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Détails de la commande</h2>
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
              {(order.deliverables ?? []).map((d: any) => (
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
    </div>
  );
}