// Helpers de budgétisation des tâches : estimé (presta + impression), réel,
// et détection des tâches non budgétisées.
import { computeTaskBilling, type TaskBillingInput } from "./billing";

export type TaskBudgetInput = TaskBillingInput & {
  estimated_print_amount?: number | null;
  print_orders?: Array<{ amount?: number | null }> | null;
};

export type TaskBudget = {
  estimatedPresta: number;
  estimatedPrint: number;
  estimatedTotal: number;
  realPresta: number;
  realPrint: number;
  realTotal: number;
  variance: number;        // realTotal - estimatedTotal
  variancePct: number;     // 0 si pas d'estimé
  hasNoEstimate: boolean;  // ni presta ni impression renseignés
};

export function computeTaskBudget(t: TaskBudgetInput): TaskBudget {
  const hourly = Number(t.hourly_rate ?? 0);
  const flat = Number(t.flat_amount ?? 0);
  const estMin = Number(t.estimated_minutes ?? 0);

  // Estimé presta : forfait = flat_amount, sinon estimated_minutes × taux horaire.
  const estimatedPresta =
    t.billing_type === "forfait"
      ? flat
      : (estMin / 60) * hourly;

  const estimatedPrintField = Number(t.estimated_print_amount ?? 0);
  const linkedPrint = (t.print_orders ?? []).reduce(
    (sum, p) => sum + Number(p?.amount ?? 0),
    0,
  );
  // Si on a un montant saisi manuellement, on le prend ; sinon on retombe sur
  // le print_order lié pour ne pas oublier de coût impression déjà connu.
  const estimatedPrint = estimatedPrintField > 0 ? estimatedPrintField : linkedPrint;

  const estimatedTotal = estimatedPresta + estimatedPrint;

  // Réel presta : calculé via computeTaskBilling (heures réelles + forfait + dépassement + retours).
  const billing = computeTaskBilling(t);
  const realPresta = billing.total;
  const realPrint = linkedPrint; // seul réel impression dispo : print_order lié
  const realTotal = realPresta + realPrint;

  const variance = realTotal - estimatedTotal;
  const variancePct = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;

  const hasNoEstimate = estimatedPresta <= 0 && estimatedPrint <= 0;

  return {
    estimatedPresta,
    estimatedPrint,
    estimatedTotal,
    realPresta,
    realPrint,
    realTotal,
    variance,
    variancePct,
    hasNoEstimate,
  };
}

