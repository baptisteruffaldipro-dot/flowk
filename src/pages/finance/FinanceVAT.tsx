import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export default function FinanceVAT({ embedded }: { embedded?: boolean } = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [adj, setAdj] = useState<any[]>([]);
  const [reservePct, setReservePct] = useState<number>(0);
  const [newAdjMonth, setNewAdjMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [newAdjAmount, setNewAdjAmount] = useState<string>("");
  const [newAdjNote, setNewAdjNote] = useState<string>("");

  const load = async () => {
    const [tx, va] = await Promise.all([
      supabase.from("finance_transactions").select("kind, vat_amount, date").in("kind", ["sale", "expense"]),
      supabase.from("vat_adjustments").select("*").order("period_month", { ascending: false }),
    ]);
    setRows(tx.data ?? []);
    setAdj(va.data ?? []);
    setReservePct(Number(va.data?.[0]?.reserve_pct ?? 0));
  };
  useEffect(() => { load(); }, []);

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; collected: number; deductible: number }>();
    rows.forEach((r) => {
      const m = r.date?.slice(0, 7); if (!m) return;
      if (!map.has(m)) map.set(m, { month: m, collected: 0, deductible: 0 });
      const v = map.get(m)!;
      if (r.kind === "sale") v.collected += Number(r.vat_amount || 0);
      else v.deductible += Number(r.vat_amount || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [rows]);

  const totalCollected = byMonth.reduce((a, b) => a + b.collected, 0);
  const totalDeductible = byMonth.reduce((a, b) => a + b.deductible, 0);
  const totalAdj = adj.reduce((a, r) => a + Number(r.adjustment || 0), 0);
  const net = totalCollected - totalDeductible + totalAdj;

  const saveReserve = async () => {
    const period = new Date().toISOString().slice(0, 7) + "-01";
    await supabase.from("vat_adjustments").insert({ period_month: period, adjustment: 0, reserve_pct: reservePct });
    toast.success("Réserve TVA mise à jour");
    load();
  };

  const addAdjustment = async () => {
    if (!newAdjMonth || !newAdjAmount) return toast.error("Mois et montant requis");
    const { error } = await supabase.from("vat_adjustments").insert({
      period_month: newAdjMonth + "-01",
      adjustment: Number(newAdjAmount),
      note: newAdjNote || null,
      reserve_pct: reservePct,
    });
    if (error) return toast.error(error.message);
    toast.success("Ajustement ajouté");
    setNewAdjAmount(""); setNewAdjNote("");
    load();
  };

  const removeAdjustment = async (id: string) => {
    if (!confirm("Supprimer cet ajustement ?")) return;
    const { error } = await supabase.from("vat_adjustments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className={embedded ? "" : "p-6 md:p-8"}>
      {!embedded && <PageHeader title="TVA" description="Collectée, déductible, nette. Estimation à provisionner." />}
      {!embedded && <FinanceNav />}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><div className="text-xs text-muted-foreground">TVA collectée</div><div className="text-xl font-semibold mt-1">{fmtMoney(totalCollected)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">TVA déductible</div><div className="text-xl font-semibold mt-1">{fmtMoney(totalDeductible)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">TVA nette (à payer)</div><div className="text-xl font-semibold mt-1">{fmtMoney(net)}</div></Card>
      </div>

      <Card className="p-5 mb-6">
        <div className="text-sm font-medium mb-2">Réserve TVA</div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">Pourcentage à provisionner</Label>
            <Input type="number" min={0} max={100} value={reservePct} onChange={(e) => setReservePct(Number(e.target.value))} className="w-32" />
          </div>
          <Button onClick={saveReserve} size="sm">Enregistrer</Button>
          <div className="text-sm text-muted-foreground">Réserve : <span className="font-medium text-foreground">{fmtMoney((reservePct / 100) * net)}</span></div>
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <div className="text-sm font-medium mb-2">Ajustements TVA manuels</div>
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <div><Label className="text-xs">Mois</Label><Input type="month" value={newAdjMonth} onChange={(e) => setNewAdjMonth(e.target.value)} /></div>
          <div><Label className="text-xs">Ajustement (€, signé)</Label><Input type="number" step="0.01" value={newAdjAmount} onChange={(e) => setNewAdjAmount(e.target.value)} placeholder="ex: -120.50" /></div>
          <div className="flex-1 min-w-[200px]"><Label className="text-xs">Note</Label><Input value={newAdjNote} onChange={(e) => setNewAdjNote(e.target.value)} placeholder="Régularisation…" /></div>
          <Button size="sm" onClick={addAdjustment}><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        </div>
        <div className="divide-y text-sm">
          {adj.filter((a) => Number(a.adjustment) !== 0 || a.note).map((a) => (
            <div key={a.id} className="py-2 flex items-center gap-3">
              <div className="w-24 text-xs text-muted-foreground">{String(a.period_month).slice(0, 7)}</div>
              <div className="flex-1 truncate">{a.note ?? "—"}</div>
              <div className={`tabular-nums font-medium ${Number(a.adjustment) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {Number(a.adjustment) >= 0 ? "+" : ""}{fmtMoney(Number(a.adjustment))}
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeAdjustment(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {adj.filter((a) => Number(a.adjustment) !== 0 || a.note).length === 0 && (
            <div className="text-sm text-muted-foreground py-4 text-center">Aucun ajustement</div>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">Mois</th>
              <th className="text-right px-3 py-2">Collectée</th>
              <th className="text-right px-3 py-2">Déductible</th>
              <th className="text-right px-3 py-2">Nette</th>
            </tr>
          </thead>
          <tbody>
            {byMonth.map((m) => (
              <tr key={m.month} className="border-b last:border-0">
                <td className="px-3 py-2">{m.month}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(m.collected)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(m.deductible)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(m.collected - m.deductible)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}