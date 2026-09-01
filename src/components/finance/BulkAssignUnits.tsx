import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { toast } from "sonner";

/**
 * Affectation en masse : rattache les transactions non affectées à un pôle,
 * en filtrant par client ou par fournisseur (rattrapage de l'historique).
 */
export default function BulkAssignUnits({ onDone }: { onDone?: () => void }) {
  const { activeUnits } = useBusinessUnits();
  const [term, setTerm] = useState("");
  const [buId, setBuId] = useState<string>("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { count: c } = await supabase
        .from("finance_transactions")
        .select("id", { count: "exact", head: true })
        .is("business_unit_id", null)
        .neq("kind", "bank");
      setCount(c ?? 0);
    })();
  }, [busy]);

  const apply = async () => {
    if (!buId) return toast.error("Choisis un pôle");
    if (!term.trim()) return toast.error("Indique un client ou fournisseur");
    setBusy(true);
    const { error, count: updated } = await supabase
      .from("finance_transactions")
      .update({ business_unit_id: buId }, { count: "exact" })
      .is("business_unit_id", null)
      .ilike("counterparty", `%${term.trim()}%`);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${updated ?? 0} ligne(s) affectée(s)`);
    setTerm("");
    onDone?.();
  };

  return (
    <Card className="p-4">
      <div className="text-sm font-medium mb-1">Affectation en masse</div>
      <p className="text-xs text-muted-foreground mb-3">
        {count === null ? "…" : `${count} transaction(s) encore sans pôle.`} Recherche par fournisseur ou client, puis rattache-les.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-[220px]" placeholder="Fournisseur / client contient…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <Select value={buId} onValueChange={setBuId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pôle" /></SelectTrigger>
          <SelectContent>
            {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={apply} disabled={busy}>{busy ? "…" : "Affecter"}</Button>
      </div>
    </Card>
  );
}
