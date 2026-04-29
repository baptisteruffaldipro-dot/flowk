import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, INVOICE_STATUS_LABEL } from "@/lib/format";

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ label: "", client_id: "", amount: "", status: "a_facturer" });

  const load = async () => {
    const [i, c] = await Promise.all([
      supabase.from("invoices").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setInvoices(i.data ?? []);
    setClients(c.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const t = { a_facturer: 0, facturee: 0, payee: 0 };
    invoices.forEach((i) => { t[i.status as keyof typeof t] += Number(i.amount); });
    return t;
  }, [invoices]);

  const create = async () => {
    if (!form.label.trim() || !form.client_id || !form.amount) return toast.error("Champs requis manquants");
    const { error } = await supabase.from("invoices").insert({
      label: form.label.trim(),
      client_id: form.client_id,
      amount: Number(form.amount),
      status: form.status,
    });
    if (error) return toast.error(error.message);
    toast.success("Ajouté");
    setOpen(false);
    setForm({ label: "", client_id: "", amount: "", status: "a_facturer" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "facturee") patch.invoiced_at = new Date().toISOString().slice(0, 10);
    if (status === "payee") patch.paid_at = new Date().toISOString().slice(0, 10);
    await supabase.from("invoices").update(patch).eq("id", id);
    load();
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Facturation"
        description="Suivi simple des prestations"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouvelle ligne</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle ligne de facturation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label className="text-xs">Libellé *</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Montant (€) *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">À facturer</div><div className="text-2xl font-semibold mt-2">{fmtMoney(totals.a_facturer)}</div></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">Facturé (en attente)</div><div className="text-2xl font-semibold mt-2">{fmtMoney(totals.facturee)}</div></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">Payé</div><div className="text-2xl font-semibold mt-2 text-success">{fmtMoney(totals.payee)}</div></Card>
      </div>

      <Card className="overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Aucune ligne</div>
        ) : (
          <div className="divide-y">
            {invoices.map((i) => (
              <div key={i.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm">
                <div className="col-span-6">
                  <div className="font-medium truncate">{i.label}</div>
                  <div className="text-xs text-muted-foreground">{i.clients?.name}</div>
                </div>
                <div className="col-span-3 font-medium">{fmtMoney(Number(i.amount))}</div>
                <div className="col-span-3">
                  <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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