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
  mise_en_page: "Mise en page",
  creation: "Création",
  logo: "Logo",
  impression: "Impression",
  devis: "Devis",
  moodboard: "Moodboard",
  ajustements: "Ajustements",
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