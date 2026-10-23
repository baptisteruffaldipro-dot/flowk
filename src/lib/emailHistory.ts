export type EmailHistoryKind = "link" | "files" | "payment_reminder";
export type EmailHistoryEntry = { kind: EmailHistoryKind; sent_at: string };

export const EMAIL_KIND_LABEL: Record<EmailHistoryKind, string> = {
  link: "Envoi du lien de l'espace",
  files: "Envoi des fichiers",
  payment_reminder: "Relance de règlement",
};

export function normalizeHistory(raw: unknown): EmailHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e: any) => e && typeof e.sent_at === "string" && e.kind in EMAIL_KIND_LABEL)
    .sort((a: any, b: any) => b.sent_at.localeCompare(a.sent_at)) as EmailHistoryEntry[];
}

export function summarizeHistory(raw: unknown) {
  const list = normalizeHistory(raw);
  const reminders = list.filter((e) => e.kind === "payment_reminder").length;
  return { list, reminders, sends: list.length - reminders };
}
