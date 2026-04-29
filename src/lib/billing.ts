// Helpers de calcul de facturation pour une tâche

export type TaskBillingInput = {
  billing_type: "horaire" | "forfait" | string;
  flat_amount?: number | null;
  hourly_rate?: number | null;
  estimated_minutes?: number | null;
  total_minutes?: number | null;
  client_revisions_count?: number | null;
  free_revisions?: number | null;
  extra_revision_rate?: number | null;
};

export type BillingBreakdown = {
  base: number;          // forfait OU heures de base au taux horaire
  overrun: number;       // dépassement horaire (au-delà de l'estimé), si forfait
  overrunMinutes: number;
  revisionsBilled: number;
  extraRevisions: number;
  total: number;
  acompte: number;       // 50% du total estimé / actuel
};

/**
 * Calcule le détail de facturation d'une tâche.
 *
 * - Forfait : flat_amount jusqu'à estimated_minutes, puis hourly_rate au-delà.
 * - Horaire : total_minutes * hourly_rate.
 * - Retours : free_revisions inclus, puis extra_revision_rate par retour supplémentaire.
 */
export function computeTaskBilling(t: TaskBillingInput): BillingBreakdown {
  const total_minutes = Number(t.total_minutes ?? 0);
  const estimated_minutes = Number(t.estimated_minutes ?? 0);
  const hourly_rate = Number(t.hourly_rate ?? 0);
  const flat_amount = Number(t.flat_amount ?? 0);
  const revisions = Number(t.client_revisions_count ?? 0);
  const free = Number(t.free_revisions ?? 0);
  const extraRate = Number(t.extra_revision_rate ?? 0);

  let base = 0;
  let overrunMinutes = 0;
  let overrun = 0;

  if (t.billing_type === "forfait") {
    base = flat_amount;
    if (hourly_rate > 0 && estimated_minutes > 0 && total_minutes > estimated_minutes) {
      overrunMinutes = total_minutes - estimated_minutes;
      overrun = (overrunMinutes / 60) * hourly_rate;
    }
  } else {
    // horaire
    base = (total_minutes / 60) * hourly_rate;
  }

  const extraRevisions = Math.max(0, revisions - free);
  const revisionsBilled = extraRevisions * extraRate;

  const total = base + overrun + revisionsBilled;
  const acompte = total * 0.5;

  return {
    base,
    overrun,
    overrunMinutes,
    revisionsBilled,
    extraRevisions,
    total,
    acompte,
  };
}