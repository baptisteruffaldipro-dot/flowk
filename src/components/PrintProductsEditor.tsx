import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export interface PrintProduct {
  description: string;
  quantity?: string;
  format?: string;
  support?: string;
  finitions?: string;
  amount?: string;
}

interface Props {
  value: PrintProduct[];
  onChange: (next: PrintProduct[]) => void;
}

const EMPTY: PrintProduct = { description: "", quantity: "", format: "", support: "", finitions: "", amount: "" };

export default function PrintProductsEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<PrintProduct>) => {
    onChange(value.map((p, j) => (i === j ? { ...p, ...patch } : p)));
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const add = () => onChange([...value, { ...EMPTY }]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {value.length === 0 ? "Aucun produit additionnel" : `${value.length} produit${value.length > 1 ? "s" : ""}`}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un produit
        </Button>
      </div>
      {value.length > 0 && (
        <div className="rounded-md border divide-y">
          {value.map((p, i) => (
            <div key={i} className="p-3 space-y-2 bg-secondary/20">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">Produit #{i + 1}</div>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                placeholder="Description (ex: Cartes de visite)"
                value={p.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Input placeholder="Qté" type="number" value={p.quantity ?? ""} onChange={(e) => update(i, { quantity: e.target.value })} />
                <Input placeholder="Format" value={p.format ?? ""} onChange={(e) => update(i, { format: e.target.value })} />
                <Input placeholder="Support" value={p.support ?? ""} onChange={(e) => update(i, { support: e.target.value })} />
                <Input placeholder="Finitions" value={p.finitions ?? ""} onChange={(e) => update(i, { finitions: e.target.value })} />
                <Input placeholder="Montant €" type="number" step="0.01" value={p.amount ?? ""} onChange={(e) => update(i, { amount: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}