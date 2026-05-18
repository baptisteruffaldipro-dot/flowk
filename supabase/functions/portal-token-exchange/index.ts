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
    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string" || token.length < 16) {
      return json({ error: "Token invalide" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Look up the client by token
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id, name, email, portal_user_id, portal_token")
      .eq("portal_token", token)
      .maybeSingle();

    if (clientErr) return json({ error: clientErr.message }, 500);
    if (!client) return json({ error: "Lien invalide ou expiré" }, 404);

    // 2. Ensure a portal_user_id exists for this client
    let portalUserId = client.portal_user_id as string | null;
    let email = (client.email as string | null) ?? null;

    if (!portalUserId) {
      // Use a synthetic email if the client has none — never sent, never visible
      const loginEmail = email ?? `portal+${token.slice(0, 16)}@flowk.local`;

      // Try to find an existing user with that email first
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = existing?.users?.find((u) => u.email?.toLowerCase() === loginEmail.toLowerCase());

      let userId = found?.id ?? null;
      if (!userId) {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: loginEmail,
          email_confirm: true,
          user_metadata: { portal_client_id: client.id, full_name: client.name },
        });
        if (createErr || !created.user) {
          return json({ error: createErr?.message ?? "Création du compte impossible" }, 500);
        }
        userId = created.user.id;
      }

      // Ensure the client role exists
      await admin.from("user_roles").upsert({ user_id: userId, role: "client" }, { onConflict: "user_id,role" });

      // Link to the client row
      await admin.from("clients").update({ portal_user_id: userId }).eq("id", client.id);
      portalUserId = userId;
      email = loginEmail;
    } else {
      // Make sure we have the email for the magic link
      const { data: userRes } = await admin.auth.admin.getUserById(portalUserId);
      email = userRes?.user?.email ?? email;
    }

    if (!email) return json({ error: "Email du compte portail introuvable" }, 500);

    // 3. Generate a magic link and extract the token_hash for verifyOtp
    const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkErr || !linkRes?.properties?.hashed_token) {
      return json({ error: linkErr?.message ?? "Impossible de générer le lien" }, 500);
    }

    return json({
      email,
      token_hash: linkRes.properties.hashed_token,
      client: { id: client.id, name: client.name },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erreur serveur" }, 500);
  }
});