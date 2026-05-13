// Edge function: create an invoice on Tiime from one of our `invoices` rows.
//
// STATUS: STUB. Tiime has no public API. The actual endpoints below are
// placeholders and need to be replaced once the Tiime web-app network calls
// have been captured (see .lovable/plan.md, step 1).
//
// Required secrets:
//   - TIIME_EMAIL
//   - TIIME_PASSWORD
//
// Input:  { invoice_id: string }
// Output: { tiime_id: string, url: string }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// TODO: replace with the real base URL discovered from the Tiime web app.
const TIIME_BASE = "https://chronos.tiime.fr";

type LoginResp = { token: string; companies?: Array<{ id: string }> };

async function tiimeLogin(email: string, password: string): Promise<LoginResp> {
  // TODO: confirm endpoint + payload shape.
  const r = await fetch(`${TIIME_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`Tiime login failed [${r.status}]: ${await r.text()}`);
  return await r.json();
}

async function tiimeCreateInvoice(token: string, companyId: string, payload: unknown) {
  // TODO: confirm endpoint + payload shape.
  const r = await fetch(`${TIIME_BASE}/companies/${companyId}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Tiime create invoice failed [${r.status}]: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const TIIME_EMAIL = Deno.env.get("TIIME_EMAIL");
    const TIIME_PASSWORD = Deno.env.get("TIIME_PASSWORD");
    if (!TIIME_EMAIL || !TIIME_PASSWORD) {
      return new Response(
        JSON.stringify({
          error: "TIIME_EMAIL et TIIME_PASSWORD doivent être configurés dans les secrets.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const invoiceId = body?.invoice_id;
    if (!invoiceId || typeof invoiceId !== "string") {
      return new Response(JSON.stringify({ error: "invoice_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin via JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Réservé aux admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load invoice + client + installments.
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*, clients(name,email,company,address,phone), invoice_installments(*)")
      .eq("id", invoiceId)
      .single();
    if (invErr || !invoice) throw new Error(`Facture introuvable: ${invErr?.message}`);

    // Login + create.
    const login = await tiimeLogin(TIIME_EMAIL, TIIME_PASSWORD);
    const companyId = login.companies?.[0]?.id ?? "";

    // TODO: refine the payload mapping once Tiime endpoints are known.
    const payload = {
      label: invoice.label,
      amount: Number(invoice.amount),
      customer: {
        name: invoice.clients?.company || invoice.clients?.name,
        email: invoice.clients?.email,
        address: invoice.clients?.address,
      },
      items:
        invoice.billing_type === "horaire" && invoice.hours && invoice.hourly_rate
          ? [
              {
                description: invoice.label,
                quantity: Number(invoice.hours),
                unit_price: Number(invoice.hourly_rate),
              },
            ]
          : [{ description: invoice.label, quantity: 1, unit_price: Number(invoice.amount) }],
      installments: (invoice.invoice_installments ?? []).map((ii: any) => ({
        label: ii.label,
        amount: Number(ii.amount),
        due_date: ii.due_date,
      })),
    };

    const created = await tiimeCreateInvoice(login.token, companyId, payload);
    const tiimeId = String(created?.id ?? "");
    const url = created?.public_url ?? created?.url ?? "";

    await supabase
      .from("invoices")
      .update({
        tiime_invoice_id: tiimeId || null,
        tiime_synced_at: new Date().toISOString(),
      } as any)
      .eq("id", invoiceId);

    return new Response(JSON.stringify({ tiime_id: tiimeId, url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("tiime-create-invoice error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});