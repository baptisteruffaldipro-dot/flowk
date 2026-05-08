import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// Mappe une payload Fillout ({ submission: { questions: [...] } } ou { questions: [...] })
// vers notre format { name, email, phone, company, message }.
function mapFillout(body: any): any {
  const submission = body?.submission ?? body;
  const questions: any[] = Array.isArray(submission?.questions) ? submission.questions : [];
  if (!questions.length) return null;

  const out: any = { source: "fillout" };
  const messageParts: string[] = [];

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const q of questions) {
    const label = norm(q?.name ?? q?.label ?? "");
    const type = (q?.type ?? "").toString().toLowerCase();
    const raw = q?.value;
    const val = Array.isArray(raw) ? raw.join(", ") : (raw == null ? "" : String(raw));
    if (!val) continue;

    if (!out.email && (type.includes("email") || /e-?mail|courriel/.test(label))) {
      out.email = val;
    } else if (!out.phone && (type.includes("phone") || /tel|phone|portable|mobile/.test(label))) {
      out.phone = val;
    } else if (!out.company && /(societe|company|entreprise|organisation|organization)/.test(label)) {
      out.company = val;
    } else if (!out.name && /(nom|name|prenom|first ?name|last ?name|full ?name)/.test(label)) {
      out.name = val;
    } else if (!out.message && /(message|demande|projet|description|commentaire|comment)/.test(label)) {
      out.message = val;
    } else {
      messageParts.push(`${q?.name ?? q?.label ?? "Champ"}: ${val}`);
    }
  }

  if (messageParts.length) {
    out.message = out.message ? `${out.message}\n\n${messageParts.join("\n")}` : messageParts.join("\n");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    // Si payload Fillout détectée, on la mappe vers notre format.
    const isFillout = !!(raw?.submission?.questions || raw?.questions);
    const body = isFillout ? (mapFillout(raw) ?? raw) : raw;

    const name = clean(body.name, 200);
    const email = clean(body.email, 320);
    const phone = clean(body.phone, 50);
    const company = clean(body.company, 200);
    const message = clean(body.message, 5000);
    const source = clean(body.source, 100) ?? "site_web";

    if (!name && !email && !phone) {
      return new Response(JSON.stringify({ error: "Au moins un champ (nom, email ou téléphone) est requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("leads").insert({
      name, email, phone, company, message, source,
      metadata: { user_agent: req.headers.get("user-agent"), referer: req.headers.get("referer") },
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});