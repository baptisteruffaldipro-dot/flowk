import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Check, X, Repeat } from "lucide-react";
import { toast } from "sonner";

type Group = {
  key: string;
  counterparty: string;
  amount: number;
  months: string[];
  ids: string[];
  lastDate: string;
};

export default function RecurringExpensesSuggestions({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("finance_transactions")
      .select("id,date,counterparty,amount_ttc,category")
      .eq("kind", "expense")
      .order("date", { ascending: false })
      .limit(2000);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const r of rows) {
      if (r.category === "frais_fixe") continue;
      const cp = (r.counterparty || "").trim();
      if (!cp) continue;
      const amt = Math.round(Number(r.amount_ttc || 0) * 100) / 100;
      if (amt <= 0) continue;
      const month = String(r.date).slice(0, 7);
      const key = `${cp.toLowerCase()}|${amt.toFixed(2)}`;
      if (dismissed.has(key)) continue;
      let g = map.get(key);
      if (!g) {
        g = { key, counterparty: cp, amount: amt, months: [], ids: [], lastDate: r.date };
        map.set(key, g);
      }
      if (!g.months.includes(month)) g.months.push(month);
      g.ids.push(r.id);
      if (r.date > g.lastDate) g.lastDate = r.date;
    }
    return Array.from(map.values())
      .filter((g) => g.months.length >= 3)
      .sort((a, b) => b.months.length - a.months.length || b.amount - a.amount);
  }, [rows, dismissed]);

  const validate = async (g: Group) => {
    const { error } = await supabase
      .from("finance_transactions")
      .update({ category: "frais_fixe", category_source: "user" })
      .in("id", g.ids);
    if (error) return toast.error(error.message);
    toast.success(`${g.ids.length} transactions catégorisées en frais fixe`);
    await load();
    onChange?.();
  };

  const dismiss = (g: Group) => {
    const next = new Set(dismissed);
    next.add(g.key);
    setDismissed(next);
  };

  if (loading) return null;
  if (groups.length === 0) return null;

  return (
    <Card className="p-4 mb-4 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <Repeat className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Suggestions frais fixes</h3>
        <Badge variant="secondary" className="text-xs">{groups.length}</Badge>
        <span className="text-xs text-muted-foreground ml-2">
          Dépenses récurrentes détectées (même fournisseur + même montant sur ≥ 3 mois).
        </span>
      </div>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.key} className="flex items-center gap-3 rounded-md bg-background border px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{g.counterparty}</div>
              <div className="text-xs text-muted-foreground">
                {fmtMoney(g.amount)} TTC · {g.months.length} mois · {g.ids.length} transactions
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => dismiss(g)}>
              <X className="h-3.5 w-3.5 mr-1" /> Ignorer
            </Button>
            <Button size="sm" onClick={() => validate(g)}>
              <Check className="h-3.5 w-3.5 mr-1" /> Valider
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}