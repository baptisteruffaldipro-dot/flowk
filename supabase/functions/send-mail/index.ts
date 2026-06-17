// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.14";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMTP_HOST = Deno.env.get("MAIL_SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("MAIL_SMTP_PORT") || "465", 10);
const USER = Deno.env.get("MAIL_USERNAME")!;
const PASS = Deno.env.get("MAIL_PASSWORD")!;
const FROM_NAME = Deno.env.get("MAIL_FROM_NAME") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });

  // Auth: caller must be admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

  try {
    const body = await req.json();
    const { to, cc, subject, text, html, inReplyTo, references } = body as {
      to: string | string[];
      cc?: string[];
      subject: string;
      text?: string;
      html?: string;
      inReplyTo?: string;
      references?: string;
    };
    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "missing to/subject" }), { status: 400, headers: corsHeaders });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: USER, pass: PASS },
    });

    const info = await transporter.sendMail({
      from: FROM_NAME ? `"${FROM_NAME}" <${USER}>` : USER,
      to,
      cc,
      subject,
      text,
      html,
      inReplyTo,
      references,
    });

    return new Response(JSON.stringify({ ok: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-mail error", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});