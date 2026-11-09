// Fichiers envoyés par le client depuis son lien de suivi (sans compte).
// - sign_upload : vérifie le lien, renvoie une URL d'envoi signée dans le dossier du portail.
// - sign_download : renvoie un lien de lecture temporaire pour un fichier de ce portail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "client-uploads";
const MAX_SIZE = 50 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return cleaned || "fichier";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { action, token } = body as { action?: string; token?: string };
    if (!token || typeof token !== "string" || token.length > 200) return json({ error: "Lien invalide" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: portal } = await admin
      .from("client_portals")
      .select("id")
      .eq("share_token", token)
      .eq("is_published", true)
      .maybeSingle();
    if (!portal) return json({ error: "Portail introuvable" }, 404);

    if (action === "sign_upload") {
      const filename = String(body.filename ?? "").slice(0, 200);
      const size = Number(body.size ?? 0);
      if (!filename) return json({ error: "Nom de fichier manquant" }, 400);
      if (!Number.isFinite(size) || size <= 0) return json({ error: "Fichier vide" }, 400);
      if (size > MAX_SIZE) return json({ error: "Fichier trop lourd (50 Mo maximum)" }, 400);
      const path = `${portal.id}/${crypto.randomUUID()}-${safeName(filename)}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) return json({ error: error?.message ?? "Envoi impossible" }, 500);
      return json({ path, uploadToken: data.token });
    }

    if (action === "sign_download") {
      const path = String(body.path ?? "");
      if (!path.startsWith(`${portal.id}/`) || path.includes("..")) return json({ error: "Fichier introuvable" }, 404);
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
      if (error || !data?.signedUrl) return json({ error: error?.message ?? "Fichier introuvable" }, 404);
      return json({ url: data.signedUrl });
    }

    return json({ error: "Action invalide" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
