import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import TransactionDialog, { TxRow } from "@/components/finance/TransactionDialog";
import { Plus, Pencil } from "lucide-react";

export default function FinanceTreasury() {
  const [balances, setBalances] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);

  const load = async () => {
    const [b, t, f, m] = await Promise.all([
      supabase.from("bank_balances").select("*").order("as_of_date", { ascending: false }),
      supabase.from("finance_transactions").select("kind, amount_ttc, due_date, paid_date, date").in("kind", ["sale", "expense"]),
      supabase.from("finance_forecasts").select("*").order("planned_date"),
      supabase.from("finance_transactions").select("*").eq("kind", "bank").order("date", { ascending: false }),
    ]);
    setBalances(b.data ?? []);
    setTx(t.data ?? []);
    setForecasts(f.data ?? []);
    setMovements(m.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const addManual = async () => {
    if (!manualAmount || !manualDate) return;
    await supabase.from("bank_balances").insert({ as_of_date: manualDate, amount: Number(manualAmount), source: "manual" });
    toast.success("Solde enregistré");
    setManualAmount("");
    load();
  };

  const chart = useMemo(() => {
    const start = balances[0]?.amount ?? 0;
    const startDate = balances[0]?.as_of_date ?? new Date().toISOString().slice(0, 10);
    const data: { day: string; solde: number }[] = [{ day: startDate, solde: Number(start) }];
    let running = Number(start);
    const events = [
      ...tx.filter((r: any) => !r.paid_date && r.due_date && r.due_date > startDate).map((r: any) => ({
        date: r.due_date, delta: r.kind === "sale" ? Number(r.amount_ttc) : -Number(r.amount_ttc),
      })),
      ...forecasts.filter((f: any) => f.planned_date > startDate).map((f: any) => ({
        date: f.planned_date, delta: f.kind === "income" ? Number(f.amount_ttc) : -Number(f.amount_ttc),
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const horizon = new Date(startDate); horizon.setDate(horizon.getDate() + 180);
    for (const e of events) {
      if (e.date > horizon.toISOString().slice(0, 10)) break;
      running += e.delta;
      data.push({ day: e.date, solde: running });
    }
    return data;
  }, [balances, tx, forecasts]);

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Trésorerie" description="Vue solde + prévisions 30/60/90 jours et 6 mois." />
      <FinanceNav />

      <Card className="p-5 mb-6">
        <div className="text-sm font-medium mb-2">Ajouter un solde manuel</div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">Date</Label><Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} /></div>
          <div><Label className="text-xs">Montant</Label><Input type="number" step="0.01" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="12345.67" /></div>
          <Button onClick={addManual} size="sm">Enregistrer</Button>
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <div className="text-sm font-medium mb-3">Prévision (jusqu'à 6 mois)</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
            <Area dataKey="solde" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Mouvements bancaires manuels</div>
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un mouvement
          </Button>
        </div>
        <div className="divide-y text-sm">
          {movements.map((m) => (
            <div key={m.id} className="py-2 flex items-center gap-3">
              <div className="w-24 text-xs text-muted-foreground">{fmtDate(m.date)}</div>
              <div className="flex-1 truncate">{m.label ?? "—"}</div>
              <div className={`tabular-nums font-medium ${Number(m.amount_ttc) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {Number(m.amount_ttc) >= 0 ? "+" : ""}{fmtMoney(Number(m.amount_ttc))}
              </div>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {movements.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Aucun mouvement manuel.</div>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Historique des soldes</div>
        <div className="divide-y text-sm">
          {balances.map((b) => (
            <div key={b.id} className="py-2 flex items-center gap-3">
              <div className="flex-1">{fmtDate(b.as_of_date)} <span className="text-xs text-muted-foreground ml-2">({b.source})</span></div>
              <div className="tabular-nums font-medium">{fmtMoney(Number(b.amount))}</div>
            </div>
          ))}
          {balances.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Aucun solde. Importe un fichier Tiime ou saisis-en un manuellement.</div>}
        </div>
      </Card>

      <TransactionDialog open={open} onOpenChange={setOpen} kind="bank" initial={editing} onSaved={load} />
    </div>
  );
}