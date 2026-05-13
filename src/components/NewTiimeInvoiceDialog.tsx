import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { computeTaskBilling } from "@/lib/billing";

type Task = {
  id: string;
  title?: string | null;
  client_id?: string | null;
  billing_type?: string | null;
  flat_amount?: number | null;
  hourly_rate?: number | null;
  total_minutes?: number | null;
  hours?: number | null;
};

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (invoiceId: string) => void;
};

export default function NewTiimeInvoiceDialog({ task, open, onOpenChange, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [tiimeUrl, setTiimeUrl] = useState<string | null>(null);

  const suggested = useMemo(() => {
    if (!task) return { amount: 0, hours: "", hourly_rate: "" };
    const billing = computeTaskBilling(task as any);
    if (task.billing_type === "forfait") {
      return { amount: Number(task.flat_amount ?? 0), hours: "", hourly_rate: "" };
    }
    return {
      amount: billing.total ?? 0,
      hours: ((task.total_minutes ?? 0) / 60).toFixed(2),
      hourly_rate: String(task.hourly_rate ?? ""),
    };
  }, [task]);

  const [form, setForm] = useState({
    label: "",
    billing_type: "forfait",
    amount: "",
    hours: "",
    hourly_rate: "",
  });

  useEffect(() => {
    if (open && task) {
      setForm({
        label: task.title ?? "",
        billing_type: task.billing_type === "horaire" ? "horaire" : "forfait",
        amount: String(suggested.amount || ""),
        hours: suggested.hours,
        hourly_rate: suggested.hourly_rate,
      });
      setCreatedInvoiceId(null);
      setTiimeUrl(null);
    }
  }, [open, task?.id]);

  const computedAmount = useMemo(() => {
    if (form.billing_type === "horaire" && form.hours && form.hourly_rate) {
      return Number(form.hours) * Number(form.hourly_rate);
    }
    return form.amount ? Number(form.amount) : 0;
  }, [form]);

  const createDraftAndPush = async () => {
    if (!task) return;
    if (!task.client_id) return toast.error("Cette tâche n'a pas de client — impossible de facturer");
    if (!form.label.trim()) return toast.error("Libellé requis");
    if (computedAmount <= 0) return toast.error("Montant invalide");

    setSaving(true);
    try {
      // 1. Create local invoice row linked to the task.
      const { data: invoice, error } = await supabase.from("invoices").insert({
        label: form.label.trim(),
        client_id: task.client_id,
        task_id: task.id,
        amount: computedAmount,
        billing_type: form.billing_type,
        hours: form.billing_type === "horaire" && form.hours ? Number(form.hours) : null,
        hourly_rate: form.billing_type === "horaire" && form.hourly_rate ? Number(form.hourly_rate) : null,
        status: "a_facturer",
      } as any).select().single();
      if (error || !invoice) { toast.error(error?.message ?? "Erreur"); return; }

      setCreatedInvoiceId(invoice.id);

      // 2. Push to Tiime via edge function.
      setPushing(true);
      const { data, error: fnErr } = await supabase.functions.invoke("tiime-create-invoice", {
        body: { invoice_id: invoice.id },
      });
      if (fnErr || (data as any)?.error) {
        toast.warning(
          "Facture brouillon créée localement, mais l'envoi vers Tiime a échoué. Tu peux réessayer depuis la page Facturation.",
        );
        onCreated?.(invoice.id);
        onOpenChange(false);
        return;
      }
      const url = (data as any)?.url ?? null;
      setTiimeUrl(url);
      toast.success("Facture brouillon créée dans Tiime");
      onCreated?.(invoice.id);
    } finally {
      setSaving(false);
      setPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle facture brouillon Tiime</DialogTitle>
          <DialogDescription>
            Vérifie les infos pré-remplies depuis la tâche, puis crée la facture brouillon dans Tiime.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Libellé *</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} maxLength={200} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="forfait">Forfait</SelectItem>
                  <SelectItem value="horaire">Horaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.billing_type === "horaire" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Heures</Label>
                  <Input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taux €/h</Label>
                  <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
                </div>
              </>
            ) : (
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Montant (€) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-secondary/40 rounded px-3 py-2 flex items-center justify-between">
            <span>Total facture</span>
            <span className="font-semibold tabular-nums text-foreground">{fmtMoney(computedAmount)}</span>
          </div>

          {tiimeUrl && (
            <a
              href={tiimeUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le brouillon dans Tiime
            </a>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || pushing}>
            {createdInvoiceId ? "Fermer" : "Annuler"}
          </Button>
          {!createdInvoiceId && (
            <Button onClick={createDraftAndPush} disabled={saving || pushing}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Création…" : pushing ? "Envoi vers Tiime…" : "Créer le brouillon Tiime"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}