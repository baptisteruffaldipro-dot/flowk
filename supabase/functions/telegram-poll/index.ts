import { createClient } from 'npm:@supabase/supabase-js@2'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram'
const MAX_RUNTIME_MS = 55_000
const MIN_REMAINING_MS = 5_000

Deno.serve(async () => {
  const startTime = Date.now()

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .maybeSingle()
  if (stateErr) return json({ error: stateErr.message }, 500)

  let currentOffset: number = state?.update_offset ?? 0
  let totalProcessed = 0

  while (true) {
    const elapsed = Date.now() - startTime
    const remainingMs = MAX_RUNTIME_MS - elapsed
    if (remainingMs < MIN_REMAINING_MS) break
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5)
    if (timeout < 1) break

    const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset: currentOffset, timeout, allowed_updates: ['message'] }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('getUpdates failed', response.status, data)
      return json({ error: data }, 502)
    }

    const updates = (data.result ?? []) as any[]
    if (updates.length === 0) continue

    for (const u of updates) {
      if (!u.message) continue
      // Process each message in the background
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/telegram-process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ update: u }),
        })
        totalProcessed++
      } catch (e) {
        console.error('telegram-process invoke failed', e)
      }
    }

    const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1
    const { error: offsetErr } = await supabase
      .from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (offsetErr) return json({ error: offsetErr.message }, 500)
    currentOffset = newOffset
  }

  return json({ ok: true, processed: totalProcessed, finalOffset: currentOffset })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}