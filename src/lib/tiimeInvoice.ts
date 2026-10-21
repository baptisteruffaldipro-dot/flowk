// Construction d'une facture Tiime (envoyée via Make) regroupant
// la prestation d'une tâche et ses commandes d'impression liées.

export type InvoiceLine = {
  key: string;                 // "task:<id>" ou "print:<id>"
  source: "task" | "print";
  source_id: string;
  category: "benefit" | "sale"; // Presta / Bien dans Tiime
  description: string;
  quantity: number;
  unit_amount_ht: number;
  line_amount_ht: number;
  vat_rate: number;            // en %
  already_invoiced: boolean;
};

export type PrintOrderLike = {
  id: string;
  description?: string | null;
  reference?: string | null;
  quantity?: number | null;
  amount?: number | null;
  tiime_invoice_id?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function prestationLine(
  task: { id: string; title?: string | null; tiime_invoice_id?: string | null },
  amountHT: number,
  vatRate = 20,
): InvoiceLine {
  const amt = r2(Math.max(0, amountHT));
  return {
    key: `task:${task.id}`,
    source: "task",
    source_id: task.id,
    category: "benefit",
    description: task.title || "Prestation",
    quantity: 1,
    unit_amount_ht: amt,
    line_amount_ht: amt,
    vat_rate: vatRate,
    already_invoiced: !!task.tiime_invoice_id,
  };
}

export function printLine(po: PrintOrderLike, vatRate = 20): InvoiceLine {
  const qty = Number(po.quantity) > 0 ? Number(po.quantity) : 1;
  const total = r2(Number(po.amount ?? 0));
  const label = [po.description || "Impression", po.reference ? `(${po.reference})` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    key: `print:${po.id}`,
    source: "print",
    source_id: po.id,
    category: "sale",
    description: label,
    quantity: qty,
    unit_amount_ht: Math.round((total / qty) * 10000) / 10000,
    line_amount_ht: total,
    vat_rate: vatRate,
    already_invoiced: !!po.tiime_invoice_id,
  };
}

export function invoiceTotals(lines: InvoiceLine[]) {
  const ht = r2(lines.reduce((s, l) => s + l.line_amount_ht, 0));
  const vat = r2(lines.reduce((s, l) => s + (l.line_amount_ht * l.vat_rate) / 100, 0));
  return { ht, vat, ttc: r2(ht + vat) };
}

/** Lignes réellement envoyables : cochées, non déjà facturées, montant > 0. */
export function sendableLines(lines: InvoiceLine[], selected: Set<string>) {
  return lines.filter((l) => selected.has(l.key) && !l.already_invoiced && l.line_amount_ht > 0);
}
