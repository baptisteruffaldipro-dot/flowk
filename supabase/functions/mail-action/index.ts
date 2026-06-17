// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { ImapFlow } from "npm:imapflow@1.0.164";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IMAP_HOST = Deno.env.get("MAIL_IMAP_HOST")!;
const IMAP_PORT = parseInt(Deno.env.get("MAIL_IMAP_PORT") || "993", 10);
const USER = Deno.env.get("MAIL_USERNAME")!;
const PASS = Deno.env.get("MAIL_PASSWORD")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

  try {
    const { mailId, action } = await req.json() as { mailId: string; action: "mark_read" | "mark_unread" | "archive" };
    if (!mailId || !action) {
      return new Response(JSON.stringify({ error: "missing params" }), { status: 400, headers: corsHeaders });
    }

    const { data: mail, error: mailErr } = await admin
      .from("mails")
      .select("id, uid, account_id")
      .eq("id", mailId)
      .single();
    if (mailErr || !mail) throw mailErr || new Error("mail not found");

    // IMAP update
    const client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: IMAP_PORT === 993,
      auth: { user: USER, pass: PASS },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (action === "mark_read") {
        await client.messageFlagsAdd({ uid: String(mail.uid) }, ["\\Seen"], { uid: true });
      } else if (action === "mark_unread") {
        await client.messageFlagsRemove({ uid: String(mail.uid) }, ["\\Seen"], { uid: true });
      } else if (action === "archive") {
        // try common Archive mailbox names; ignore failures
        const candidates = ["Archive", "Archives", "[Gmail]/All Mail"];
        let moved = false;
        for (const dest of candidates) {
          try {
            await client.messageMove({ uid: String(mail.uid) }, dest, { uid: true });
            moved = true;
            break;
          } catch (_) { /* try next */ }
        }
        if (!moved) {
          // fallback: just mark seen, app keeps archived flag
          try { await client.messageFlagsAdd({ uid: String(mail.uid) }, ["\\Seen"], { uid: true }); } catch (_) {}
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    // DB update
    const patch: any = {};
    if (action === "mark_read") patch.is_read = true;
    if (action === "mark_unread") patch.is_read = false;
    if (action === "archive") { patch.is_archived = true; patch.is_read = true; }
    await admin.from("mails").update(patch).eq("id", mailId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("mail-action error", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});