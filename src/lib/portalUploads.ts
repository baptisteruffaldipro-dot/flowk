import { supabase } from "@/integrations/supabase/client";

export type PortalAttachment = { path: string; name: string; size: number };

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Envoie un fichier du client (lien public) dans le dossier de son portail. */
export async function uploadPortalFile(token: string, file: File): Promise<PortalAttachment> {
  if (file.size > MAX_ATTACHMENT_SIZE) throw new Error(`« ${file.name} » dépasse 50 Mo`);
  const { data, error } = await supabase.functions.invoke("portal-client-upload", {
    body: { action: "sign_upload", token, filename: file.name, size: file.size },
  });
  if (error || (data as any)?.error) throw new Error((data as any)?.error ?? "Envoi impossible");
  const { path, uploadToken } = data as { path: string; uploadToken: string };
  const { error: upErr } = await supabase.storage
    .from("client-uploads")
    .uploadToSignedUrl(path, uploadToken, file, { contentType: file.type || undefined });
  if (upErr) throw new Error(upErr.message);
  return { path, name: file.name, size: file.size };
}

/** Lien de lecture temporaire : côté client via son lien, côté studio en direct. */
export async function getPortalFileUrl(path: string, token?: string): Promise<string | null> {
  if (token) {
    const { data } = await supabase.functions.invoke("portal-client-upload", {
      body: { action: "sign_download", token, path },
    });
    return (data as any)?.url ?? null;
  }
  const { data } = await supabase.storage.from("client-uploads").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
