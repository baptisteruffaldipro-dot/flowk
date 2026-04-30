import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '@supabase/supabase-js/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Find appointments that need a reminder NOW
  // reminder_minutes_before is set, reminder_sent_at is null,
  // and start_at - reminder_minutes_before <= now < start_at
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, title, start_at, duration_minutes, type, location, notes, reminder_minutes_before, client_id, clients(name, email)')
    .is('reminder_sent_at', null)
    .not('reminder_minutes_before', 'is', null)
    .neq('status', 'annule')
    .neq('status', 'termine')

  if (error) {
    console.error('Query error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const now = Date.now()
  const toProcess = (appointments ?? []).filter((a: any) => {
    const startMs = new Date(a.start_at).getTime()
    const reminderMs = startMs - (a.reminder_minutes_before * 60 * 1000)
    return reminderMs <= now && now < startMs
  })

  let sent = 0

  for (const apt of toProcess) {
    const startDate = new Date(apt.start_at)
    const timeStr = startDate.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    const clientName = (apt as any).clients?.name ?? 'Sans client'

    // --- TELEGRAM REMINDER ---
    if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
      try {
        // Get all allowed telegram users to send reminder
        const { data: tgUsers } = await supabase.from('telegram_allowed_users').select('chat_id')
        for (const tgUser of (tgUsers ?? [])) {
          const text = `📅 *Rappel RDV*\n\n*${apt.title}*\n🕐 ${timeStr}\n👤 ${clientName}${apt.location ? `\n📍 ${apt.location}` : ''}${apt.notes ? `\n📝 ${apt.notes}` : ''}`
          await fetch(`${GATEWAY_URL}/sendMessage`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'X-Connection-Api-Key': TELEGRAM_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chat_id: tgUser.chat_id, text, parse_mode: 'Markdown' }),
          })
        }
      } catch (e) {
        console.error('Telegram reminder failed:', e)
      }
    }

    // --- EMAIL REMINDER ---
    const clientEmail = (apt as any).clients?.email
    if (clientEmail) {
      try {
        const html = `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #333;">Rappel de rendez-vous</h2>
            <p>Bonjour ${clientName},</p>
            <p>Ceci est un rappel pour votre rendez-vous :</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>${apt.title}</strong></p>
              <p style="margin: 4px 0;">🕐 ${timeStr}</p>
              ${apt.location ? `<p style="margin: 4px 0;">📍 ${apt.location}</p>` : ''}
            </div>
            <p>À bientôt !</p>
          </div>
        `
        // Use the transactional email function
        await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            to: clientEmail,
            subject: `Rappel : ${apt.title} - ${timeStr}`,
            html,
            purpose: 'transactional',
            idempotency_key: `reminder-${apt.id}`,
          }),
        })
      } catch (e) {
        console.error('Email reminder failed:', e)
      }
    }

    // Mark as sent
    await supabase.from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', apt.id)
    sent++
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})