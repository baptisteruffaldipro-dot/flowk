export const fmtMoney = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

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
  aujourdhui: "Aujourd'hui",
  envoye: "Envoyé",
  a_facturer: "À facturer",
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
  bat_en_attente: "BAT en attente",
  bat_valide: "BAT validé",
  en_impression: "En impression",
  expedie: "Expédié",
  livre: "Livré",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  a_facturer: "À facturer",
  facturee: "Facturée",
  payee: "Payée",
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  identite_graphique: "Identité graphique",
  support_communication: "Support de communication",
  web: "Web",
  impression: "Impression",
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

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";