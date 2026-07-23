import * as XLSX from "xlsx";

export type CanonicalField =
  | "date"
  | "due_date"
  | "paid_date"
  | "doc_number"
  | "label"
  | "counterparty"
  | "amount_ht"
  | "vat_amount"
  | "amount_ttc"
  | "debit"
  | "credit"
  | "vat_rate"
  | "account_code"
  | "supplier_cost_ht"
  | "bank_balance"
  | "ignore";

export type ColumnMapping = Record<string, CanonicalField>;

const HEURISTICS: Array<{ pattern: RegExp; field: CanonicalField }> = [
  // Explicit ignores (Tiime exports)
  { pattern: /^id$/i, field: "ignore" },
  { pattern: /iban/i, field: "ignore" },
  { pattern: /type.*op[eé]ration/i, field: "ignore" },
  { pattern: /statut/i, field: "ignore" },
  { pattern: /^pays/i, field: "ignore" },
  { pattern: /^tags?$/i, field: "ignore" },
  { pattern: /commentaire/i, field: "ignore" },
  { pattern: /^re[cç]us?$/i, field: "ignore" },
  { pattern: /^factures?$/i, field: "ignore" },
  { pattern: /^source$/i, field: "ignore" },
  { pattern: /date.*ajout/i, field: "ignore" },
  { pattern: /date.*op[eé]ration/i, field: "ignore" },
  { pattern: /transaction.*li[eé]|transactions?\s*bancaires?/i, field: "ignore" },
  // Dates
  { pattern: /date.*(paiement|regl|paye)/i, field: "paid_date" },
  { pattern: /date.*(ech|due)/i, field: "due_date" },
  { pattern: /date.*(document|facture|transaction)|\bdate\b/i, field: "date" },
  // Amounts (multi-TVA columns like "montant TVA 20%" all map to vat_amount and are summed)
  { pattern: /(taux.*tva|vat.*rate|tva.*taux)/i, field: "vat_rate" },
  { pattern: /(montant.*tva|tva.*montant|^tva\b|\btva\s*\d|tva\s*\d+([.,]\d+)?\s*%?|vat.*amount)/i, field: "vat_amount" },
  // Bank statements: Débit / Crédit / Montant (signed)
  { pattern: /(d[eé]bit|withdrawal|retrait|sortie)/i, field: "debit" },
  { pattern: /(cr[eé]dit|deposit|d[eé]p[oô]t|entr[eé]e)/i, field: "credit" },
  { pattern: /(montant.*ttc|total.*ttc|\bttc\b)/i, field: "amount_ttc" },
  { pattern: /(montant.*ht|total.*ht|\bht\b)/i, field: "amount_ht" },
  { pattern: /^montant$|^amount$/i, field: "amount_ttc" },
  // Identifiers & text
  { pattern: /(num[eé]ro.*facture|n[°o]\s*facture|reference|piece|facture\s*n)/i, field: "doc_number" },
  { pattern: /(libell|description|objet|intitul)/i, field: "label" },
  { pattern: /(nom.*(client|fournisseur|tiers)|^client$|^fournisseur$|tiers|contact|^label$)/i, field: "counterparty" },
  { pattern: /(compte|account)/i, field: "account_code" },
  { pattern: /(cout.*achat|prix.*achat|purchase)/i, field: "supplier_cost_ht" },
  { pattern: /(solde|balance)/i, field: "bank_balance" },
];

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  for (const h of headers) {
    const clean = h.trim();
    const hit = HEURISTICS.find((r) => r.pattern.test(clean));
    map[h] = hit ? hit.field : "ignore";
  }
  return map;
}

export function headersSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).sort().join("|");
}

