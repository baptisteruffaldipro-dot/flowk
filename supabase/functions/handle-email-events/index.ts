import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Notification-only bookkeeping: Lovable enforces suppression at send time.
// These rows keep the project's own history tables up to date.
function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

type Reason = 'bounce' | 'complaint' | 'unsubscribe'
type LogStatus = 'bounced' | 'complained' | 'suppressed'

const REASON_MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function record(
  recipient: string,
  reason: Reason,
  status: LogStatus,
  eventId: string
) {
  const supabase = admin()
  const email = (recipient ?? '').toLowerCase()
  if (!email) return

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      error: { code: suppressError.code, message: suppressError.message },
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status,
    error_message: REASON_MESSAGE[reason],
    metadata: null,
  })
  if (logError) {
    console.error('Failed to insert email_send_log row', {
      event_id: eventId,
      error: { code: logError.code, message: logError.message },
    })
    throw new Error('Failed to write send log')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event.data.recipient, 'bounce', 'bounced', event.event_id)
    },
    'email.complaint': async (event) => {
      await record(event.data.recipient, 'complaint', 'complained', event.event_id)
    },
    'email.unsubscribed': async (event) => {
      await record(event.data.recipient, 'unsubscribe', 'suppressed', event.event_id)
    },
  },
})

Deno.serve((req) => handler(req))
