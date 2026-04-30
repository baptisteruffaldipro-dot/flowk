import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) {
      return new Response(JSON.stringify({ error: "token invalide" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase
      .from("questionnaires")
      .select("id, title, template, status, answers")
      .eq("share_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response(JSON.stringify({ error: "introuvable" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (data.status === "archive") return new Response(JSON.stringify({ error: "archivé" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ questionnaire: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});