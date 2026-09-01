import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

type Entity = "task" | "project" | "print_order";

const TABLE: Record<Entity, "tasks" | "projects" | "print_orders"> = {
  task: "tasks",
  project: "projects",
  print_order: "print_orders",
};

/**
 * Rattachement d'une tâche / projet / commande à un pôle d'activité,
 * et création explicite de la vente correspondante dans le module Finance
 * (jamais automatique, pour éviter les doublons avec l'import Tiime).
 */
export default function BusinessUnitCard({
  entity,
  id,
  businessUnitId,
  clientId,
  label,
  amountHt,
  onChanged,
}: {
  entity: Entity;
  id: string;
  businessUnitId: string | null;
  clientId?: string | null;
  label: string;
  amountHt: number;
  onChanged?: () => void;
}) {
  const { activeUnits } = useBusinessUnits();
  const [buId, setBuId] = useState<string | null>(businessUnitId);
  const [amount, setAmount] = useState<string>(String(amountHt || 0));
  const [supplierCost, setSupplierCost] = useState<string>("");
  const [existing, setExisting] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setBuId(businessUnitId), [businessUnitId]);
  useEffect(() => setAmount(String(amountHt || 0)), [amountHt]);

  const dedupeKey = `${entity}:${id}`;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finance_transactions")
        .select("id, amount_ht, date")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();
      setExisting(data ?? null);
    })();
  }, [dedupeKey, busy]);

  const saveUnit = async (v: string) => {
    const next = v === "none" ? null : v;
    setBuId(next);
    const { error } = await supabase.from(TABLE[entity]).update({ business_unit_id: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pôle mis à jour");
    onChanged?.();
  };

  const createSale = async () => {
    const ht = Number(amount) || 0;
    if (ht <= 0) return toast.error("Montant HT invalide");
    setBusy(true);
    const vat = ht * 0.2;
    const { error } = await supabase.from("finance_transactions").insert({
      kind: "sale",
      category: supplierCost ? "achat_revente" : "prestation",
      date: new Date().toISOString().slice(0, 10),
      label,
      amount_ht: ht,
      vat_amount: vat,
      amount_ttc: ht + vat,
      vat_rate: 20,
      supplier_cost_ht: supplierCost === "" ? null : Number(supplierCost),
      business_unit_id: buId,
      client_id: clientId ?? null,
      [entity === "task" ? "task_id" : entity === "project" ? "project_id" : "project_id"]: entity === "print_order" ? null : id,
      source: "manual",
      category_source: "entity",
      dedupe_key: dedupeKey,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Vente créée dans le module Finance");
  };

  return (
    <Card className="p-4 mb-4">
      <div className="text-sm font-semibold mb-3">Pilotage financier</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Pôle d'activité</Label>
          <Select value={buId ?? "none"} onValueChange={saveUnit}>
            <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non affecté</SelectItem>
              {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Montant HT à facturer</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Coût fournisseur HT (optionnel)</Label>
          <Input type="number" step="0.01" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} placeholder="—" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {existing ? (
          <span className="text-xs text-emerald-600">Vente déjà enregistrée ({fmtMoney(Number(existing.amount_ht))}).</span>
        ) : (
          <Button size="sm" onClick={createSale} disabled={busy}>
            <Receipt className="h-4 w-4 mr-1" /> Créer la vente dans Finance
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Création explicite pour éviter tout doublon avec l'import Tiime.
        </span>
      </div>
    </Card>
  );
}
