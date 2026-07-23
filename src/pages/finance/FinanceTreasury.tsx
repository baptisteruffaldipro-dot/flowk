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
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Financing = {
  id?: string;
  kind: "credit" | "shareholder_loan" | "other";
  label: string;
  principal_amount: number;
  received_date: string;
  monthly_payment: number;
  remaining_installments: number;
  first_payment_date: string | null;
  interest_rate: number | null;
  note: string | null;
  active: boolean;
};

const FIN_KIND_LABEL: Record<Financing["kind"], string> = {
  credit: "Crédit de trésorerie",
  shareholder_loan: "Apport en compte courant",
  other: "Autre financement",
};

function emptyFinancing(): Financing {
  return {
    kind: "credit", label: "", principal_amount: 0,
    received_date: new Date().toISOString().slice(0, 10),
    monthly_payment: 0, remaining_installments: 0,
    first_payment_date: null, interest_rate: null, note: null, active: true,
  };
}

export default function FinanceTreasury() {
  const [balances, setBalances] = useState<any[]>([]);
  const [tx, setTx] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxRow | null>(null);
  const [financings, setFinancings] = useState<Financing[]>([]);
  const [finForm, setFinForm] = useState<Financing | null>(null);

  const load = async () => {
    const [b, t, f, m, fin] = await Promise.all([
      supabase.from("bank_balances").select("*").order("as_of_date", { ascending: false }),
      supabase.from("finance_transactions").select("kind, amount_ttc, due_date, paid_date, date").in("kind", ["sale", "expense"]),
      supabase.from("finance_forecasts").select("*").order("planned_date"),
      supabase.from("finance_transactions").select("*").eq("kind", "bank").order("date", { ascending: false }),
      (supabase as any).from("finance_financings").select("*").order("received_date", { ascending: false }),
    ]);
    setBalances(b.data ?? []);
    setTx(t.data ?? []);
    setForecasts(f.data ?? []);
    setMovements(m.data ?? []);
    setFinancings((fin.data ?? []) as Financing[]);
  };
  useEffect(() => { load(); }, []);

  const saveFinancing = async () => {
    if (!finForm) return;
    if (!finForm.label) { toast.error("Nom obligatoire"); return; }
    const payload = { ...finForm };
    if (finForm.id) {
      await (supabase as any).from("finance_financings").update(payload).eq("id", finForm.id);
    } else {
      await (supabase as any).from("finance_financings").insert(payload);
    }
    toast.success("Enregistré");
    setFinForm(null);
    load();
  };
  const removeFinancing = async (id: string) => {
    if (!confirm("Supprimer ce financement ?")) return;
    await (supabase as any).from("finance_financings").delete().eq("id", id);
    load();
  };

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
      ...financings.filter((f) => f.active).flatMap((f) => {
        const items: { date: string; delta: number }[] = [];
        if (f.received_date > startDate && Number(f.principal_amount) > 0) {
          items.push({ date: f.received_date, delta: Number(f.principal_amount) });
        }
        if (Number(f.monthly_payment) > 0 && f.first_payment_date && f.remaining_installments > 0) {
          const first = new Date(f.first_payment_date);
          for (let i = 0; i < f.remaining_installments; i++) {
            const d = new Date(first); d.setMonth(d.getMonth() + i);
            const iso = d.toISOString().slice(0, 10);
            if (iso > startDate) items.push({ date: iso, delta: -Number(f.monthly_payment) });
          }
        }
        return items;
      }),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const horizon = new Date(startDate); horizon.setDate(horizon.getDate() + 180);
    for (const e of events) {
      if (e.date > horizon.toISOString().slice(0, 10)) break;
      running += e.delta;
      data.push({ day: e.date, solde: running });
    }
    return data;
  }, [balances, tx, forecasts, financings]);

  const compteCourant = useMemo(() => {
    const apports = movements.filter((m: any) => m.category === "apport_perso").reduce((s, m) => s + Number(m.amount_ttc || 0), 0);
    const retraits = movements.filter((m: any) => m.category === "retrait_perso").reduce((s, m) => s + Number(m.amount_ttc || 0), 0);
    return { apports, retraits, solde: apports + retraits };
  }, [movements]);

  const soldeActuel = balances[0]?.amount ?? 0;
  const soldeActuelDate = balances[0]?.as_of_date;

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Trésorerie" description="Vue solde + prévisions 30/60/90 jours et 6 mois." />
      <FinanceNav />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Solde bancaire</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{fmtMoney(Number(soldeActuel))}</div>
          {soldeActuelDate && <div className="text-[11px] text-muted-foreground mt-1">au {fmtDate(soldeActuelDate)}</div>}
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Compte courant dirigeant (dette envers moi-même)</div>
          <div className={`text-2xl font-semibold tabular-nums mt-1 ${compteCourant.solde >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtMoney(compteCourant.solde)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Apports {fmtMoney(compteCourant.apports)} · Retraits {fmtMoney(compteCourant.retraits)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Financements actifs</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">{financings.filter(f => f.active).length}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Crédits & apports en compte courant</div>
        </Card>
      </div>

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

      <Card className="p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium flex items-center gap-2"><Landmark className="h-4 w-4" /> Crédits & apports en compte courant</div>
          <Button size="sm" onClick={() => setFinForm(emptyFinancing())}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
        <div className="divide-y text-sm">
          {financings.map((f) => (
            <div key={f.id} className="py-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{f.label} <span className="text-xs text-muted-foreground ml-2">{FIN_KIND_LABEL[f.kind]}</span></div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Reçu le {fmtDate(f.received_date)} · Principal {fmtMoney(Number(f.principal_amount))}
                  {Number(f.monthly_payment) > 0 && ` · ${fmtMoney(Number(f.monthly_payment))}/mois × ${f.remaining_installments} restantes`}
                  {!f.active && " · (soldé)"}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setFinForm(f)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => removeFinancing(f.id!)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
            </div>
          ))}
          {financings.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Aucun financement. Ajoute un crédit de trésorerie ou un apport en compte courant.</div>}
        </div>
      </Card>

      {finForm && (
        <Card className="p-5 mt-4 border-primary/40">
          <div className="text-sm font-medium mb-3">{finForm.id ? "Modifier" : "Nouveau"} financement</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={finForm.kind} onValueChange={(v) => setFinForm({ ...finForm, kind: v as Financing["kind"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédit de trésorerie</SelectItem>
                  <SelectItem value="shareholder_loan">Apport en compte courant</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Nom</Label><Input value={finForm.label} onChange={(e) => setFinForm({ ...finForm, label: e.target.value })} placeholder="Prêt BPI 2026" /></div>
            <div><Label className="text-xs">Montant total reçu (€)</Label><Input type="number" step="0.01" value={finForm.principal_amount} onChange={(e) => setFinForm({ ...finForm, principal_amount: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Date de réception</Label><Input type="date" value={finForm.received_date} onChange={(e) => setFinForm({ ...finForm, received_date: e.target.value })} /></div>
            <div><Label className="text-xs">Mensualité (€) — 0 si pas de remboursement</Label><Input type="number" step="0.01" value={finForm.monthly_payment} onChange={(e) => setFinForm({ ...finForm, monthly_payment: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Mensualités restantes</Label><Input type="number" value={finForm.remaining_installments} onChange={(e) => setFinForm({ ...finForm, remaining_installments: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">1ʳᵉ mensualité</Label><Input type="date" value={finForm.first_payment_date ?? ""} onChange={(e) => setFinForm({ ...finForm, first_payment_date: e.target.value || null })} /></div>
            <div><Label className="text-xs">Taux annuel (%) — optionnel</Label><Input type="number" step="0.01" value={finForm.interest_rate ?? ""} onChange={(e) => setFinForm({ ...finForm, interest_rate: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Note</Label><Input value={finForm.note ?? ""} onChange={(e) => setFinForm({ ...finForm, note: e.target.value })} /></div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="fin-active" checked={finForm.active} onChange={(e) => setFinForm({ ...finForm, active: e.target.checked })} />
              <Label htmlFor="fin-active" className="text-xs">Actif (compté dans la trésorerie)</Label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={saveFinancing}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => setFinForm(null)}>Annuler</Button>
          </div>
        </Card>
      )}
    </div>
  );
}