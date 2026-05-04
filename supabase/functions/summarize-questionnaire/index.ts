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
  note: "Note libre",
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
    const isNote = q.template === "note";
    const answersText = Object.entries(q.answers || {})
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : v || "(non renseigné)"}`)
      .join("\n");

    const systemPrompt = isNote
      ? `Tu es un chef de projet créatif. À partir d'une note brute écrite par le designer, tu produis :
1) Un mini-brief structuré clair et actionnable (markdown léger, sections courtes : Contexte, Objectif, Livrable(s), Contraintes/Deadlines, Points à clarifier).
2) Une liste de 3 à 7 tâches concrètes à réaliser, dans l'ordre logique, formulées avec un verbe d'action.

Sois concis, concret, sans remplissage. Si une info manque, mentionne-le brièvement dans "Points à clarifier".`
      : `Tu es un directeur de création expérimenté. À partir des réponses brutes d'un client à un questionnaire de brief, tu produis :
1) Une synthèse claire et actionnable pour l'équipe créative (markdown léger, sections : Le client en une phrase, Objectifs, Positionnement & ton, Cible, Contraintes, Pistes créatives, Points à clarifier).
2) Une liste de 3 à 7 tâches concrètes à réaliser pour avancer sur ce brief, formulées avec un verbe d'action.

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
        tools: [
          {
            type: "function",
            function: {
              name: "produce_brief",
              description: "Renvoie le mini-brief structuré et la liste de tâches suggérées.",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Mini-brief structuré en markdown léger.",
                  },
                  suggested_tasks: {
                    type: "array",
                    description: "3 à 7 tâches actionnables, verbe d'action en tête.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        priority: { type: "string", enum: ["principale", "secondaire"] },
                      },
                      required: ["title", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "suggested_tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "produce_brief" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Crédits Lovable AI épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      throw new Error(`AI error: ${t}`);
    }

    const aiJson = await aiResp.json();
    const msg = aiJson.choices?.[0]?.message;
    let summary = "";
    let suggestedTasks: Array<{ title: string; priority: string }> = [];
    const toolCall = msg?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        summary = args.summary || "";
        suggestedTasks = Array.isArray(args.suggested_tasks) ? args.suggested_tasks : [];
      } catch (e) {
        console.error("tool args parse error", e);
      }
    }
    if (!summary) summary = msg?.content || "";

    const { error: upErr } = await supabase
      .from("questionnaires")
      .update({
        ai_summary: summary,
        ai_summary_generated_at: new Date().toISOString(),
        ai_suggested_tasks: suggestedTasks,
      })
      .eq("id", id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ summary, suggested_tasks: suggestedTasks }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});