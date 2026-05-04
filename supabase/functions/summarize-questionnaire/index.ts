import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_LABELS: Record<string, string> = {
  logo: "Logo / Identité visuelle",
  print: "Projet d'impression",
  web: "Projet web",
  rapide: "Brief express",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Only admins can trigger AI summarization (consumes credits)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: q, error: qErr } = await supabase
      .from("questionnaires")
      .select("*, clients(name), projects(name)")
      .eq("id", id)
      .single();
    if (qErr || !q) throw new Error(qErr?.message || "Questionnaire introuvable");

    const tmpl = TEMPLATE_LABELS[q.template] || q.template;
    const answersText = Object.entries(q.answers || {})
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v || "(non renseigné)"}`)
      .join("\n");

    const systemPrompt = `Tu es un directeur de création expérimenté. À partir des réponses brutes d'un client à un questionnaire de brief, tu produis une synthèse claire, structurée et actionnable pour l'équipe créative.

Format attendu (en français, en markdown léger sans titres trop gros) :
1. **Le client en une phrase** — qui, quoi, pour qui.
2. **Objectifs du projet** — 2-4 points clés.
3. **Positionnement & ton** — personnalité à transmettre, mots-clés positifs/négatifs.
4. **Cible** — public visé.
5. **Contraintes & écueils à éviter**.
6. **Pistes créatives suggérées** — 2-3 directions à explorer.
7. **Points à clarifier** — questions ouvertes si des infos manquent.

Sois concis, concret, sans bla-bla. Si une info manque, mentionne-le brièvement.`;

    const userPrompt = `Type de brief : ${tmpl}
Titre : ${q.title}
Client : ${q.clients?.name || "non précisé"}
Projet : ${q.projects?.name || "non précisé"}

Réponses du client :
${answersText}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Crédits Lovable AI épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${t}`);
    }

    const aiJson = await aiResp.json();
    const summary = aiJson.choices?.[0]?.message?.content || "";

    const { error: upErr } = await supabase
      .from("questionnaires")
      .update({ ai_summary: summary, ai_summary_generated_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});