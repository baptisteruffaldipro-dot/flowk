export const fmtMoney = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

// Returns true if the email is an internally-generated portal placeholder
// (created by the portal-token-exchange edge function) and shouldn't be shown.
export const isPlaceholderEmail = (email?: string | null) =>
  !!email && /^portal\+[a-f0-9]+@flowk\.local$/i.test(email);

// Returns the email only if it's a real user-facing address.
export const displayEmail = (email?: string | null) =>
  isPlaceholderEmail(email) ? null : email ?? null;

export const fmtMinutes = (m?: number | null) => {
  if (!m) return "0min";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h}h${min.toString().padStart(2, "0")}` : `${min}min`;
};

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const STATUS_LABEL: Record<string, string> = {
  a_faire: "À faire",
  en_attente: "En attente",
  aujourdhui: "En production",
  bat: "BAT",
  envoye: "Traité / En validation",
  impression: "Impression",
  tiime: "Tiime",
  a_facturer: "En facturation",
  facture_envoyee: "Facture envoyée",
  facturee: "Facturée",
  payee: "Payée",
  archive: "Archivé",
};

export const PRESTATION_LABEL: Record<string, string> = {
  // Création / graphisme
  conception_graphique: "Conception graphique",
  creation: "Création",
  crea: "Créa",
  recherche_graphique: "Recherche graphique",
  moodboard: "Moodboard",
  illustration: "Illustration",
  croquis: "Croquis",
  logo: "Logo",
  logotype: "Logotype",
  affiche: "Affiche",
  mise_en_page: "Mise en page",
  ajustements: "Ajustements",
  refonte: "Refonte",
  vectorisation: "Vectorisation",
  vecto: "Vecto",
  etiquette: "Étiquette",
  covering: "Covering",
  // Production
  impression: "Impression",
  shooting: "Shooting",
  motion: "Motion",
  reel: "Réel",
  post_insta: "Post insta",
  maj_carte: "MAJ Carte",
  livrables: "Livrables",
  a_commander: "À commander",
  traduction: "Traduction",
  // Web / dev
  developpement: "Développement",
  // Gestion / admin
  devis: "Devis",
  acompte: "Acompte",
  facture_a_faire: "Facture à faire",
  facture_a_payer: "Facture à payer",
  impaye: "Impayé",
  gestion: "Gestion",
  strategie: "Stratégie",
  prospect: "Prospect",
  rendez_vous: "Rendez-vous",
  prevoir_rdv: "Prévoir RDV",
  rappeler: "Rappeler",
  programmer: "Programmer",
  organiser: "Organiser",
  test: "Test",
  en_attente_client: "En attente client",
  projet: "Projet",
  sideprojet: "Sideprojet",
  autre: "Autre",
};

export const PRINT_STATUS_LABEL: Record<string, string> = {
  a_commander: "À commander",
  validation_bat: "Validation BAT",
  en_impression: "En impression",
  livre: "Livré",
  livre_paye: "Livré — payé",
  sav_en_cours: "SAV en cours",
  sav_a_faire: "SAV à faire",
};

export const PRINT_PAYMENT_LABEL: Record<string, string> = {
  non_regle: "Non réglé",
  acompte_50: "Acompte 50%",
  regle: "Réglé",
};

export const BAT_PRINT_STATUS_LABEL: Record<string, string> = {
  a_imprimer: "À imprimer",
  en_impression: "En impression",
  expedie: "Expédié",
  livre: "Livré",
};

export const BAT_STATUS_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  en_relecture: "En relecture client",
  valide: "Validé",
  rejete: "Rejeté",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  a_facturer: "À facturer",
  facturee: "Facturée",
  payee: "Payée",
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  identite_visuelle: "Identité visuelle",
  rebranding: "Rebranding",
  strategie_marque: "Stratégie de marque",
  logotype: "Logotype",
  support_communication: "Support de communication",
  web: "Web",
  impression: "Impression",
  multi_projets: "Multi-projets",
  autre: "Autre",
};

export const PRIORITY_LABEL: Record<string, string> = {
  en_priorite: "En priorité",
  secondaire: "Secondaire",
  attente_retour_client: "En attente retour client",
  devis: "Devis",
};

export const PRIORITY_COLOR: Record<string, string> = {
  en_priorite: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  secondaire: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  attente_retour_client: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  devis: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

// Notion-inspired column palette — works on light AND dark themes
export const STATUS_META: Record<string, { emoji: string; bg: string; ring: string; count: string; accent: string }> = {
  a_faire:    { emoji: "📁", bg: "bg-rose-50 dark:bg-rose-950/40",       ring: "ring-rose-200/70 dark:ring-rose-900/50",       count: "text-rose-600 dark:text-rose-400",       accent: "bg-rose-400" },
  aujourdhui: { emoji: "👷", bg: "bg-amber-50 dark:bg-amber-950/40",     ring: "ring-amber-200/70 dark:ring-amber-900/50",     count: "text-amber-600 dark:text-amber-400",     accent: "bg-amber-400" },
  bat:        { emoji: "📝", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", ring: "ring-fuchsia-200/70 dark:ring-fuchsia-900/50", count: "text-fuchsia-600 dark:text-fuchsia-400", accent: "bg-fuchsia-400" },
  envoye:     { emoji: "✅", bg: "bg-sky-50 dark:bg-sky-950/40",         ring: "ring-sky-200/70 dark:ring-sky-900/50",         count: "text-sky-600 dark:text-sky-400",         accent: "bg-sky-400" },
  impression: { emoji: "🖨️", bg: "bg-orange-50 dark:bg-orange-950/40",   ring: "ring-orange-200/70 dark:ring-orange-900/50",   count: "text-orange-600 dark:text-orange-400",   accent: "bg-orange-400" },
  tiime:      { emoji: "🧾", bg: "bg-violet-50 dark:bg-violet-950/40",   ring: "ring-violet-200/70 dark:ring-violet-900/50",   count: "text-violet-600 dark:text-violet-400",   accent: "bg-violet-400" },
  a_facturer: { emoji: "💰", bg: "bg-emerald-50 dark:bg-emerald-950/40", ring: "ring-emerald-200/70 dark:ring-emerald-900/50", count: "text-emerald-600 dark:text-emerald-400", accent: "bg-emerald-400" },
  facture_envoyee: { emoji: "🧾", bg: "bg-teal-50 dark:bg-teal-950/40",  ring: "ring-teal-200/70 dark:ring-teal-900/50",       count: "text-teal-600 dark:text-teal-400",       accent: "bg-teal-400" },
  archive:    { emoji: "✅", bg: "bg-stone-100 dark:bg-stone-900/40",    ring: "ring-stone-200 dark:ring-stone-800/60",        count: "text-stone-600 dark:text-stone-400",     accent: "bg-stone-400" },
};

// Tag palette — readable on both light & dark themes (Notion-style soft chips)
const TAG_PALETTE = [
  "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-500/30",
  "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-500/30",
  "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30",
  "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/30",
  "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-500/20 dark:text-lime-200 dark:border-lime-500/30",
  "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-200 dark:border-green-500/30",
  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30",
  "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-200 dark:border-teal-500/30",
  "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-500/30",
  "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-500/30",
  "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/30",
  "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-500/30",
  "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-500/30",
  "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/30",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 dark:border-fuchsia-500/30",
  "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-200 dark:border-pink-500/30",
  "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-500/20 dark:text-stone-200 dark:border-stone-500/30",
];

export function tagColor(key?: string | null): string {
  if (!key) return "bg-muted text-muted-foreground border-border";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";