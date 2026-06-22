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
    const body = await req.json().catch(() => ({}));
    const { action, token } = body as { action?: string; token?: string };
    if (!token || typeof token !== "string") return json({ error: "Token requis" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: bat, error: batErr } = await admin
      .from("bats")
      .select("*, clients(name), projects(name)")
      .eq("share_token", token)
      .eq("is_published", true)
      .maybeSingle();
    if (batErr) return json({ error: batErr.message }, 500);
    if (!bat) return json({ error: "BAT introuvable" }, 404);

    if (action === "get") {
      let fileUrl: string | null = null;
      if (bat.file_path) {
        const { data: signed } = await admin.storage.from("bat").createSignedUrl(bat.file_path, 60 * 60);
        fileUrl = signed?.signedUrl ?? null;
      }
      return json({ bat, fileUrl });
    }

    if (action === "validate") {
      const signedBy = (body.signed_by as string | undefined)?.trim();
      if (!signedBy) return json({ error: "Nom requis" }, 400);
      if (bat.status === "valide") return json({ error: "BAT déjà validé" }, 400);
      const { error } = await admin.from("bats").update({
        status: "valide",
        validated_at: new Date().toISOString(),
        signed_by_name: signedBy.slice(0, 100),
        signed_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null,
      }).eq("id", bat.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "reject") {
      const reason = (body.reason as string | undefined)?.trim();
      if (!reason) return json({ error: "Raison requise" }, 400);
      const { error } = await admin.from("bats").update({
        status: "rejete",
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.slice(0, 1000),
        validated_at: null,
      }).eq("id", bat.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Erreur serveur" }, 500);
  }
});