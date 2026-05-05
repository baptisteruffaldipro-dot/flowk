import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { Plus, Trash2, Check, Wand2 } from "lucide-react";

type Installment = {
  id: string;
  invoice_id: string;
  position: number;
  label: string | null;
  amount: number;
  paid_amount: number;
  due_date: string;
  paid_at: string | null;
};

export default function InstallmentsManager({
  invoice,
  open,
  onOpenChange,
  onChanged,
}: {
  invoice: { id: string; label: string; amount: number; status: string };
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(false);
  const [genCount, setGenCount] = useState(3);
  const [genStart, setGenStart] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoice_installments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("position", { ascending: true });
    setItems((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, invoice.id]);

  const totals = useMemo(() => {
    const planned = items.reduce((s, x) => s + Number(x.amount), 0);
    const paid = items.reduce((s, x) => s + Number(x.paid_amount), 0);
    return { planned, paid, remaining: Number(invoice.amount) - paid };
  }, [items, invoice.amount]);

  const syncInvoiceStatus = async () => {
    const paid = items.reduce((s, x) => s + Number(x.paid_amount), 0)
      // include any pending update — re-fetch instead for safety
      ;
    const { data } = await supabase
      .from("invoice_installments")
      .select("paid_amount")
      .eq("invoice_id", invoice.id);
    const paidNow = ((data as any[]) ?? []).reduce((s, x) => s + Number(x.paid_amount), 0);
    if (paidNow >= Number(invoice.amount) && invoice.status !== "payee") {
      await supabase
        .from("invoices")
        .update({ status: "payee", paid_at: new Date().toISOString().slice(0, 10) } as any)
        .eq("id", invoice.id);
    }
    onChanged?.();
  };

  const generate = async () => {
    if (genCount < 1 || genCount > 36) return toast.error("Nombre de mensualités invalide");
    if (items.length > 0) {
      if (!confirm("Remplacer l'échéancier existant ?")) return;
      await supabase.from("invoice_installments").delete().eq("invoice_id", invoice.id);
    }
    const total = Number(invoice.amount);
    const base = Math.floor((total / genCount) * 100) / 100;
    const last = Math.round((total - base * (genCount - 1)) * 100) / 100;
    const start = new Date(genStart);
    const rows = Array.from({ length: genCount }).map((_, i) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      return {
        invoice_id: invoice.id,
        position: i,
        label: `Mensualité ${i + 1}/${genCount}`,
        amount: i === genCount - 1 ? last : base,
        due_date: d.toISOString().slice(0, 10),
      };
    });
    const { error } = await supabase.from("invoice_installments").insert(rows as any);
    if (error) return toast.error(error.message);
    toast.success("Échéancier généré");
    load();
  };

  const addOne = async () => {
    const pos = items.length;
    const start = new Date();
    start.setMonth(start.getMonth() + pos);
    const { error } = await supabase.from("invoice_installments").insert({
      invoice_id: invoice.id,
      position: pos,
      amount: Math.max(0, totals.remaining > 0 ? Math.round(totals.remaining * 100) / 100 : 0),
      due_date: start.toISOString().slice(0, 10),
      label: `Échéance ${pos + 1}`,
    } as any);
    if (error) return toast.error(error.message);
    load();
  };

  const updateRow = async (id: string, patch: Partial<Installment>) => {
    const { error } = await supabase.from("invoice_installments").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } as Installment : x)));
  };

  const removeRow = async (id: string) => {
    if (!confirm("Supprimer cette échéance ?")) return;
    const { error } = await supabase.from("invoice_installments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== id));
    syncInvoiceStatus();
  };

  const markPaid = async (row: Installment, full: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    const patch: any = full
      ? { paid_amount: Number(row.amount), paid_at: today }
      : { paid_at: null };
    if (!full) patch.paid_amount = 0;
    const { error } = await supabase.from("invoice_installments").update(patch).eq("id", row.id);
    if (error) return toast.error(error.message);
    await load();
    syncInvoiceStatus();
  };

  const setPaidAmount = async (row: Installment, value: string) => {
    const v = Number(value || 0);
    const patch: any = { paid_amount: v };
    if (v >= Number(row.amount)) patch.paid_at = new Date().toISOString().slice(0, 10);
    else patch.paid_at = null;
    await updateRow(row.id, patch);
    syncInvoiceStatus();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Échéancier — {invoice.label}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Total facture" value={fmtMoney(Number(invoice.amount))} />
          <Stat label="Encaissé" value={fmtMoney(totals.paid)} accent="text-success" />
          <Stat label="Restant" value={fmtMoney(Math.max(0, totals.remaining))} accent={totals.remaining > 0 ? "text-foreground" : "text-success"} />
        </div>

        <div className="rounded-md border p-3 bg-secondary/30 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Wand2 className="h-3 w-3" /> Générer un échéancier
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Mensualités</Label>
              <Input type="number" min={1} max={36} value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className="h-8 w-24" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">1ère échéance</Label>
              <Input type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)} className="h-8" />
            </div>
            <Button size="sm" onClick={generate}>Générer</Button>
            <Button size="sm" variant="outline" onClick={addOne}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Aucune échéance. Génère un échéancier ou ajoute une ligne.</div>
        ) : (
          <div className="divide-y border rounded-md">
            {items.map((row) => {
              const fullyPaid = !!row.paid_at && Number(row.paid_amount) >= Number(row.amount);
              const overdue = !fullyPaid && row.due_date < today;
              const partial = !fullyPaid && Number(row.paid_amount) > 0;
              return (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 text-sm">
                  <Input
                    className="col-span-3 h-8"
                    value={row.label ?? ""}
                    onChange={(e) => setItems((p) => p.map((x) => x.id === row.id ? { ...x, label: e.target.value } : x))}
                    onBlur={(e) => updateRow(row.id, { label: e.target.value })}
                  />
                  <Input
                    className="col-span-2 h-8"
                    type="date"
                    value={row.due_date}
                    onChange={(e) => updateRow(row.id, { due_date: e.target.value })}
                  />
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-right tabular-nums"
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => setItems((p) => p.map((x) => x.id === row.id ? { ...x, amount: Number(e.target.value) } : x))}
                      onBlur={(e) => updateRow(row.id, { amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      className="h-8 text-right tabular-nums"
                      type="number"
                      step="0.01"
                      value={row.paid_amount}
                      onChange={(e) => setItems((p) => p.map((x) => x.id === row.id ? { ...x, paid_amount: Number(e.target.value) } : x))}
                      onBlur={(e) => setPaidAmount(row, e.target.value)}
                      placeholder="Payé"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    {fullyPaid ? (
                      <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Payée</Badge>
                    ) : overdue ? (
                      <Badge variant="destructive" className="text-[10px]">En retard</Badge>
                    ) : partial ? (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Partiel</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">À venir</Badge>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={fullyPaid ? "Marquer non payée" : "Marquer payée"}
                      onClick={() => markPaid(row, !fullyPaid)}
                    >
                      <Check className={`h-3.5 w-3.5 ${fullyPaid ? "text-success" : "text-muted-foreground"}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeRow(row.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {Math.abs(totals.planned - Number(invoice.amount)) > 0.01 && items.length > 0 && (
          <div className="text-xs text-amber-600">
            ⚠ Total échéancier ({fmtMoney(totals.planned)}) ≠ montant facture ({fmtMoney(Number(invoice.amount))})
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-0.5 ${accent ?? ""}`}>{value}</div>
    </div>
  );
}