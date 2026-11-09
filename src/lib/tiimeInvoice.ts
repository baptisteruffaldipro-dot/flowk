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
  format?: string | null;
  support?: string | null;
  grammage?: string | null;
  colors?: string | null;
  finitions?: string | null;
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
  const specs = [
    po.format && `Format : ${po.format}`,
    po.support && `Support : ${po.support}`,
    po.grammage && `Grammage : ${po.grammage}`,
    po.colors && `Couleurs : ${po.colors}`,
    po.finitions && `Finitions : ${po.finitions}`,
  ].filter(Boolean).join(" — ");
  return {
    key: `print:${po.id}`,
    source: "print",
    source_id: po.id,
    category: "sale",
    // Tiime rejects unit prices with more than 2 decimals: when the per-unit
    // price isn't exact, bill one lot and keep the real quantity in the label.
    ...(() => {
      const unit = r2(total / qty);
      const exact = Math.abs(unit * qty - total) < 0.005;
      const qtyLabel = exact ? "" : `${qty} exemplaires`;
      const desc = [label, qtyLabel, specs].filter(Boolean).join(" — ");
      return exact
        ? { description: desc, quantity: qty, unit_amount_ht: unit }
        : { description: desc, quantity: 1, unit_amount_ht: total };
    })(),
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

// Étiquette affichée sur une carte de tâche pour suivre la facturation Tiime.
export function tiimeTaskBadge(task: {
  tiime_invoice_id?: string | null;
  tiime_invoice_number?: string | null;
  tiime_invoice_status?: string | null;
  tiime_amount_ht?: number | string | null;
}): { label: string; title: string; state: "invoiced" | "pending" } | null {
  if (task.tiime_invoice_id) {
    const n = task.tiime_invoice_number ? ` n° ${task.tiime_invoice_number}` : "";
    const amt = Number(task.tiime_amount_ht);
    const amount = Number.isFinite(amt) && amt > 0
      ? ` · ${amt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`
      : "";
    return {
      label: `Facturé Tiime${n}`,
      title: `Facture Tiime${n} créée${amount}`,
      state: "invoiced",
    };
  }
  if (task.tiime_invoice_status === "pending") {
    return { label: "Tiime en cours", title: "Facture Tiime en cours de création", state: "pending" };
  }
  return null;
}

// Marquage manuel : facture faite directement dans Tiime, hors Flowk.
export function manualTiimePatch(input: { number?: string; date: string; amountHT?: number | null }, uid: string) {
  const number = input.number?.trim() || null;
  const amt = Number(input.amountHT);
  return {
    tiime_invoice_id: `manual-${uid}`,
    tiime_invoice_number: number,
    tiime_invoice_status: "manual",
    tiime_sent_at: new Date(`${input.date}T12:00:00`).toISOString(),
    tiime_amount_ht: Number.isFinite(amt) && amt > 0 ? r2(amt) : null,
  };
}

export const CLEAR_TIIME_PATCH = {
  tiime_invoice_id: null,
  tiime_invoice_number: null,
  tiime_invoice_status: null,
  tiime_sent_at: null,
  tiime_amount_ht: null,
};
