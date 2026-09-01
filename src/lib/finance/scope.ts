// Portée partagée du module Finance : pôle d'activité + période.
// Store minimal (module-level + useSyncExternalStore) persisté en localStorage,
// pour que le filtre reste actif en naviguant entre les pages Finance.
import { useSyncExternalStore } from "react";

export type PeriodType = "month" | "quarter" | "year" | "custom";

export type FinanceScope = {
  /** null = tous les pôles */
  buId: string | null;
  periodType: PeriodType;
  /** ancre de la période (ISO date) — ou début si custom */
  anchor: string;
  /** fin, uniquement pour custom */
  customEnd: string;
};

const KEY = "flowk.finance.scope";

const todayISO = () => new Date().toISOString().slice(0, 10);

const defaultScope = (): FinanceScope => ({
  buId: null,
  periodType: "month",
  anchor: todayISO(),
  customEnd: todayISO(),
});

let state: FinanceScope = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultScope(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultScope();
})();

const listeners = new Set<() => void>();

export function setFinanceScope(patch: Partial<FinanceScope>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useFinanceScope(): FinanceScope {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export type PeriodRange = { start: string; end: string; label: string };

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function periodRange(s: FinanceScope): PeriodRange {
  const a = new Date(s.anchor + "T00:00:00");
  if (s.periodType === "month") {
    const start = new Date(a.getFullYear(), a.getMonth(), 1);
    const end = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return { start: iso(start), end: iso(end), label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }
  if (s.periodType === "quarter") {
    const q = Math.floor(a.getMonth() / 3);
    const start = new Date(a.getFullYear(), q * 3, 1);
    const end = new Date(a.getFullYear(), q * 3 + 3, 0);
    return { start: iso(start), end: iso(end), label: `T${q + 1} ${a.getFullYear()}` };
  }
  if (s.periodType === "year") {
    const start = new Date(a.getFullYear(), 0, 1);
    const end = new Date(a.getFullYear(), 11, 31);
    return { start: iso(start), end: iso(end), label: String(a.getFullYear()) };
  }
  return { start: s.anchor, end: s.customEnd, label: "Personnalisé" };
}

export function shiftPeriod(s: FinanceScope, dir: -1 | 1): string {
  const a = new Date(s.anchor + "T00:00:00");
  if (s.periodType === "month") a.setMonth(a.getMonth() + dir);
  else if (s.periodType === "quarter") a.setMonth(a.getMonth() + 3 * dir);
  else if (s.periodType === "year") a.setFullYear(a.getFullYear() + dir);
  return iso(a);
}

/** Liste des mois (YYYY-MM) couverts par une plage. */
export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur <= e) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export const monthLabel = (ym: string) =>
  new Date(ym + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
