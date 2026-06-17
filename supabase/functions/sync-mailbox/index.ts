// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { ImapFlow } from "npm:imapflow@1.0.164";
import { simpleParser } from "npm:mailparser@3.7.1";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const IMAP_HOST = Deno.env.get("MAIL_IMAP_HOST")!;
const IMAP_PORT = parseInt(Deno.env.get("MAIL_IMAP_PORT") || "993", 10);
const SMTP_HOST = Deno.env.get("MAIL_SMTP_HOST")!;
const SMTP_PORT = parseInt(Deno.env.get("MAIL_SMTP_PORT") || "465", 10);
const USER = Deno.env.get("MAIL_USERNAME")!;
const PASS = Deno.env.get("MAIL_PASSWORD")!;
const FROM_NAME = Deno.env.get("MAIL_FROM_NAME") || null;

async function ensureAccount(supabase: any) {
  const { data: existing } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("email", USER)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("mail_accounts")
    .insert({
      email: USER,
      imap_host: IMAP_HOST,
      imap_port: IMAP_PORT,
      imap_tls: IMAP_PORT === 993,
      smtp_host: SMTP_HOST,
      smtp_port: SMTP_PORT,
      smtp_tls: SMTP_PORT === 465,
      from_name: FROM_NAME,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function matchClient(supabase: any, email: string): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const account = await ensureAccount(supabase);
    console.log("account", { host: account.imap_host, port: account.imap_port, tls: account.imap_tls, user: USER });

    // Quick probe: can we even open a raw TLS connection to the IMAP server?
    try {
      const t0 = Date.now();
      const conn = await Deno.connectTls({ hostname: account.imap_host, port: account.imap_port });
      const buf = new Uint8Array(256);
      const n = await conn.read(buf);
      console.log("tls greeting", Date.now() - t0, "ms:", new TextDecoder().decode(buf.subarray(0, n || 0)).trim());
      conn.close();
    } catch (probeErr) {
      console.error("tls probe failed", probeErr);
      throw probeErr;
    }

    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_tls,
      auth: { user: USER, pass: PASS },
      logger: false,
      socketTimeout: 30000,
      greetingTimeout: 15000,
      connectionTimeout: 15000,
    });

    console.log("connecting...");
    await client.connect();
    console.log("connected, opening INBOX...");
    const lock = await client.getMailboxLock("INBOX");
    console.log("INBOX locked");
    let imported = 0;
    let maxUid = account.last_uid_seen || 0;

    try {
      const status = await client.status("INBOX", { uidNext: true, messages: true });
      console.log("status", status);
      const lastSeen = account.last_uid_seen || 0;
      const uidNext = (status as any).uidNext || 1;
      let range: string;
      if (lastSeen === 0) {
        const from = Math.max(1, uidNext - 10);
        range = `${from}:*`;
      } else {
        range = `${lastSeen + 1}:*`;
      }
      console.log("fetching range", range);

      const PER_RUN_LIMIT = 20;
      let processed = 0;
      // Iterate UIDs greater than last seen
      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        flags: true,
        source: true,
      }, { uid: true })) {
        if (!msg.uid || msg.uid <= (account.last_uid_seen || 0)) continue;
        console.log("processing uid", msg.uid);

        try {
          const parsed = await simpleParser(msg.source as Uint8Array);
          const fromAddr = parsed.from?.value?.[0];
          const fromEmail = (fromAddr?.address || "").toLowerCase();
          const fromName = fromAddr?.name || null;
          const toEmails = (parsed.to?.value || []).map((a: any) => a.address).filter(Boolean);
          const ccEmails = (parsed.cc?.value || []).map((a: any) => a.address).filter(Boolean);
          const isRead = (msg.flags && (msg.flags as any).has?.("\\Seen")) || false;
          const snippet = (parsed.text || "").slice(0, 240).replace(/\s+/g, " ").trim();
          const clientId = await matchClient(supabase, fromEmail);

          const { data: inserted, error: insErr } = await supabase
            .from("mails")
            .insert({
              account_id: account.id,
              uid: msg.uid,
              message_id: parsed.messageId || null,
              in_reply_to: parsed.inReplyTo || null,
              thread_key: parsed.references
                ? (Array.isArray(parsed.references) ? parsed.references[0] : parsed.references)
                : parsed.messageId || null,
              from_email: fromEmail || "unknown@unknown",
              from_name: fromName,
              to_emails: toEmails,
              cc_emails: ccEmails,
              subject: parsed.subject || "(sans objet)",
              snippet,
              body_text: parsed.text || null,
              body_html: parsed.html || null,
              received_at: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
              is_read: isRead,
              client_id: clientId,
              raw_headers: parsed.headerLines ? Object.fromEntries(parsed.headerLines.map((h: any) => [h.key, h.line])) : null,
            })
            .select("id")
            .single();

          if (insErr) {
            if (!String(insErr.message).includes("duplicate")) console.error("insert error", insErr);
          } else if (inserted && parsed.attachments?.length) {
            for (const att of parsed.attachments) {
              const path = `${account.id}/${inserted.id}/${att.filename || "attachment"}`;
              await supabase.storage.from("mails").upload(path, att.content, {
                contentType: att.contentType,
                upsert: true,
              });
              await supabase.from("mail_attachments").insert({
                mail_id: inserted.id,
                filename: att.filename || "attachment",
                mime: att.contentType,
                size: att.size,
                storage_path: path,
              });
            }
          }

          if (msg.uid > maxUid) maxUid = msg.uid;
          imported++;
          processed++;
          if (processed >= PER_RUN_LIMIT) break;
        } catch (e) {
          console.error("parse error", e);
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    await supabase
      .from("mail_accounts")
      .update({
        last_uid_seen: maxUid,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", account.id);

    return new Response(JSON.stringify({ ok: true, imported, last_uid_seen: maxUid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-mailbox error", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});