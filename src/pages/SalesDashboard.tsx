import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { monthlyHT, salesTotals, toSales, type SaleRow } from "@/lib/salesDashboard";
import { ChevronLeft, ChevronRight } from "lucide-react";

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export default function SalesDashboard() {
  const units = useBusinessUnits().units;
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<string>("all");
  const [unit, setUnit] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [t, p, c] = await Promise.all([
        supabase.from("tasks").select("id,title,client_id,business_unit_id,tiime_invoice_id,tiime_invoice_number,tiime_sent_at,tiime_amount_ht,billing_type,flat_amount,hourly_rate,total_minutes").not("tiime_invoice_id", "is", null),
        supabase.from("print_orders").select("id,description,client_id,business_unit_id,tiime_invoice_id,tiime_invoice_number,tiime_sent_at,tiime_amount_ht,amount").not("tiime_invoice_id", "is", null),
        supabase.from("clients").select("id,name"),
      ]);
      const names = new Map((c.data ?? []).map((x: any) => [x.id, x.name]));
      setRows(toSales((t.data ?? []) as any, (p.data ?? []) as any, (id) => (id && names.get(id)) || "—"));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    const d = new Date(r.sentAt);
    if (d.getFullYear() !== year) return false;
    if (month !== "all" && d.getMonth() !== Number(month)) return false;
    if (unit !== "all" && (r.unitId ?? "none") !== unit) return false;
    if (kind !== "all" && r.kind !== kind) return false;
    return true;
  }), [rows, year, month, unit, kind]);

  const totals = salesTotals(filtered);
  const months = monthlyHT(rows.filter((r) => (unit === "all" || (r.unitId ?? "none") === unit) && (kind === "all" || r.kind === kind)), year);
  const max = Math.max(1, ...months.map((m) => m.prestation + m.impression));
  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? "Sans pôle";

  return (
    <div className="space-y-6">
      <PageHeader title="Ventes & CA" description="Uniquement les lignes facturées et envoyées à Tiime. Montants HT, TTC mis en avant." />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setYear(year - 1)} aria-label="Année précédente"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="w-14 text-center font-medium">{year}</span>
          <Button variant="outline" size="icon" onClick={() => setYear(year + 1)} aria-label="Année suivante"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute l'année</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les pôles</SelectItem>
            {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            <SelectItem value="none">Sans pôle</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            <SelectItem value="prestation">Prestations</SelectItem>
            <SelectItem value="impression">Impressions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 md:col-span-2 bg-primary text-primary-foreground">
          <div className="text-sm opacity-80">Chiffre d'affaires TTC</div>
          <div className="text-4xl font-semibold mt-1">{eur(totals.ttc)}</div>
          <div className="text-sm opacity-80 mt-2">{eur(totals.ht)} HT · TVA {eur(totals.tva)} · {totals.invoices} facture{totals.invoices > 1 ? "s" : ""}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Prestations HT</div>
          <div className="text-2xl font-semibold mt-1">{eur(totals.prestation)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Impressions HT</div>
          <div className="text-2xl font-semibold mt-1">{eur(totals.impression)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="text-sm font-medium mb-4">CA HT par mois — {year}</div>
        <div className="flex items-end gap-2 h-40">
          {months.map((m) => {
            const tot = m.prestation + m.impression;
            return (
              <button key={m.month} onClick={() => setMonth(month === String(m.month) ? "all" : String(m.month))}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${MONTHS[m.month]} : ${eur(tot)} HT`}>
                <div className="w-full flex flex-col justify-end rounded overflow-hidden" style={{ height: `${(tot / max) * 100}%` }}>
                  <div className="bg-accent" style={{ height: tot ? `${(m.impression / tot) * 100}%` : 0 }} />
                  <div className="bg-primary flex-1" style={{ display: m.prestation ? "block" : "none" }} />
                </div>
                <span className={`text-xs ${month === String(m.month) ? "font-semibold" : "text-muted-foreground"}`}>{MONTHS[m.month]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" />Prestations</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent" />Impressions</span>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b text-sm font-medium">Lignes de ventes ({filtered.length})</div>
        {loading ? <div className="p-5 text-sm text-muted-foreground">Chargement…</div> : filtered.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">Aucune ligne envoyée à Tiime sur cette période.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="px-5 py-2 font-normal">Date</th><th className="py-2 font-normal">Facture</th>
                  <th className="py-2 font-normal">Client</th><th className="py-2 font-normal">Libellé</th>
                  <th className="py-2 font-normal">Pôle</th><th className="py-2 font-normal text-right">HT</th>
                  <th className="px-5 py-2 font-normal text-right">TTC</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.kind + r.id} className="border-b last:border-0">
                    <td className="px-5 py-2 whitespace-nowrap">{new Date(r.sentAt).toLocaleDateString("fr-FR")}</td>
                    <td className="py-2">{r.invoiceNumber ?? "Brouillon"}</td>
                    <td className="py-2">{r.client}</td>
                    <td className="py-2">
                      <Badge variant="outline" className="mr-2">{r.kind === "prestation" ? "Presta" : "Impression"}</Badge>
                      {r.kind === "prestation" ? <Link to={`/taches/${r.id}`} className="hover:underline">{r.label}</Link> : r.label}
                    </td>
                    <td className="py-2 text-muted-foreground">{unitName(r.unitId)}</td>
                    <td className="py-2 text-right whitespace-nowrap">{eur(r.ht)}</td>
                    <td className="px-5 py-2 text-right whitespace-nowrap font-medium">{eur(r.ht * 1.2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
