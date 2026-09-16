import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

// Configuration baked in at scaffold time — keep in sync with send-email.ts.
const SITE_NAME = 'Flowk'
const SENDER_DOMAIN = 'notify.atelier-rufo.fr'
const FROM_DOMAIN = 'notify.atelier-rufo.fr'
// Address that automatically receives a copy of every app email sent through
// this function. Set to empty string to disable.
const BCC_OWNER_EMAIL = 'bonjour@atelier-rufo.fr'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Auth note: verify_jwt = true, so Supabase's gateway validates the caller's
// JWT before the request reaches this code. We additionally enforce that only
// admin users (or service-role callers from internal functions) can trigger
// sends, so portal clients cannot send branded emails to arbitrary recipients.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // ---- AuthZ: only admins or service_role can send emails ----
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const isServiceRole = token === supabaseServiceKey

  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }
  }

  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    idempotencyKey =
      body.idempotencyKey || body.idempotency_key || crypto.randomUUID()
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON in request body' }, 400)
  }

  if (!templateName) {
    return jsonResponse({ error: 'templateName is required' }, 400)
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return jsonResponse(
      {
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      },
      404
    )
  }

  // Template-level `to` takes precedence over the caller-provided recipient.
  const effectiveRecipient = template.to || recipientEmail
  if (!effectiveRecipient) {
    return jsonResponse(
      {
        error:
          'recipientEmail is required (unless the template defines a fixed recipient)',
      },
      400
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const messageId = crypto.randomUUID()

  async function log(
    status: 'sent' | 'suppressed' | 'failed',
    recipient: string,
    id: string,
    errorMessage?: string
  ) {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: id,
      template_name: templateName,
      recipient_email: recipient,
      status,
      error_message: errorMessage ?? null,
    })
    if (error) {
      console.error('Failed to write email_send_log row', {
        status,
        error: { code: error.code, message: error.message },
      })
    }
  }

  let result: { sent: boolean; reason?: string }
  try {
    result = await sendTemplateEmail(templateName, effectiveRecipient, {
      templateData,
      idempotencyKey,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Email send failed', { templateName, error: errorMsg })
    await log('failed', effectiveRecipient, messageId, errorMsg.slice(0, 1000))
    if (error instanceof EmailAPIError && error.status === 429) {
      return jsonResponse(
        { error: 'Rate limited', retryAfterSeconds: error.retryAfterSeconds ?? 60 },
        429
      )
    }
    return jsonResponse({ error: 'Failed to send email' }, 500)
  }

  if (!result.sent) {
    await log('suppressed', effectiveRecipient, messageId)
    console.log('Email suppressed', { templateName })
    return jsonResponse({ success: false, reason: 'email_suppressed' })
  }

  await log('sent', effectiveRecipient, messageId)
  console.log('App email sent', { templateName })

  // Send a copy to the owner so they always have a trace of what was sent.
  // Skipped when the recipient is already the owner, to avoid duplicates.
  if (
    BCC_OWNER_EMAIL &&
    effectiveRecipient.toLowerCase() !== BCC_OWNER_EMAIL.toLowerCase()
  ) {
    const ownerMessageId = crypto.randomUUID()
    try {
      const apiKey = Deno.env.get('LOVABLE_API_KEY')
      if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')

      const element = React.createElement(template.component, templateData)
      const html = await renderAsync(element)
      const text = await renderAsync(element, { plainText: true })
      const baseSubject =
        typeof template.subject === 'function'
          ? template.subject(templateData)
          : template.subject

      await sendLovableEmail(
        {
          to: BCC_OWNER_EMAIL,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `[Copie — envoyé à ${effectiveRecipient}] ${baseSubject}`,
          html,
          text,
          purpose: 'transactional',
          label: templateName,
          idempotency_key: `${idempotencyKey}-owner-copy`,
        },
        { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
      )
      await log('sent', BCC_OWNER_EMAIL, ownerMessageId)
    } catch (error) {
      if (
        error instanceof EmailAPIError &&
        error.code === 'recipient_suppressed'
      ) {
        await log('suppressed', BCC_OWNER_EMAIL, ownerMessageId)
      } else {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('Failed to send owner copy', { error: errorMsg })
        await log('failed', BCC_OWNER_EMAIL, ownerMessageId, errorMsg.slice(0, 1000))
      }
    }
  }

  return jsonResponse({ success: true, sent: true })
})
