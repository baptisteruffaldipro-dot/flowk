// Agrégation financière par pôle d'activité.
// Le réel vient toujours de finance_transactions ; le temps passé est valorisé
// à la volée (coût analytique) et n'est jamais une écriture financière.

export type TxLite = {
  id?: string;
  kind: string;
  category: string;
  date: string;
  paid_date?: string | null;
  amount_ht?: number | null;
  amount_ttc?: number | null;
  vat_amount?: number | null;
  supplier_cost_ht?: number | null;
  business_unit_id?: string | null;
};

export type UnitMetrics = {
  buId: string | null;
  revenueInvoiced: number;   // CA HT facturé
  revenueCollected: number;  // CA HT encaissé
  purchaseCost: number;      // coût d'achat / fournisseur des ventes
  expenses: number;          // dépenses HT (hors coût fournisseur)
  sharedExpenses: number;    // quote-part de charges communes ventilée
  grossMargin: number;       // CA facturé − coût d'achat
  result: number;            // CA facturé − coût d'achat − dépenses − communes
  minutes: number;           // temps passé
  timeCost: number;          // temps valorisé au taux interne
  resultAfterTime: number;   // résultat − coût du temps
  outstanding: number;       // TTC facturé non encaissé
  marginPct: number;
};

export const inRange = (d?: string | null, start?: string, end?: string) =>
  !!d && (!start || d >= start) && (!end || d <= end);

export function emptyMetrics(buId: string | null): UnitMetrics {
  return {
    buId,
    revenueInvoiced: 0,
    revenueCollected: 0,
    purchaseCost: 0,
    expenses: 0,
    sharedExpenses: 0,
    grossMargin: 0,
    result: 0,
    minutes: 0,
    timeCost: 0,
    resultAfterTime: 0,
    outstanding: 0,
    marginPct: 0,
  };
}

function finalize(m: UnitMetrics) {
  m.grossMargin = m.revenueInvoiced - m.purchaseCost;
  m.result = m.grossMargin - m.expenses - m.sharedExpenses;
  m.resultAfterTime = m.result - m.timeCost;
  m.marginPct = m.revenueInvoiced > 0 ? (m.grossMargin / m.revenueInvoiced) * 100 : 0;
  return m;
}

export type TxSplit = { business_unit_id: string; share_pct: number };

/** Répartition effective d'une ligne : soit sa ventilation manuelle, soit son pôle. */
export function splitShares(
  r: TxLite,
  splits?: Map<string, TxSplit[]>,
): { buId: string | null; factor: number }[] {
  const rows = r.id ? splits?.get(r.id) : undefined;
  if (rows && rows.length) {
    const total = rows.reduce((a, s) => a + (Number(s.share_pct) || 0), 0);
    if (total > 0) return rows.map((s) => ({ buId: s.business_unit_id, factor: (Number(s.share_pct) || 0) / total }));
  }
  return [{ buId: r.business_unit_id ?? null, factor: 1 }];
}

export type AggregateOptions = {
  start: string;
  end: string;
  /** répartition des charges communes : buId -> % */
  allocation?: Map<string, number>;
  /** temps passé par pôle en minutes */
  minutesByUnit?: Map<string, number>;
  /** taux horaire interne par pôle */
  rateByUnit?: Map<string, number>;
  /** ventilation manuelle par transaction : txId -> lignes de répartition */
  splits?: Map<string, TxSplit[]>;
};

/**
 * Agrège les transactions par pôle. La clé `null` porte les lignes non
 * affectées (global / commun) restant après ventilation.
 */
