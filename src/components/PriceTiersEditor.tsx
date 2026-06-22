import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export type PriceTier = { quantity: number | null; models: number | null; price: number | null };

type Props = {
  value: PriceTier[];
  onChange: (v: PriceTier[]) => void;
  onBlur?: () => void;
};

export default function PriceTiersEditor({ value, onChange, onBlur }: Props) {
  const tiers = Array.isArray(value) ? value : [];
  const update = (i: number, patch: Partial<PriceTier>) => {
    const next = tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    onChange(next);
  };
  const remove = (i: number) => {
    const next = tiers.filter((_, idx) => idx !== i);
    onChange(next);
    onBlur?.();
  };
  const add = () => {
    onChange([...tiers, { quantity: null, models: null, price: null }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Tarifs par quantité et par modèle (HT)</Label>
        <Button type="button" size="sm" variant="ghost" onClick={add} className="h-7 px-2">
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>
      {tiers.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun tarif. Ex&nbsp;: 100&nbsp;ex. × 1&nbsp;modèle = 74&nbsp;€ HT</p>
      )}
      {tiers.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={t.quantity ?? ""}
            onChange={(e) => update(i, { quantity: e.target.value ? Number(e.target.value) : null })}
            onBlur={onBlur}
            placeholder="Quantité"
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">ex. ×</span>
          <Input
            type="number"
            min={1}
            value={t.models ?? ""}
            onChange={(e) => update(i, { models: e.target.value ? Number(e.target.value) : null })}
            onBlur={onBlur}
            placeholder="Modèles"
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">mod. =</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={t.price ?? ""}
            onChange={(e) => update(i, { price: e.target.value ? Number(e.target.value) : null })}
            onBlur={onBlur}
            placeholder="Prix"
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">€ HT</span>
          <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)} className="h-7 w-7 shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}