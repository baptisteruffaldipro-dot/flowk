// Produits habituels déduits de l'historique des commandes d'impression.
export type PrintPreset = {
  key: string;
  description: string;
  format: string;
  grammage: string;
  support: string;
  colors: string;
  finitions: string;
  quantity: number | null;
  amount: number | null;
  price_tiers: any[];
  count: number;
  lastAt: string;
};

const norm = (v: any) => String(v ?? "").trim();

export function buildPrintPresets(orders: any[]): PrintPreset[] {
  const map = new Map<string, PrintPreset>();
  // orders les plus récents d'abord → le preset garde les valeurs les plus récentes
  const sorted = [...orders].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  for (const o of sorted) {
    const description = norm(o.description);
    if (!description) continue;
    const key = [description, o.format, o.grammage, o.support, o.colors, o.finitions].map((x) => norm(x).toLowerCase()).join("|");
    const existing = map.get(key);
    if (existing) { existing.count++; continue; }
    map.set(key, {
      key, description,
      format: norm(o.format), grammage: norm(o.grammage), support: norm(o.support),
      colors: norm(o.colors), finitions: norm(o.finitions),
      quantity: o.quantity ?? null, amount: o.amount ?? null,
      price_tiers: Array.isArray(o.price_tiers) ? o.price_tiers : [],
      count: 1, lastAt: String(o.created_at ?? ""),
    });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}
