import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import TxSplitEditor, { SplitDraft, saveTxSplits } from "@/components/finance/TxSplitEditor";
import { toast } from "sonner";

/**
 * Ventilation rapide d'une ou plusieurs transactions entre plusieurs pôles.
 * En mode multiple, la même répartition en % est appliquée à chaque ligne.
 */
export default function SplitDialog({
  open,
  onOpenChange,
  transactionIds,
  amountHt,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionIds: string[];
  amountHt: number;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<SplitDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const single = transactionIds.length === 1;

  useEffect(() => {
    if (open) setRows([]);
  }, [open, transactionIds.join(",")]);

  const save = async () => {
    setSaving(true);
    try {
      for (const id of transactionIds) await saveTxSplits(id, rows);
      toast.success(
        rows.length
          ? `Ventilation enregistrée sur ${transactionIds.length} ligne(s).`
          : `Ventilation supprimée sur ${transactionIds.length} ligne(s).`,
      );
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Répartir entre plusieurs pôles</DialogTitle>
          <DialogDescription>
            {single
              ? "Indique la part de chaque pôle en % ou en € HT."
              : `La même répartition en % sera appliquée aux ${transactionIds.length} lignes sélectionnées.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <TxSplitEditor
            transactionId={single ? transactionIds[0] : null}
            amountHt={amountHt}
            value={rows}
            onChange={setRows}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
