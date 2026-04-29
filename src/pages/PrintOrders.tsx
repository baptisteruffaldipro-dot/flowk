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
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PRINT_STATUS_LABEL, fmtMoney, fmtMinutes } from "@/lib/format";

export default function PrintOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ description: "", client_id: "", amount: "", status: "bat_en_attente" });

  const load = async () => {
    const [o, c] = await Promise.all([
      supabase.from("print_orders").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setOrders(o.data ?? []);
    setClients(c.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.description.trim()) return toast.error("Description requise");
    if (!form.client_id) return toast.error("Client requis");
    const { error } = await supabase.from("print_orders").insert({
      description: form.description.trim(),
      client_id: form.client_id,
      amount: form.amount ? Number(form.amount) : null,
      status: form.status,
    });
    if (error) return toast.error(error.message);
    toast.success("Commande créée");
    setOpen(false);
    setForm({ description: "", client_id: "", amount: "", status: "bat_en_attente" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("print_orders").update({ status: status as any }).eq("id", id);
    load();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Impressions"
        description={`${orders.length} commande${orders.length > 1 ? "s" : ""}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouvelle commande</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle commande d'impression</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Description *</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Montant (€)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Aucune commande</div>
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
                  <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
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