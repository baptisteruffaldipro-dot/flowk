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

// Tiime uses Auth0 (auth0.tiime.fr) for auth and chronos-api.tiime-apps.com for the API.
// client_id discovered from JWT `azp` claim of a real Tiime web-app session.
const TIIME_AUTH = "https://auth0.tiime.fr";
const TIIME_AUDIENCE = "https://chronos/";
const TIIME_CLIENT_ID = "iEbsbe3o66gcTBfGRa012kj1Rb6vjAND";
const TIIME_REALM = "Chronos-prod-db";
const TIIME_BASE = "https://chronos-api.tiime-apps.com/v1";

type LoginResp = { token: string; companies?: Array<{ id: string }> };

class TiimeAuthError extends Error {
  constructor(message: string, public status = 502, public code = "tiime_auth_failed") {
    super(message);
  }
}

async function readTiimeError(response: Response) {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw);
    return { raw, error: parsed?.error, description: parsed?.error_description };
  } catch {
    return { raw, error: undefined, description: undefined };
  }
}

async function tiimeLogin(email: string, password: string): Promise<LoginResp> {
  const r = await fetch(`${TIIME_AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      realm: TIIME_REALM,
      username: email,
      password,
      audience: TIIME_AUDIENCE,
      scope: "openid email offline_access",
      client_id: TIIME_CLIENT_ID,
    }),
  });
  if (!r.ok) {
    const details = await readTiimeError(r);
    if (details.error === "mfa_required") {
      throw new TiimeAuthError(
        "La connexion Tiime est protégée par double authentification. Tiime bloque donc la création automatique par mot de passe ; crée la facture dans Tiime puis colle le lien manuellement.",
        409,
        "tiime_mfa_required",
      );
    }
    throw new TiimeAuthError(`Tiime login failed [${r.status}]: ${details.raw}`, r.status);
  }
  const json = await r.json();
  const token = json.access_token ?? json.id_token;
  if (!token) throw new Error("Tiime login: no access_token in response");

  // Fetch companies list to discover companyId.
  const cr = await fetch(`${TIIME_BASE}/companies`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const companies = cr.ok ? await cr.json() : [];
  return { token, companies: Array.isArray(companies) ? companies : [] };
}

async function tiimeCreateInvoice(token: string, companyId: string, payload: unknown) {
  const r = await fetch(`${TIIME_BASE}/companies/${companyId}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "tiime-app": "tiime",
      "tiime-app-platform": "web",
      "tiime-app-version": "4.33.2",
      Origin: "https://apps.tiime.fr",
      Referer: "https://apps.tiime.fr/",
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
    const companyId =
      Deno.env.get("TIIME_COMPANY_ID") ?? String(login.companies?.[0]?.id ?? "");
    if (!companyId) throw new Error("Tiime companyId introuvable");

    // Build payload matching Tiime's /invoices schema (captured from web UI).
    const today = new Date().toISOString().slice(0, 10);
    const isHourly =
      invoice.billing_type === "horaire" && invoice.hours && invoice.hourly_rate;
    const quantity = isHourly ? Number(invoice.hours) : 1;
    const unitAmount = isHourly ? Number(invoice.hourly_rate) : Number(invoice.amount);
    const lineAmount = +(quantity * unitAmount).toFixed(2);

    const payload = {
      client: null,
      client_country_code: null,
      client_delivery_address: "",
      client_delivery_city: "",
      client_delivery_country_code: null,
      client_delivery_enabled: false,
      client_delivery_name: null,
      client_delivery_postal_code: "",
      client_intracom_vat_number: null,
      client_intracom_vat_number_enabled: false,
      client_name: invoice.clients?.company || invoice.clients?.name || "",
      client_siren_or_siret: null,
      client_siren_or_siret_enabled: false,
      color: "#476388",
      discount_amount: null,
      discount_description: "",
      discount_enabled: false,
      discount_percentage: null,
      emission_date: today,
      footer: "SIREN 808526271 - NAF 9003A\nTVA intracommunautaire : FR26808526271",
      free_field: "",
      free_field_enabled: false,
      header: "EI. ATELIER RUFO\n5 RUE CÉCILE TANGUY\n17200 ROYAN\n ",
      lang_country_code: "FR",
      lines: [
        {
          article: null,
          description: invoice.label || "",
          discount_amount: null,
          discount_description: "",
          discount_percentage: null,
          id: null,
          invoicing_category_type: "benefit",
          invoicing_unit: null,
          line_amount: lineAmount,
          quantity,
          sequence: 1,
          unit_amount: unitAmount,
          vat_type: { code: "normal" },
        },
      ],
      invoicing_logo: { id: 16767103, size: { width: 118, height: 118 } },
      non_applicable_vat_reason: null,
      non_applicable_vat_reason_enabled: false,
      number_template: "X",
      seller: {
        address: {
          city: "ROYAN",
          complement: null,
          country: "FR",
          postal_code: "17200",
          street: "6 rue Cécile Tanguy",
        },
        ape_code: "9003A",
        capital: null,
        contact: { email: null, phone: null },
        legal_form: "Entreprise individuelle",
        name: "E.I. Baptiste RUFFALDI",
        rcs_city: null,
        siret: "80852627100016",
        vat_number: "FR26808526271",
      },
      template: "advanced",
      text_lines: [],
      title: null,
      title_enabled: true,
      client_pa_electronic_address: null,
      total_excluding_taxes: lineAmount,
      total_including_taxes: lineAmount,
      totals_per_vat_type: {
        normal: { total_excluding_taxes: lineAmount, vat_amount: 0 },
      },
      advance_payment_invoices_ids: [],
      bank_detail_enabled: true,
      bic: "CMCIFR2AXXX",
      due_date: today,
      due_date_mode: "emission_date",
      iban: "FR7615519390870002272400137",
      payment_condition:
        "En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, à laquelle s'ajoutera une indemnité forfaitaire pour frais de recouvrement de 40€.",
      payment_condition_enabled: true,
      status: "draft",
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