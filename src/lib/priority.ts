import { computeTaskBilling } from "@/lib/billing";

// WIP limits per kanban column. Beyond these, the column is "saturated".
export const WIP_LIMITS: Record<string, number> = {
  aujourdhui: 3,
  a_faire: 15,
  bat: 8,
  envoye: 10,
  impression: 8,
  a_facturer: 10,
  archive: Infinity,
};

export function isColumnSaturated(status: string, count: number) {
  const limit = WIP_LIMITS[status];
  if (!limit || limit === Infinity) return false;
  return count > limit;
}

/**
 * Compute a 0-100 priority score for a task.
 * - Deadline proximity: 0d→40, ≤2d→30, ≤7d→20, ≤14d→10, else 0
 * - Priority field: en_priorite→30, devis→15, attente_retour_client→0, secondaire→0
 * - CA HT: ≥1000€→30, ≥500€→20, ≥200€→10, else 0
 */
export function computePriorityScore(task: any): number {
  let score = 0;

  // Deadline
  if (task.deadline) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.deadline); due.setHours(0, 0, 0, 0);
    const days = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (days <= 0) score += 40;
    else if (days <= 2) score += 30;
    else if (days <= 7) score += 20;
    else if (days <= 14) score += 10;
  }

  // Priority field
  if (task.priority === "en_priorite") score += 30;
  else if (task.priority === "devis") score += 15;

  // CA HT
  const billing = computeTaskBilling(task);
  const amount = task.billing_type === "forfait" ? (task.flat_amount ?? 0) : billing.total;
  if (amount >= 1000) score += 30;
  else if (amount >= 500) score += 20;
  else if (amount >= 200) score += 10;

  return Math.min(100, score);
}

export function priorityScoreColor(score: number): string {
  if (score >= 70) return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
  if (score >= 40) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  if (score >= 20) return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
  return "bg-muted text-muted-foreground border-border";
}

/**
 * Heuristic: detect when a task title looks like several deliverables packed together.
 * Triggers on enumerations (commas, "+", "/", " et ", numbered lists, newlines).
 */
export function detectMultipleDeliverables(title: string): boolean {
  const t = title.trim();
  if (t.length < 20) return false;
  // count separators
  const commaCount = (t.match(/,/g) ?? []).length;
  const plusCount = (t.match(/\s\+\s/g) ?? []).length;
  const slashCount = (t.match(/\s\/\s/g) ?? []).length;
  const etCount = (t.match(/\s+et\s+/gi) ?? []).length;
  const newlineCount = (t.match(/\n/g) ?? []).length;
  const numberedCount = (t.match(/(?:^|\s)\d+[\.\)]\s/g) ?? []).length;
  const total = commaCount + plusCount + slashCount + etCount + newlineCount + numberedCount;
  return total >= 2;
}