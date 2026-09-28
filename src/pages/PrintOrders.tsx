import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Loader2, Sparkles, Trash2, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PRINT_STATUS_LABEL, PRINT_PAYMENT_LABEL, fmtDate, fmtMoney } from "@/lib/format";
import PrintProductsEditor, { PrintProduct } from "@/components/PrintProductsEditor";
import PriceTiersEditor, { PriceTier } from "@/components/PriceTiersEditor";
import ClientSelectField from "@/components/ClientSelectField";

// Parse un texte collé du type "25 ex. : 56 € HT" (une ligne par tarif)
function parseTiersText(raw: string): PriceTier[] {
  const out: PriceTier[] = [];
  for (const line of raw.split(/\n+/)) {
    const m = line.match(/([\d\s]+)\s*(?:ex\.?|exemplaires?)?\s*[:=–-]\s*([\d\s.,]+)\s*€?\s*(?:HT|TTC)?/i);
    if (!m) continue;
    const qty = parseInt(m[1].replace(/\s/g, ""), 10);
    const price = parseFloat(m[2].replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(price)) out.push({ quantity: qty, price });
  }
  return out;
}

export default function PrintOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [paidPrintIds, setPaidPrintIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [paymentFilter, setPaymentFilter] = useState("tous");
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [parsingNote, setParsingNote] = useState(false);
  const [form, setForm] = useState<any>({
    description: "", client_id: "", amount: "", status: "a_commander",
    reference: "", quantity: "", format: "", grammage: "", support: "", colors: "", finitions: "", observations: "",
    estimated_delivery_date: "",
  });
  const [products, setProducts] = useState<PrintProduct[]>([]);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [tiersText, setTiersText] = useState("");

  const load = async () => {
    const [o, c, inv] = await Promise.all([
      supabase.from("print_orders").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("invoices").select("print_order_id,status").eq("status", "payee").not("print_order_id", "is", null),
    ]);
    if (o.error) toast.error(o.error.message);
    setOrders(o.data ?? []);
    setClients(c.data ?? []);
    setPaidPrintIds(new Set(((inv.data as any[]) ?? []).map((r) => r.print_order_id)));
  };
  useEffect(() => { load(); }, []);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isUnpaid = (o: any) =>
    !paidPrintIds.has(o.id) && o.status !== "livre_paye" && (o.payment_status ?? "non_regle") !== "regle";

  const q = search.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "tous" && o.status !== statusFilter) return false;
    if (paymentFilter !== "tous" && (o.payment_status ?? "non_regle") !== paymentFilter) return false;
    if (!q) return true;
    const haystack = [o.description, o.reference, o.clients?.name, o.format, o.support, o.observations]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  const sortedOrders = [...filteredOrders].sort((a, b) => Number(isUnpaid(b)) - Number(isUnpaid(a)));

  const deleteSelected = async () => {
    if (!confirm(`Supprimer ${selected.size} commande(s) ? Cette action est définitive.`)) return;
    const { error } = await supabase.from("print_orders").delete().in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success("Commande(s) supprimée(s)");
    setSelected(new Set());
    load();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("print_orders").update({ status: status as any }).eq("id", id);
    load();
  };

  const updateOrderPayment = async (id: string, payment_status: string) => {
    await supabase.from("print_orders").update({ payment_status: payment_status as any }).eq("id", id);
    load();
  };

  const createOrder = async () => {
    if (!form.description.trim()) return toast.error("Description requise");
    if (!form.client_id) return toast.error("Client requis");
    const { error } = await supabase.from("print_orders").insert({
      description: form.description.trim(),
      client_id: form.client_id,
      amount: form.amount ? Number(form.amount) : null,
      status: form.status,
      reference: form.reference.trim() || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      format: form.format.trim() || null,
      grammage: form.grammage.trim() || null,
      support: form.support.trim() || null,
      colors: form.colors.trim() || null,
      finitions: form.finitions.trim() || null,
      observations: form.observations.trim() || null,
      estimated_delivery_date: form.estimated_delivery_date || null,
      products: products as any,
      price_tiers: tiers as any,
    });
    if (error) return toast.error(error.message);
    toast.success("Commande créée");
    setOpen(false);
    setForm({ description: "", client_id: "", amount: "", status: "a_commander", reference: "", quantity: "", format: "", grammage: "", support: "", colors: "", finitions: "", observations: "", estimated_delivery_date: "" });
    setProducts([]);
    setTiers([]);
    setTiersText("");
    setNoteText("");
    load();
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleScreenshotUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 5);
    if (imgs.length === 0) return toast.error("Sélectionnez une image");
    setParsing(true);
    try {
      const images = await Promise.all(imgs.map(fileToDataUrl));
      const { data, error } = await supabase.functions.invoke("parse-print-order", {
        body: { images },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((prev: any) => ({
        ...prev,
        description: data.description ?? prev.description,
        reference: data.reference ?? prev.reference,
        quantity: data.quantity != null ? String(data.quantity) : prev.quantity,
        format: data.format ?? prev.format,
        grammage: data.grammage ?? prev.grammage,
        support: data.support ?? prev.support,
        colors: data.colors ?? prev.colors,
        finitions: data.finitions ?? prev.finitions,
        observations: data.observations ?? prev.observations,
        amount: data.amount != null ? String(data.amount) : prev.amount,
      }));
      const extras = Array.isArray(data.products) ? data.products.slice(1) : [];
      if (extras.length > 0) {
        setProducts(extras.map((p: any) => ({
          description: p.description ?? "",
          quantity: p.quantity != null ? String(p.quantity) : "",
          format: p.format ?? "",
          support: p.support ?? "",
          finitions: p.finitions ?? "",
          amount: p.amount != null ? String(p.amount) : "",
        })));
      }
      toast.success(extras.length > 0 ? `${extras.length + 1} produits détectés` : "Champs remplis depuis la capture");
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse impossible");
    } finally {
      setParsing(false);
    }
  };

  const parseNote = async () => {
    const text = noteText.trim();
    if (!text) return toast.error("Saisis une note d'abord");
    setParsingNote(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-print-order", { body: { text } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((prev: any) => ({
        ...prev,
        description: data.description ?? prev.description,
        reference: data.reference ?? prev.reference,
        quantity: data.quantity != null ? String(data.quantity) : prev.quantity,
        format: data.format ?? prev.format,
        grammage: data.grammage ?? prev.grammage,
        support: data.support ?? prev.support,
        colors: data.colors ?? prev.colors,
        finitions: data.finitions ?? prev.finitions,
        observations: data.observations ?? prev.observations,
        amount: data.amount != null ? String(data.amount) : prev.amount,
      }));
      const extras = Array.isArray(data.products) ? data.products.slice(1) : [];
      if (extras.length > 0) {
        setProducts(extras.map((p: any) => ({
          description: p.description ?? "",
          quantity: p.quantity != null ? String(p.quantity) : "",
          format: p.format ?? "",
          support: p.support ?? "",
          finitions: p.finitions ?? "",
          amount: p.amount != null ? String(p.amount) : "",
        })));
      }
      toast.success(extras.length > 0 ? `${extras.length + 1} produits détectés` : "Champs remplis depuis la note");
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse impossible");
    } finally {
      setParsingNote(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Impressions"
        description={`${orders.length} commande${orders.length > 1 ? "s" : ""} d'impression`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouvelle commande</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nouvelle commande d'impression</DialogTitle></DialogHeader>
              <label
                className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-md cursor-pointer transition mb-3 ${parsing ? "opacity-60 pointer-events-none" : "hover:bg-secondary/50 hover:border-primary/40"}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleScreenshotUpload(e.dataTransfer.files); }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={parsing}
                  onChange={(e) => { handleScreenshotUpload(e.target.files); e.target.value = ""; }}
                />
                {parsing ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    {parsing ? "Analyse de la capture…" : "Importer une capture d'écran"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Glisse-dépose ou clique : l'IA remplit les champs depuis ta commande imprimeur
                  </div>
                </div>
              </label>
              <div className="mb-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Note libre</Label>
                  <Button type="button" size="sm" variant="outline" onClick={parseNote} disabled={parsingNote || !noteText.trim()}>
                    {parsingNote ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    Générer
                  </Button>
                </div>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Décris la commande en quelques mots (ex : 500 cartes de visite 85x55mm quadri R°/V°, couché mat 350g, pelliculage soft touch, livraison sous 7j, 120€)…"
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">L'IA analyse ta note et remplit automatiquement les champs ci-dessous.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Description *</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Référence</Label>
                  <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={50} placeholder="CMD-2026-001" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <ClientSelectField
                    value={form.client_id}
                    onChange={(v) => setForm({ ...form, client_id: v })}
                    clients={clients}
                    onClientCreated={(c) => setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantité</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Format</Label>
                  <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="A4, 100x200mm…" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Grammage</Label>
                  <Input value={form.grammage} onChange={(e) => setForm({ ...form, grammage: e.target.value })} placeholder="300g, 170g…" maxLength={50} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Support / papier</Label>
                  <Input value={form.support} onChange={(e) => setForm({ ...form, support: e.target.value })} placeholder="Couché mat, Offset…" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Couleurs</Label>
                  <Input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Quadri R°/V°" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Finitions</Label>
                  <Input value={form.finitions} onChange={(e) => setForm({ ...form, finitions: e.target.value })} placeholder="Pelliculage, vernis…" maxLength={150} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Montant (€)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date de livraison estimée</Label>
                  <Input type="date" value={form.estimated_delivery_date} onChange={(e) => setForm({ ...form, estimated_delivery_date: e.target.value })} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Observations</Label>
                  <Input value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} maxLength={500} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground block">Tarifs par quantité (HT)</Label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Coller un barème</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!tiersText.trim()}
                      onClick={() => {
                        const parsed = parseTiersText(tiersText);
                        if (parsed.length === 0) return toast.error("Aucun tarif détecté — format attendu : « 100 ex. : 70 € HT »");
                        setTiers(parsed);
                        toast.success(`${parsed.length} tarifs importés`);
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      Importer
                    </Button>
                  </div>
                  <Textarea
                    value={tiersText}
                    onChange={(e) => setTiersText(e.target.value)}
                    placeholder={"Colle le barème de l'imprimeur, une ligne par tarif :\n25 ex. : 56 € HT\n50 ex. : 62 € HT\n100 ex. : 70 € HT"}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">Une ligne par tarif. Tu peux ensuite ajuster chaque ligne.</p>
                </div>
                <PriceTiersEditor value={tiers} onChange={setTiers} />
              </div>
              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Produits additionnels
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Ajoutez d'autres produits regroupés dans cette même commande (ex : flyers + cartes + affiches).
                </p>
                <PrintProductsEditor value={products} onChange={setProducts} />
              </div>
              <DialogFooter><Button onClick={createOrder}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (description, client, référence…)"
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full md:w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {Object.entries(PRINT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="h-9 w-full md:w-44"><SelectValue placeholder="Paiement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les paiements</SelectItem>
            {Object.entries(PRINT_PAYMENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Commandes {filteredOrders.length !== orders.length && `(${filteredOrders.length}/${orders.length})`}
        </h2>
        {selected.size > 0 && (
          <Button size="sm" variant="destructive" onClick={deleteSelected}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer ({selected.size})
          </Button>
        )}
      </div>
      <Card className="overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucune commande manuelle</div>
        ) : (
          <div className="divide-y">
            {sortedOrders.map((o) => (
              <div key={o.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40">
                <div className="col-span-4 min-w-0 flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(o.id)}
                    onCheckedChange={(v) => {
                      const n = new Set(selected);
                      v ? n.add(o.id) : n.delete(o.id);
                      setSelected(n);
                    }}
                  />
                  <Link to={`/impressions/${o.id}`} className="min-w-0">
                    <div className="font-medium truncate hover:underline">
                      {o.has_unread_client_activity && <span className="inline-block mr-1.5 h-2 w-2 rounded-full bg-destructive align-middle" />}
                      {o.description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.clients?.name}
                      {o.selected_tier?.quantity ? ` · choix client : ${o.selected_tier.quantity} ex.` : ""}
                    </div>
                  </Link>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {o.estimated_delivery_date ? fmtDate(o.estimated_delivery_date) : "—"}
                </div>
                <div className="col-span-2 font-medium flex items-center gap-2">
                  {fmtMoney(o.amount ? Number(o.amount) : null)}
                  {(paidPrintIds.has(o.id) || o.payment_status === "regle" || o.status === "livre_paye") && (
                    <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white">Payé</Badge>
                  )}
                  {o.payment_status === "acompte_50" && (
                    <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500 text-white">Acompte 50%</Badge>
                  )}
                  {!paidPrintIds.has(o.id) && o.status !== "livre_paye" && (o.payment_status ?? "non_regle") === "non_regle" && (
                    <Badge className="text-[10px] bg-red-500 hover:bg-red-500 text-white">Non réglé</Badge>
                  )}
                </div>
                <div className="col-span-2">
                  <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRINT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select value={o.payment_status ?? "non_regle"} onValueChange={(v) => updateOrderPayment(o.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRINT_PAYMENT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
