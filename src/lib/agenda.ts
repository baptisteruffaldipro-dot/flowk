export type AgendaCategory = "creation" | "impression" | "devis" | "gestion" | "production" | "web" | "client" | "autre";

export const CATEGORY_LABEL: Record<AgendaCategory, string> = {
  creation: "Création",
  impression: "Impression",
  devis: "Devis",
  gestion: "Gestion / compta",
  production: "Production",
  web: "Web",
  client: "Client / RDV",
  autre: "Autre",
};

const MAP: Record<string, AgendaCategory> = {
  conception_graphique: "creation", creation: "creation", crea: "creation", recherche_graphique: "creation",
  moodboard: "creation", illustration: "creation", croquis: "creation", logo: "creation", logotype: "creation",
  affiche: "creation", mise_en_page: "creation", ajustements: "creation", refonte: "creation",
  vectorisation: "creation", vecto: "creation", etiquette: "creation", covering: "creation", projet: "creation", sideprojet: "creation",
  impression: "impression", a_commander: "impression", livrables: "impression",
  shooting: "production", motion: "production", reel: "production", post_insta: "production", maj_carte: "production", traduction: "production",
  developpement: "web", programmer: "web", test: "web",
  devis: "devis",
  acompte: "gestion", facture_a_faire: "gestion", facture_a_payer: "gestion", impaye: "gestion", gestion: "gestion",
  strategie: "gestion", organiser: "gestion",
  prospect: "client", rendez_vous: "client", prevoir_rdv: "client", rappeler: "client", en_attente_client: "client",
};

export function taskCategory(t: any): AgendaCategory {
  const keys: string[] = [...(t?.prestations ?? []), t?.prestation].filter(Boolean);
  for (const k of keys) if (MAP[k]) return MAP[k];
  return "autre";
}

export const catVar = (c: string) => `hsl(var(--cat-${c in CATEGORY_LABEL ? c : "autre"}))`;
export const catBg = (c: string, a = 0.14) => `hsl(var(--cat-${c in CATEGORY_LABEL ? c : "autre"}) / ${a})`;

export type Block = {
  id: string; title: string; category: string; start_time: string; duration_minutes: number;
  recurrence: "daily" | "weekdays" | "weekly" | "monthly"; weekdays: number[]; month_day: number | null;
  start_date: string; end_date: string | null; notes: string | null;
};

export const ymd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

/** JS weekday → Monday=1..Sunday=7 */
export const isoDow = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export function blockOccursOn(b: Block, d: Date): boolean {
  const key = ymd(d);
  if (key < b.start_date) return false;
  if (b.end_date && key > b.end_date) return false;
  switch (b.recurrence) {
    case "daily": return true;
    case "weekdays": return (b.weekdays ?? []).includes(isoDow(d));
    case "weekly": return isoDow(d) === isoDow(parseYmd(b.start_date));
    case "monthly": return d.getDate() === (b.month_day ?? parseYmd(b.start_date).getDate());
  }
  return false;
}

export const timeToMin = (t?: string | null) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
export const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const fmtDur = (m: number) => (m <= 0 ? "0" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);

export const DONE_STATUSES = ["archive", "facturee", "payee", "facture_envoyee", "a_facturer", "envoye", "tiime"];