export function aggregateByUnit(rows: TxLite[], opts: AggregateOptions): Map<string | null, UnitMetrics> {
  const { start, end, allocation, minutesByUnit, rateByUnit, splits } = opts;
  const map = new Map<string | null, UnitMetrics>();
  const get = (id: string | null) => {
    if (!map.has(id)) map.set(id, emptyMetrics(id));
    return map.get(id)!;
  };

  let sharedPool = 0;

  for (const r of rows) {
    if (!inRange(r.date, start, end)) continue;
    const ht = Number(r.amount_ht) || 0;
    const ttc = Number(r.amount_ttc) || 0;
    const shares = splitShares(r, splits);

    for (const { buId: bu, factor } of shares) {
      if (r.kind === "sale") {
        const m = get(bu);
        m.revenueInvoiced += ht * factor;
        m.purchaseCost += (Number(r.supplier_cost_ht) || 0) * factor;
        if (r.paid_date) m.revenueCollected += ht * factor;
        else m.outstanding += ttc * factor;
      } else if (r.kind === "expense") {
        const amount = Math.abs(ht) * factor;
        if (bu === null && allocation && allocation.size > 0) {
          sharedPool += amount;
        } else {
          get(bu).expenses += amount;
        }
      }
    }
  }


  if (sharedPool > 0 && allocation) {
    const total = Array.from(allocation.values()).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const [buId, pct] of allocation) {
        get(buId).sharedExpenses += (sharedPool * pct) / total;
      }
    } else {
      get(null).expenses += sharedPool;
    }
  }

  if (minutesByUnit) {
    for (const [buId, minutes] of minutesByUnit) {
      const m = get(buId);
      m.minutes += minutes;
      m.timeCost += (minutes / 60) * (rateByUnit?.get(buId) ?? 0);
    }
  }

  for (const m of map.values()) finalize(m);
  return map;
}

/** Somme de plusieurs pôles en un total consolidé. */
export function consolidate(metrics: Iterable<UnitMetrics>): UnitMetrics {
  const t = emptyMetrics(null);
  for (const m of metrics) {
    t.revenueInvoiced += m.revenueInvoiced;
    t.revenueCollected += m.revenueCollected;
    t.purchaseCost += m.purchaseCost;
    t.expenses += m.expenses;
    t.sharedExpenses += m.sharedExpenses;
    t.minutes += m.minutes;
    t.timeCost += m.timeCost;
    t.outstanding += m.outstanding;
  }
  return finalize(t);
}

/** Série mensuelle CA / dépenses / résultat. */
export function monthlySeries(rows: TxLite[], months: string[], buId: string | null | "all") {
  const base = new Map(months.map((m) => [m, { month: m, ca: 0, depenses: 0, resultat: 0 }]));
  for (const r of rows) {
    const ym = (r.date ?? "").slice(0, 7);
    const bucket = base.get(ym);
    if (!bucket) continue;
    if (buId !== "all" && (r.business_unit_id ?? null) !== buId) continue;
    const ht = Number(r.amount_ht) || 0;
    if (r.kind === "sale") bucket.ca += ht;
    else if (r.kind === "expense") bucket.depenses += Math.abs(ht) + 0;
  }
  for (const b of base.values()) b.resultat = b.ca - b.depenses;
  return Array.from(base.values());
}

/** MRR / ARR à partir des abonnements actifs. */
export function computeMrr(subs: { monthly_ht?: number | null; status?: string | null }[]) {
  const mrr = subs
    .filter((s) => (s.status ?? "active") === "active")
    .reduce((a, s) => a + (Number(s.monthly_ht) || 0), 0);
  return { mrr, arr: mrr * 12 };
}

/** Coût mensuel des charges récurrentes. */
export function monthlyRecurringCost(rows: { amount_ht?: number | null; periodicity?: string | null; active?: boolean }[]) {
  return rows
    .filter((r) => r.active !== false)
    .reduce((a, r) => {
      const amt = Number(r.amount_ht) || 0;
      const p = r.periodicity ?? "monthly";
      if (p === "yearly") return a + amt / 12;
      if (p === "quarterly") return a + amt / 3;
      if (p === "weekly") return a + amt * 4.33;
      return a + amt;
    }, 0);
}
