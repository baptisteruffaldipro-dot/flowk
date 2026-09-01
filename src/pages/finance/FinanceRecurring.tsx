import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { computeMrr, monthlyRecurringCost } from "@/lib/finance/units";
import { toast } from "sonner";
import { Plus, Trash2, Check } from "lucide-react";

const PERIODICITIES = [
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "yearly", label: "Annuel" },
  { value: "weekly", label: "Hebdomadaire" },
];

export default function FinanceRecurring() {
  const { activeUnits, byId } = useBusinessUnits();
  const [rec, setRec] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const [nr, setNr] = useState<any>({ label: "", amount_ht: 0, periodicity: "monthly", business_unit_id: "", supplier: "" });
  const [ns, setNs] = useState<any>({ client_name: "", plan: "classic", setup_fee_ht: 450, monthly_ht: 49, business_unit_id: "", client_id: "" });

  const load = async () => {
    const [r, s, c] = await Promise.all([
      supabase.from("recurring_expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").order("name"),
    ]);
    setRec((r.data as any[]) ?? []);
    setSubs((s.data as any[]) ?? []);
    setClients((c.data as any[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const platorama = activeUnits.find((u) => u.code === "platorama");
  useEffect(() => {
    if (platorama && !ns.business_unit_id) setNs((v: any) => ({ ...v, business_unit_id: platorama.id }));
  }, [platorama?.id]);

  const monthlyCost = monthlyRecurringCost(rec);
  const { mrr, arr } = computeMrr(subs);

  const addRecurring = async () => {
    if (!nr.label.trim()) return toast.error("Libellé obligatoire");
    const { error } = await supabase.from("recurring_expenses").insert({
      label: nr.label.trim(),
      supplier: nr.supplier || null,
      amount_ht: Number(nr.amount_ht) || 0,
      periodicity: nr.periodicity,
      business_unit_id: nr.business_unit_id || null,
    });
    if (error) return toast.error(error.message);
    setNr({ label: "", amount_ht: 0, periodicity: "monthly", business_unit_id: nr.business_unit_id, supplier: "" });
    load();
  };

  const removeRecurring = async (id: string) => {
    if (!confirm("Supprimer cette charge récurrente ?")) return;
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  /** Matérialise l'échéance du mois en dépense réelle. */
  const materialize = async (r: any) => {
    const date = new Date().toISOString().slice(0, 10);
    const ht = Number(r.amount_ht) || 0;
    const vat = (ht * Number(r.vat_rate ?? 20)) / 100;
    const { error } = await supabase.from("finance_transactions").insert({
      kind: "expense",
      category: r.category ?? "frais_fixe",
      date,
      label: r.label,
      counterparty: r.supplier ?? r.label,
      amount_ht: ht,
      vat_amount: vat,
      amount_ttc: ht + vat,
      vat_rate: Number(r.vat_rate ?? 20),
      business_unit_id: r.business_unit_id,
      source: "manual",
      category_source: "recurring",
      dedupe_key: `rec:${r.id}:${date.slice(0, 7)}`,
    });
    if (error) return toast.error(error.message.includes("dedupe") ? "Échéance déjà enregistrée ce mois-ci" : error.message);
    toast.success("Dépense créée");
  };

  const addSub = async () => {
    if (!ns.client_name.trim() && !ns.client_id) return toast.error("Client obligatoire");
    const { error } = await supabase.from("subscriptions").insert({
      business_unit_id: ns.business_unit_id || null,
      client_id: ns.client_id || null,
      client_name: ns.client_name || clients.find((c) => c.id === ns.client_id)?.name || null,
      plan: ns.plan,
      setup_fee_ht: Number(ns.setup_fee_ht) || 0,
      monthly_ht: Number(ns.monthly_ht) || 0,
    });
    if (error) return toast.error(error.message);
    setNs({ ...ns, client_name: "", client_id: "" });
    load();
  };

  const updateSub = async (id: string, patch: any) => {
    const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeSub = async (id: string) => {
    if (!confirm("Supprimer cet abonnement ?")) return;
    await supabase.from("subscriptions").delete().eq("id", id);
    load();
  };

  const planPreset = (plan: string) => {
    if (plan === "classic") setNs((v: any) => ({ ...v, plan, setup_fee_ht: 450, monthly_ht: 49 }));
    else if (plan === "business") setNs((v: any) => ({ ...v, plan, setup_fee_ht: 850, monthly_ht: 69 }));
    else if (plan === "premium") setNs((v: any) => ({ ...v, plan, setup_fee_ht: 0, monthly_ht: 99 }));
    else setNs((v: any) => ({ ...v, plan }));
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Récurrents" description="Charges récurrentes et abonnements clients — base du prévisionnel et du MRR." />
      <FinanceNav />

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <Kpi label="Charges récurrentes / mois" value={fmtMoney(monthlyCost)} />
        <Kpi label="MRR" value={fmtMoney(mrr)} />
        <Kpi label="ARR" value={fmtMoney(arr)} />
      </div>

      <Tabs defaultValue="charges">
        <TabsList className="mb-4">
          <TabsTrigger value="charges">Charges récurrentes</TabsTrigger>
          <TabsTrigger value="abos">Abonnements clients</TabsTrigger>
        </TabsList>

        <TabsContent value="charges">
          <Card className="p-4 mb-4">
            <div className="grid gap-2 sm:grid-cols-5 items-end">
              <F label="Libellé"><Input value={nr.label} onChange={(e) => setNr({ ...nr, label: e.target.value })} /></F>
              <F label="Fournisseur"><Input value={nr.supplier} onChange={(e) => setNr({ ...nr, supplier: e.target.value })} /></F>
              <F label="Montant HT"><Input type="number" step="0.01" value={nr.amount_ht} onChange={(e) => setNr({ ...nr, amount_ht: e.target.value })} /></F>
              <F label="Périodicité">
                <Select value={nr.periodicity} onValueChange={(v) => setNr({ ...nr, periodicity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODICITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Pôle">
                <div className="flex gap-2">
                  <Select value={nr.business_unit_id || "none"} onValueChange={(v) => setNr({ ...nr, business_unit_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Global</SelectItem>
                      {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={addRecurring}><Plus className="h-4 w-4" /></Button>
                </div>
              </F>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">Libellé</th>
                  <th className="text-left px-3 py-2">Pôle</th>
                  <th className="text-left px-3 py-2">Périodicité</th>
                  <th className="text-right px-3 py-2">HT</th>
                  <th className="text-right px-3 py-2">Mensualisé</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rec.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      {r.label}
                      {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.business_unit_id ? byId.get(r.business_unit_id)?.name ?? "—" : <span className="text-muted-foreground">Global</span>}</td>
                    <td className="px-3 py-2 text-xs">{PERIODICITIES.find((p) => p.value === r.periodicity)?.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(Number(r.amount_ht))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(monthlyRecurringCost([r]))}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => materialize(r)} title="Créer la dépense du mois">
                        <Check className="h-3.5 w-3.5 mr-1" /> Payée ce mois
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeRecurring(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
                {rec.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune charge récurrente</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="abos">
          <Card className="p-4 mb-4">
            <div className="grid gap-2 sm:grid-cols-6 items-end">
              <F label="Client (fiche)">
                <Select value={ns.client_id || "none"} onValueChange={(v) => setNs({ ...ns, client_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="ou nom libre"><Input value={ns.client_name} onChange={(e) => setNs({ ...ns, client_name: e.target.value })} /></F>
              <F label="Offre">
                <Select value={ns.plan} onValueChange={planPreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="custom">Sur mesure</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Mise en service HT"><Input type="number" step="0.01" value={ns.setup_fee_ht} onChange={(e) => setNs({ ...ns, setup_fee_ht: e.target.value })} /></F>
              <F label="Mensuel HT"><Input type="number" step="0.01" value={ns.monthly_ht} onChange={(e) => setNs({ ...ns, monthly_ht: e.target.value })} /></F>
              <F label="Pôle">
                <div className="flex gap-2">
                  <Select value={ns.business_unit_id || "none"} onValueChange={(v) => setNs({ ...ns, business_unit_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={addSub}><Plus className="h-4 w-4" /></Button>
                </div>
              </F>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-left px-3 py-2">Pôle</th>
                    <th className="text-left px-3 py-2">Offre</th>
                    <th className="text-right px-3 py-2">Mensuel HT</th>
                    <th className="text-right px-3 py-2">Plats sup.</th>
                    <th className="text-right px-3 py-2">Chevalets QR</th>
                    <th className="text-right px-3 py-2">Support (min/mois)</th>
                    <th className="text-left px-3 py-2">Statut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">{s.client_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{s.business_unit_id ? byId.get(s.business_unit_id)?.name ?? "—" : "—"}</td>
                      <td className="px-3 py-2 capitalize">{s.plan}</td>
                      <td className="px-3 py-2 text-right">
                        <Input className="h-7 w-24 text-right" type="number" step="0.01" defaultValue={s.monthly_ht}
                          onBlur={(e) => Number(e.target.value) !== Number(s.monthly_ht) && updateSub(s.id, { monthly_ht: Number(e.target.value) })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input className="h-7 w-16 text-right" type="number" defaultValue={s.extra_dishes}
                          onBlur={(e) => Number(e.target.value) !== Number(s.extra_dishes) && updateSub(s.id, { extra_dishes: Number(e.target.value) })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input className="h-7 w-16 text-right" type="number" defaultValue={s.qr_stands}
                          onBlur={(e) => Number(e.target.value) !== Number(s.qr_stands) && updateSub(s.id, { qr_stands: Number(e.target.value) })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input className="h-7 w-16 text-right" type="number" defaultValue={s.support_minutes_per_month}
                          onBlur={(e) => Number(e.target.value) !== Number(s.support_minutes_per_month) && updateSub(s.id, { support_minutes_per_month: Number(e.target.value) })} />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={s.status} onValueChange={(v) => updateSub(s.id, { status: v })}>
                          <SelectTrigger className="h-7 w-[110px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Actif</SelectItem>
                            <SelectItem value="paused">En pause</SelectItem>
                            <SelectItem value="churned">Résilié</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeSub(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                  {subs.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">Aucun abonnement</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
