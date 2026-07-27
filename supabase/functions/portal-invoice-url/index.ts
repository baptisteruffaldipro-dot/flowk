import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    if (!token || typeof token !== "string" || token.length > 200) {
      return json({ error: "Token requis" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: portal, error } = await admin
      .from("client_portals")
      .select("entity_type, entity_id, is_published")
      .eq("share_token", token)
      .eq("is_published", true)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!portal) return json({ error: "Portail introuvable" }, 404);

    const table = portal.entity_type === "task" ? "tasks" : "projects";
    const { data: entity } = await admin
      .from(table)
      .select("invoice_file_path")
      .eq("id", portal.entity_id)
      .maybeSingle();

    const path = (entity as any)?.invoice_file_path as string | null;
    if (!path) return json({ error: "Aucune facture" }, 404);

    const { data: signed, error: sErr } = await admin.storage
      .from("livrables")
      .createSignedUrl(path, 60 * 10);
    if (sErr || !signed?.signedUrl) return json({ error: sErr?.message ?? "Erreur" }, 500);

    return json({ url: signed.signedUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
