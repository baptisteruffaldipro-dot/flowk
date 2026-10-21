// Ventes = uniquement les lignes effectivement envoyées et créées dans Tiime.
export type SaleRow = {
  id: string;
  kind: "prestation" | "impression";
  label: string;
  client: string;
  unitId: string | null;
  invoiceNumber: string | null;
  sentAt: string; // ISO
  ht: number;
};

type TaskLike = {
  id: string; title: string; client_id: string | null; business_unit_id: string | null;
  tiime_invoice_id: string | null; tiime_invoice_number: string | null; tiime_sent_at: string | null;
  tiime_amount_ht: number | null; billing_type?: string | null; flat_amount?: number | null;
  hourly_rate?: number | null; total_minutes?: number | null;
};
type PrintLike = {
  id: string; description: string | null; client_id: string; business_unit_id: string | null;
  tiime_invoice_id: string | null; tiime_invoice_number: string | null; tiime_sent_at: string | null;
  tiime_amount_ht: number | null; amount: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function taskFallbackHT(t: TaskLike) {
  if (t.billing_type === "horaire") return r2(((t.total_minutes ?? 0) / 60) * (t.hourly_rate ?? 0));
  return r2(t.flat_amount ?? 0);
}

export function toSales(tasks: TaskLike[], prints: PrintLike[], clientName: (id: string | null) => string): SaleRow[] {
  const out: SaleRow[] = [];
  for (const t of tasks) {
    if (!t.tiime_invoice_id || !t.tiime_sent_at) continue;
    out.push({ id: t.id, kind: "prestation", label: t.title, client: clientName(t.client_id), unitId: t.business_unit_id,
      invoiceNumber: t.tiime_invoice_number, sentAt: t.tiime_sent_at, ht: r2(t.tiime_amount_ht ?? taskFallbackHT(t)) });
  }
  for (const p of prints) {
    if (!p.tiime_invoice_id || !p.tiime_sent_at) continue;
    out.push({ id: p.id, kind: "impression", label: p.description || "Impression", client: clientName(p.client_id), unitId: p.business_unit_id,
      invoiceNumber: p.tiime_invoice_number, sentAt: p.tiime_sent_at, ht: r2(p.tiime_amount_ht ?? p.amount ?? 0) });
  }
  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function salesTotals(rows: SaleRow[], vatRate = 20) {
  const ht = r2(rows.reduce((s, r) => s + r.ht, 0));
  const prestation = r2(rows.filter((r) => r.kind === "prestation").reduce((s, r) => s + r.ht, 0));
  const impression = r2(ht - prestation);
  const invoices = new Set(rows.map((r) => r.invoiceNumber ?? r.id)).size;
  return { ht, tva: r2(ht * vatRate / 100), ttc: r2(ht * (1 + vatRate / 100)), prestation, impression, invoices };
}

export function monthlyHT(rows: SaleRow[], year: number) {
  const m = Array.from({ length: 12 }, (_, i) => ({ month: i, prestation: 0, impression: 0 }));
  for (const r of rows) {
    const d = new Date(r.sentAt);
    if (d.getFullYear() !== year) continue;
    m[d.getMonth()][r.kind] = r2(m[d.getMonth()][r.kind] + r.ht);
  }
  return m;
}
