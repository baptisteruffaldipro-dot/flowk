import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BAT_PRINT_STATUS_LABEL, PRINT_STATUS_LABEL, fmtDate, fmtMoney, fmtMinutes } from "@/lib/format";

export default function PrintOrders() {
  const [bats, setBats] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState<any>({
    description: "", client_id: "", amount: "", status: "bat_en_attente",
    reference: "", quantity: "", format: "", grammage: "", support: "", colors: "", finitions: "", observations: "",
  });

  const load = async () => {
    const [b, o, c] = await Promise.all([
      supabase.from("bats").select("*, clients(name), projects(name)").eq("status", "valide").order("validated_at", { ascending: false }),
      supabase.from("print_orders").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    if (b.error) toast.error(b.error.message);
    setBats(b.data ?? []);
    setOrders(o.data ?? []);
    setClients(c.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const updateBatStatus = async (id: string, print_status: string) => {
    const { error } = await supabase.from("bats").update({ print_status: print_status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from("print_orders").update({ status: status as any }).eq("id", id);
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
    });
    if (error) return toast.error(error.message);
    toast.success("Commande créée");
    setOpen(false);
    setForm({ description: "", client_id: "", amount: "", status: "bat_en_attente", reference: "", quantity: "", format: "", grammage: "", support: "", colors: "", finitions: "", observations: "" });
    load();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Impressions"
        description={`${bats.length} BAT validé${bats.length > 1 ? "s" : ""} · ${orders.length} commande${orders.length > 1 ? "s" : ""} manuelle${orders.length > 1 ? "s" : ""}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouvelle commande</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nouvelle commande d'impression</DialogTitle></DialogHeader>
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
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
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
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Observations</Label>
                  <Input value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} maxLength={500} />
                </div>
              </div>
              <DialogFooter><Button onClick={createOrder}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">BAT validés</h2>
      <Card className="overflow-hidden mb-6">
        {bats.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun BAT validé. Les BAT apparaîtront ici une fois validés par le client.
          </div>
        ) : (
          <div className="divide-y">
            {bats.map((b) => (
              <div key={b.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40">
                <Link to={`/bats/${b.id}`} className="col-span-4 min-w-0">
                  <div className="font-medium truncate hover:underline">{b.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.clients?.name}{b.projects?.name ? ` · ${b.projects.name}` : ""}
                    {b.reference ? ` · réf. ${b.reference}` : ""}
                  </div>
                </Link>
                <div className="col-span-2 text-xs">
                  {b.quantity ? <Badge variant="secondary">{b.quantity} ex.</Badge> : <span className="text-muted-foreground">—</span>}
                </div>
                <div className="col-span-3 text-xs text-muted-foreground truncate">
                  {[b.format, b.support].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">{fmtDate(b.validated_at)}</div>
                <div className="col-span-2">
                  <Select value={b.print_status ?? "a_imprimer"} onValueChange={(v) => updateBatStatus(b.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BAT_PRINT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Commandes manuelles</h2>
      <Card className="overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucune commande manuelle</div>
        ) : (
          <div className="divide-y">
            {orders.map((o) => (
              <div key={o.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm hover:bg-secondary/40">
                <Link to={`/impressions/${o.id}`} className="col-span-5 min-w-0">
                  <div className="font-medium truncate hover:underline">{o.description}</div>
                  <div className="text-xs text-muted-foreground">{o.clients?.name}</div>
                </Link>
                <div className="col-span-2 text-xs text-muted-foreground">{fmtMinutes(o.total_minutes)}</div>
                <div className="col-span-2 font-medium">{fmtMoney(o.amount ? Number(o.amount) : null)}</div>
                <div className="col-span-3">
                  <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRINT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
