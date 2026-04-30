import { createClient } from 'npm:@supabase/supabase-js@2'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Missing env vars' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }
  const update = body?.update
  const message = update?.message
  if (!message) return json({ ok: true, skipped: 'no message' })

  const chatId: number = message.chat.id
  const text: string = (message.text ?? '').toString().trim()
  if (!text) {
    await sendTelegram(chatId, "Je ne lis que les messages texte pour le moment.", LOVABLE_API_KEY, TELEGRAM_API_KEY)
    return json({ ok: true })
  }

  // 1. Vérifier que le chat_id est autorisé
  const { data: allowed } = await supabase
    .from('telegram_allowed_users')
    .select('user_id, label')
    .eq('chat_id', chatId)
    .maybeSingle()

  if (!allowed) {
    await sendTelegram(
      chatId,
      `🔒 Ce compte Telegram n'est pas autorisé.\n\nPour l'autoriser, ajoute ce chat_id dans Flowk : <code>${chatId}</code>`,
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true, unauthorized: true })
  }

  // Commande /reset pour repartir à zéro
  if (text === '/reset' || text === '/start') {
    await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
    await sendTelegram(
      chatId,
      text === '/start'
        ? `👋 Salut ! Envoie-moi une description de tâche, je la créerai dans Flowk.\n\nEx : "Refaire logo Dupont pour vendredi prio haute"`
        : "🔄 Conversation réinitialisée.",
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true })
  }

  // 2. Charger conversation en cours
  const { data: convo } = await supabase
    .from('telegram_conversations')
    .select('pending_payload, history')
    .eq('chat_id', chatId)
    .maybeSingle()

  const history: Array<{ role: string; content: string }> = Array.isArray(convo?.history) ? convo!.history : []
  history.push({ role: 'user', content: text })

  // 3. Charger contexte (clients, projets)
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from('clients').select('id,name,company').order('updated_at', { ascending: false }).limit(150),
    supabase.from('projects').select('id,name,client_id,type').eq('archived', false).order('updated_at', { ascending: false }).limit(150),
  ])

  const ctx = {
    clients: (clients ?? []).map((c: any) => ({ id: c.id, label: [c.name, c.company].filter(Boolean).join(' — ') })),
    projects: (projects ?? []).map((p: any) => ({ id: p.id, name: p.name, client_id: p.client_id, type: p.type })),
  }

  // 4. Appel IA
  const system = `Tu es un assistant qui CRÉE des tâches dans Flowk (studio graphique) via Telegram.

RÈGLE ABSOLUE : tu n'as PAS le droit de dire "tâche créée", "c'est fait", "ok je l'ajoute" sans avoir choisi action="create_task". Le message de confirmation n'est envoyé QUE si action="create_task". Sinon RIEN n'est créé en base.

Choisis UNE action :
1. action="create_task" → dès que tu as un TITRE clair. Tout le reste (client, projet, deadline, sous-tâches) est OPTIONNEL et peut être null. Crée la tâche immédiatement, ne demande pas de confirmation.
2. action="ask" → SEULEMENT si le titre lui-même est incompréhensible OU si le client mentionné correspond à plusieurs clients existants (ambiguïté réelle). Pose UNE question courte.
3. action="reply" → uniquement si le message n'a rien à voir avec une tâche (salutation, question sur le bot, etc.).

Champs tâche (obligatoires dans le JSON, mais peuvent être null) :
- title : string court et clair
- client_id : choisis dans la liste si match évident (même partiel), sinon null. NE redemande PAS si pas trouvé, mets null.
- project_id : idem
- prestation : mise_en_page|creation|logo|impression|devis|moodboard|ajustements|illustration|refonte|vectorisation|covering|strategie|traduction|shooting|autre (déduis du contexte, "logo" → logo, "refaire" → refonte, etc.)
- priority : principale|secondaire|urgente ("urgent"/"urgente"/"asap" → urgente)
- deadline : YYYY-MM-DD ou null. Aujourd'hui = ${new Date().toISOString().slice(0, 10)}. Calcule les dates relatives ("vendredi", "lundi prochain", "demain").
- subtasks : array de 2-5 strings si étapes évidentes, sinon null

Pour reply_message lors d'un create_task : sois bref ("OK, je crée."), la confirmation détaillée est ajoutée automatiquement après l'insertion.

N'invente JAMAIS d'id absent de la liste.`

  const userMsg = `Conversation:
${history.map((h) => `${h.role}: ${h.content}`).join('\n')}

Contexte (json):
${JSON.stringify(ctx).slice(0, 50000)}

Payload en cours (déjà rempli partiellement):
${JSON.stringify(convo?.pending_payload ?? {})}`

  const tool = {
    type: 'function',
    function: {
      name: 'telegram_action',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'reply_message'],
        properties: {
          action: { type: 'string', enum: ['create_task', 'ask', 'reply'] },
          reply_message: { type: 'string' },
          task: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['title', 'client_id', 'project_id', 'prestation', 'priority', 'deadline', 'subtasks'],
            properties: {
              title: { type: 'string' },
              client_id: { type: ['string', 'null'] },
              project_id: { type: ['string', 'null'] },
              prestation: { type: 'string' },
              priority: { type: 'string' },
              deadline: { type: ['string', 'null'] },
              subtasks: { type: ['array', 'null'], items: { type: 'string' } },
            },
          },
        },
      },
    },
  }

  const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      tools: [tool],
      tool_choice: { type: 'function', function: { name: 'telegram_action' } },
    }),
  })

  if (!aiResp.ok) {
    const t = await aiResp.text()
    console.error('AI error', aiResp.status, t)
    await sendTelegram(chatId, "❌ L'IA n'est pas dispo, réessaye dans un instant.", LOVABLE_API_KEY, TELEGRAM_API_KEY)
    return json({ error: 'AI failed' }, 500)
  }

  const aiData = await aiResp.json()
  const call = aiData?.choices?.[0]?.message?.tool_calls?.[0]
  let parsed: any = null
  try { parsed = JSON.parse(call?.function?.arguments ?? '{}') } catch {}
  console.log('AI parsed action:', parsed?.action, 'task:', JSON.stringify(parsed?.task))
  if (!parsed?.action) {
    await sendTelegram(chatId, "🤔 Je n'ai pas compris, peux-tu reformuler ?", LOVABLE_API_KEY, TELEGRAM_API_KEY)
    return json({ ok: true })
  }

  history.push({ role: 'assistant', content: parsed.reply_message })

  if (parsed.action === 'create_task' && parsed.task?.title) {
    const t = parsed.task
    const allowedPrest = ['mise_en_page','creation','logo','impression','devis','moodboard','ajustements','illustration','refonte','vectorisation','covering','strategie','traduction','shooting','autre']
    const allowedPrio = ['principale','secondaire','urgente']
    const insertPayload: any = {
      title: t.title,
      client_id: t.client_id || null,
      project_id: t.project_id || null,
      prestation: allowedPrest.includes(t.prestation) ? t.prestation : 'autre',
      priority: allowedPrio.includes(t.priority) ? t.priority : 'secondaire',
      deadline: t.deadline || null,
      status: 'a_faire',
    }
    const { data: newTask, error: insErr } = await supabase
      .from('tasks')
      .insert(insertPayload)
      .select('id')
      .single()
    if (insErr) {
      console.error('insert task error', insErr)
      await sendTelegram(chatId, `❌ Erreur création : ${insErr.message}`, LOVABLE_API_KEY, TELEGRAM_API_KEY)
      return json({ error: insErr.message }, 500)
    }
    if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
      const subRows = t.subtasks.map((title: string, i: number) => ({
        task_id: newTask.id,
        title,
        position: i,
      }))
      await supabase.from('subtasks').insert(subRows)
    }

    await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
    const url = `https://flowk.lovable.app/taches/${newTask.id}`
    await sendTelegram(
      chatId,
      `✅ <b>Tâche créée</b>\n\n📌 ${escapeHtml(t.title)}\n${t.deadline ? `📅 ${t.deadline}\n` : ''}${t.subtasks?.length ? `📋 ${t.subtasks.length} sous-tâches\n` : ''}\n<a href="${url}">Ouvrir dans Flowk</a>`,
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true, task_id: newTask.id })
  }

  // ask or reply : on garde le contexte
  await supabase.from('telegram_conversations').upsert({
    chat_id: chatId,
    pending_payload: parsed.task ?? null,
    history: history.slice(-10),
    updated_at: new Date().toISOString(),
  })
  await sendTelegram(chatId, parsed.reply_message, LOVABLE_API_KEY, TELEGRAM_API_KEY)
  return json({ ok: true, action: parsed.action })
})

async function sendTelegram(chatId: number, text: string, lovableKey: string, telegramKey: string) {
  try {
    await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
  } catch (e) {
    console.error('sendTelegram failed', e)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}