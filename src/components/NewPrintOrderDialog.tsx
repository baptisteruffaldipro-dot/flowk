import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { computeTaskBilling } from "@/lib/billing";

type Task = {
  id: string;
  title?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  billing_type?: string | null;
  flat_amount?: number | null;
  hourly_rate?: number | null;
  total_minutes?: number | null;
};

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (printOrderId: string) => void;
};

export default function NewPrintOrderDialog({ task, open, onOpenChange, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: "",
    reference: "",
    quantity: "",
    format: "",
    support: "",
    grammage: "",
    colors: "",
    finitions: "",
    observations: "",
    amount: "",
    estimated_delivery_date: "",
  });

  useEffect(() => {
    if (open && task) {
      const billing = computeTaskBilling(task as any);
      const amt = task.billing_type === "forfait" ? (task.flat_amount ?? 0) : (billing.total ?? 0);
      setForm({
        description: task.title ?? "",
        reference: "",
        quantity: "",
        format: "",
        support: "",
        grammage: "",
        colors: "",
        finitions: "",
        observations: "",
        amount: amt > 0 ? String(amt) : "",
        estimated_delivery_date: "",
      });
    }
  }, [open, task?.id]);

  const create = async () => {
    if (!task) return;
    if (!task.client_id) return toast.error("Cette tâche n'a pas de client — impossible de créer une commande");
    if (!form.description.trim()) return toast.error("Description requise");

    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("print_orders").insert({
        description: form.description.trim(),
        client_id: task.client_id,
        project_id: task.project_id || null,
        amount: form.amount ? Number(form.amount) : null,
        status: "a_commander",
        reference: form.reference.trim() || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        format: form.format.trim() || null,
        grammage: form.grammage.trim() || null,
        support: form.support.trim() || null,
        colors: form.colors.trim() || null,
        finitions: form.finitions.trim() || null,
        observations: form.observations.trim() || null,
        estimated_delivery_date: form.estimated_delivery_date || null,
      }).select().single();
      if (error || !inserted) { toast.error(error?.message ?? "Erreur"); return; }

      toast.success("Commande d'impression créée");
      onCreated?.(inserted.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle commande d'impression</DialogTitle>
          <DialogDescription>
            Crée une commande d'impression liée à cette tâche. Les infos peuvent être complétées ensuite.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Description *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Référence</Label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantité</Label>
            <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="A4, A5…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Grammage</Label>
            <Input value={form.grammage} onChange={(e) => setForm({ ...form, grammage: e.target.value })} placeholder="170g…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Support</Label>
            <Input value={form.support} onChange={(e) => setForm({ ...form, support: e.target.value })} placeholder="Couché brillant…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Couleurs</Label>
            <Input value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Quadri R°/V°" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Finitions</Label>
            <Input value={form.finitions} onChange={(e) => setForm({ ...form, finitions: e.target.value })} placeholder="Pelliculage mat…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Montant (€ HT)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Livraison estimée</Label>
            <Input type="date" value={form.estimated_delivery_date} onChange={(e) => setForm({ ...form, estimated_delivery_date: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Observations</Label>
            <Textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Création…" : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}