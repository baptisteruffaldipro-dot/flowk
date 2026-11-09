import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { manualTiimePatch } from "@/lib/tiimeInvoice";

const today = () => new Date().toISOString().slice(0, 10);

export default function ManualTiimeDialog({
  open, onOpenChange, taskId, defaultAmountHT, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskId: string;
  defaultAmountHT: number;
  onDone: () => void;
}) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNumber("");
      setDate(today());
      setAmount(defaultAmountHT > 0 ? String(defaultAmountHT) : "");
    }
  }, [open, defaultAmountHT]);

  const save = async () => {
    if (!date) return toast.error("Indiquez la date de la facture");
    setSaving(true);
    const patch = manualTiimePatch(
      { number, date, amountHT: amount === "" ? null : Number(amount.replace(",", ".")) },
      crypto.randomUUID(),
    );
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tâche marquée comme facturée dans Tiime");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Déjà facturée dans Tiime</DialogTitle>
          <DialogDescription>
            Pour une facture faite directement dans Tiime. Rien n'est envoyé à Tiime ni au client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">N° de facture Tiime (facultatif)</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="ex. F-2026-042" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date de la facture</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant HT facturé</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Marquer comme facturée"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
