import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "income" | "expense";

export default function FinanceForecasts({ embedded }: { embedded?: boolean } = {}) {
  const [items, setItems] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [balance, setBalance] = useState<number | null>(null);

  const load = async () => {
    const [f, b] = await Promise.all([
      supabase.from("finance_forecasts").select("*").order("planned_date"),
      supabase.from("bank_balances").select("amount").order("as_of_date", { ascending: false }).limit(1),
    ]);
    setItems(f.data ?? []);
    setBalance(Number(b.data?.[0]?.amount ?? 0));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!label || !amount || !date) return;
    await supabase.from("finance_forecasts").insert({ label, kind, amount_ttc: Number(amount), planned_date: date });
    setLabel(""); setAmount("");
    toast.success("Dépense simulée ajoutée");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("finance_forecasts").delete().eq("id", id);
    load();
  };

  const impactColor = (after: number) => {
    if (after > 5000) return "bg-emerald-500";
    if (after > 0) return "bg-amber-500";
    return "bg-rose-500";
  };

  let running = balance ?? 0;

  return (
    <div className={embedded ? "" : "p-6 md:p-8"}>
      {!embedded && <PageHeader title="Simulateur" description="Ajoute des dépenses ou entrées prévues et vois l'impact sur ta trésorerie." />}
      {!embedded && <FinanceNav />}
      <Card className="p-5 mb-6">
        <div className="grid md:grid-cols-5 gap-2 items-end">
          <div><Label className="text-xs">Libellé</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : URSSAF" /></div>
          <div><Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Dépense</SelectItem>
                <SelectItem value="income">Entrée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Montant TTC</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label className="text-xs">Date prévue</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <Button onClick={add}>Ajouter</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Libellé</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-right px-3 py-2">Montant</th>
              <th className="text-right px-3 py-2">Solde après</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => {
              running += f.kind === "income" ? Number(f.amount_ttc) : -Number(f.amount_ttc);
              const color = impactColor(running);
              return (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{fmtDate(f.planned_date)}</td>
                  <td className="px-3 py-2">{f.label}</td>
                  <td className="px-3 py-2 text-xs">{f.kind === "income" ? "Entrée" : "Dépense"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.kind === "income" ? "+" : "−"}{fmtMoney(Number(f.amount_ttc))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                      {fmtMoney(running)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => del(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune simulation</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}