export async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null, raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function toNumber(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function toDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // dd/mm/yyyy
  const fr = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (fr) {
    const [_, d, m, y] = fr;
    const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export type NormalizedRow = {
  date: string | null;
  due_date: string | null;
  paid_date: string | null;
  doc_number: string | null;
  label: string | null;
  counterparty: string | null;
  amount_ht: number;
  vat_amount: number;
  amount_ttc: number;
  vat_rate: number | null;
  account_code: string | null;
  supplier_cost_ht: number | null;
  bank_balance: number | null;
  raw: Record<string, any>;
};

export function normalizeRow(row: Record<string, any>, mapping: ColumnMapping): NormalizedRow {
  const get = (field: CanonicalField) => {
    const key = Object.keys(mapping).find((k) => mapping[k] === field);
    return key ? row[key] : null;
  };
  const sumOf = (field: CanonicalField) =>
    Object.keys(mapping)
      .filter((k) => mapping[k] === field)
      .reduce((acc, k) => acc + toNumber(row[k]), 0);
  const ht = sumOf("amount_ht");
  const tva = sumOf("vat_amount");
  let ttc = sumOf("amount_ttc");
  const debit = sumOf("debit");
  const credit = sumOf("credit");
  if (!ttc && (debit || credit)) ttc = credit - debit;
  if (!ttc && (ht || tva)) ttc = ht + tva;
  return {
    date: toDate(get("date")),
    due_date: toDate(get("due_date")),
    paid_date: toDate(get("paid_date")),
    doc_number: get("doc_number") ? String(get("doc_number")) : null,
    label: get("label") ? String(get("label")) : null,
    counterparty: get("counterparty") ? String(get("counterparty")) : null,
    amount_ht: ht,
    vat_amount: tva,
    amount_ttc: ttc,
    vat_rate: get("vat_rate") ? toNumber(get("vat_rate")) : null,
    account_code: get("account_code") ? String(get("account_code")) : null,
    supplier_cost_ht: get("supplier_cost_ht") != null ? toNumber(get("supplier_cost_ht")) : null,
    bank_balance: get("bank_balance") != null && get("bank_balance") !== "" ? toNumber(get("bank_balance")) : null,
    raw: row,
  };
}

export function normalizeCounterparty(s: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dedupeKey(kind: string, r: NormalizedRow): string {
  return [kind, r.doc_number ?? "", r.date ?? "", r.amount_ttc.toFixed(2), (r.counterparty ?? "").toLowerCase()].join("|");
}

export type CategoryRule = {
  pattern: string;
  field: "label" | "account_code" | string;
  match_kind: "sale" | "expense" | "bank" | null;
  category: "prestation" | "achat_revente" | "expense" | "bank" | "other";
  priority: number;
};

export function categorize(
  kind: "sale" | "expense" | "bank",
  row: NormalizedRow,
  rules: CategoryRule[],
): { category: NormalizedRow extends any ? "prestation" | "achat_revente" | "expense" | "bank" | "other" : never; source: "rule" | "default" } {
  if (kind === "bank") return { category: "bank" as any, source: "default" };
  if (kind === "expense") {
    const applicable = rules.filter((r) => (!r.match_kind || r.match_kind === "expense")).sort((a, b) => b.priority - a.priority);
    for (const r of applicable) {
      const val = String((row as any)[r.field] ?? "").toLowerCase();
      if (val && val.includes(r.pattern.toLowerCase())) return { category: r.category as any, source: "rule" };
    }
    return { category: "expense" as any, source: "default" };
  }
  const applicable = rules.filter((r) => !r.match_kind || r.match_kind === "sale").sort((a, b) => b.priority - a.priority);
  for (const r of applicable) {
    const val = String((row as any)[r.field] ?? "").toLowerCase();
    if (val && val.includes(r.pattern.toLowerCase())) return { category: r.category as any, source: "rule" };
  }
  return { category: "prestation" as any, source: "default" };
}

export const CANONICAL_LABELS: Record<CanonicalField, string> = {
  date: "Date",
  due_date: "Date d'échéance",
  paid_date: "Date de paiement",
  doc_number: "N° de pièce / facture",
  label: "Libellé / description",
  counterparty: "Client ou fournisseur",
  amount_ht: "Montant HT",
  vat_amount: "Montant TVA",
  amount_ttc: "Montant TTC",
  debit: "Débit (sortie)",
  credit: "Crédit (entrée)",
  vat_rate: "Taux TVA",
  account_code: "Compte comptable",
  supplier_cost_ht: "Coût d'achat HT (fournisseur)",
  bank_balance: "Solde bancaire",
  ignore: "— Ignorer —",
};