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
        ? `👋 Salut ! Je peux créer dans Flowk :\n\n• 📌 <b>Tâche</b> — "refaire logo Dupont pour vendredi"\n• 👤 <b>Client</b> — "nouveau client Dupont, dupont@mail.fr, 0612..."\n• 📁 <b>Projet</b> — "nouveau projet identité Medusor"\n• 📅 <b>Rendez-vous</b> — "RDV avec Martin demain 14h en visio"\n• 🖨️ <b>Commande impression</b> — "impression 500 flyers A5 pour Dupont"\n\nÉcris naturellement, ou force avec <code>/client</code>, <code>/projet</code>, <code>/tache</code>, <code>/rdv</code>, <code>/impression</code>.`
        : "🔄 Conversation réinitialisée.",
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true })
  }

  // Détecter une commande slash explicite pour forcer le type
  let forcedType: string | null = null
  let cleanText = text
  const slashMatch = text.match(/^\/(client|projet|tache|tâche|rdv|impression)\b\s*(.*)$/i)
  if (slashMatch) {
    const cmd = slashMatch[1].toLowerCase().replace('â', 'a')
    forcedType = cmd === 'tâche' ? 'tache' : cmd
    cleanText = slashMatch[2].trim() || '(pas de détails)'
  }

  // 2. Charger conversation en cours
  const { data: convo } = await supabase
    .from('telegram_conversations')
    .select('pending_payload, history')
    .eq('chat_id', chatId)
    .maybeSingle()

  const history: Array<{ role: string; content: string }> = Array.isArray(convo?.history) ? convo!.history : []
  history.push({ role: 'user', content: forcedType ? `[FORCE_TYPE=${forcedType}] ${cleanText}` : text })

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
  const system = `Tu es un assistant qui CRÉE des entités dans Flowk (studio graphique) via Telegram.

RÈGLE ABSOLUE : tu n'as PAS le droit de dire "créé", "c'est fait", "ok je l'ajoute" sans avoir choisi une action create_*. Le message de confirmation n'est envoyé QUE si action commence par "create_". Sinon RIEN n'est créé en base.

Si le message commence par [FORCE_TYPE=xxx], tu DOIS créer cette entité (pas de "reply", pas de doute sur le type). Tu peux poser une question si une info essentielle manque.

Actions disponibles :
1. create_task — créer une tâche (work à faire)
2. create_client — créer un nouveau client (personne ou entreprise)
3. create_project — créer un projet (regroupement de tâches pour un client)
4. create_appointment — créer un rendez-vous (date/heure obligatoire)
5. create_print_order — créer une commande d'impression
6. ask — poser UNE question courte si une info essentielle manque
7. reply — uniquement si le message n'a rien à voir avec une création (salutation, question sur le bot)

Détection automatique du type (sauf si FORCE_TYPE) :
- "RDV", "rendez-vous", "réunion avec", "call avec", "meeting" → create_appointment
- "nouveau client", "ajouter client", "créer client" → create_client
- "nouveau projet", "projet pour", "créer projet" → create_project
- "impression", "imprimer", "flyers", "cartes de visite", "affiches X exemplaires" → create_print_order
- "tâche", "à faire", "refaire", "créer logo", verbe d'action sans contexte spécial → create_task

CHAMPS PAR TYPE (tous obligatoires dans le JSON, mais la plupart peuvent être null) :

task : { title, client_id, project_id, prestation, priority, deadline, subtasks }
- prestation : mise_en_page|creation|logo|impression|devis|moodboard|ajustements|illustration|refonte|vectorisation|covering|strategie|traduction|shooting|autre
- priority : principale|secondaire|urgente
- deadline : YYYY-MM-DD ou null
- subtasks : array 2-5 strings ou null

client : { name, company, email, phone, address, notes }
- name est OBLIGATOIRE. Si manque, action="ask".
- Les autres peuvent être null.

project : { name, client_id, type, description }
- type : identite_graphique|support_communication|web|impression|autre
- name et client_id OBLIGATOIRES. Si client absent ou ambigu → ask.

appointment : { title, client_id, project_id, type, start_at, duration_minutes, location, notes }
- type : visio|presentiel|telephone|autre
- start_at : ISO complet "YYYY-MM-DDTHH:MM:00+02:00" (timezone Paris). OBLIGATOIRE avec heure précise. Si pas d'heure → ask.
- duration_minutes : 60 par défaut
- title OBLIGATOIRE (déduis-le, ex: "RDV Martin")

print_order : { description, client_id, project_id, quantity, format, support, colors, finitions, observations, amount }
- description OBLIGATOIRE (ex: "500 flyers A5 quadri")
- client_id : si client mentionné inconnu → null (création possible quand même)
- quantity, format, support, colors, finitions : déduis si possible, sinon null

Règle commune :
- N'invente JAMAIS d'id absent de la liste fournie.
- Si client mentionné inconnu : mets client_id=null et continue (sauf project où c'est obligatoire → ask).
- Aujourd'hui = ${new Date().toISOString().slice(0, 10)}. Calcule dates relatives ("demain", "vendredi", "lundi prochain").
- Pour reply_message lors d'un create_* : sois bref ("OK, je crée."), la confirmation détaillée est ajoutée automatiquement.
- Pose UNE seule question à la fois.`

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
          action: { type: 'string', enum: ['create_task', 'create_client', 'create_project', 'create_appointment', 'create_print_order', 'ask', 'reply'] },
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
          client: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['name', 'company', 'email', 'phone', 'address', 'notes'],
            properties: {
              name: { type: 'string' },
              company: { type: ['string', 'null'] },
              email: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              address: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
            },
          },
          project: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['name', 'client_id', 'type', 'description'],
            properties: {
              name: { type: 'string' },
              client_id: { type: ['string', 'null'] },
              type: { type: 'string' },
              description: { type: ['string', 'null'] },
            },
          },
          appointment: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['title', 'client_id', 'project_id', 'type', 'start_at', 'duration_minutes', 'location', 'notes'],
            properties: {
              title: { type: 'string' },
              client_id: { type: ['string', 'null'] },
              project_id: { type: ['string', 'null'] },
              type: { type: 'string' },
              start_at: { type: 'string' },
              duration_minutes: { type: ['integer', 'null'] },
              location: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
            },
          },
          print_order: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['description', 'client_id', 'project_id', 'quantity', 'format', 'support', 'colors', 'finitions', 'observations', 'amount'],
            properties: {
              description: { type: 'string' },
              client_id: { type: ['string', 'null'] },
              project_id: { type: ['string', 'null'] },
              quantity: { type: ['integer', 'null'] },
              format: { type: ['string', 'null'] },
              support: { type: ['string', 'null'] },
              colors: { type: ['string', 'null'] },
              finitions: { type: ['string', 'null'] },
              observations: { type: ['string', 'null'] },
              amount: { type: ['number', 'null'] },
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
  console.log('AI parsed action:', parsed?.action, 'payload:', JSON.stringify(parsed))
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

  if (parsed.action === 'create_client' && parsed.client?.name) {
    const c = parsed.client
    const { data: newClient, error: insErr } = await supabase
      .from('clients')
      .insert({
        name: c.name,
        company: c.company || null,
        email: c.email || null,
        phone: c.phone || null,
        address: c.address || null,
        notes: c.notes || null,
      })
      .select('id')
      .single()
    if (insErr) {
      await sendTelegram(chatId, `❌ Erreur création client : ${insErr.message}`, LOVABLE_API_KEY, TELEGRAM_API_KEY)
      return json({ error: insErr.message }, 500)
    }
    await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
    const url = `https://flowk.lovable.app/clients/${newClient.id}`
    await sendTelegram(
      chatId,
      `✅ <b>Client créé</b>\n\n👤 ${escapeHtml(c.name)}${c.company ? ` — ${escapeHtml(c.company)}` : ''}\n${c.email ? `📧 ${escapeHtml(c.email)}\n` : ''}${c.phone ? `📞 ${escapeHtml(c.phone)}\n` : ''}\n<a href="${url}">Ouvrir dans Flowk</a>`,
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true, client_id: newClient.id })
  }

  if (parsed.action === 'create_project' && parsed.project?.name && parsed.project?.client_id) {
    const p = parsed.project
    const allowedTypes = ['identite_graphique','support_communication','web','impression','autre']
    const { data: newProject, error: insErr } = await supabase
      .from('projects')
      .insert({
        name: p.name,
        client_id: p.client_id,
        type: allowedTypes.includes(p.type) ? p.type : 'autre',
        description: p.description || null,
      })
      .select('id')
      .single()
    if (insErr) {
      await sendTelegram(chatId, `❌ Erreur création projet : ${insErr.message}`, LOVABLE_API_KEY, TELEGRAM_API_KEY)
      return json({ error: insErr.message }, 500)
    }
    await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
    const url = `https://flowk.lovable.app/projets/${newProject.id}`
    await sendTelegram(
      chatId,
      `✅ <b>Projet créé</b>\n\n📁 ${escapeHtml(p.name)}\n\n<a href="${url}">Ouvrir dans Flowk</a>`,
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true, project_id: newProject.id })
  }

  if (parsed.action === 'create_appointment' && parsed.appointment?.title && parsed.appointment?.start_at) {
    const a = parsed.appointment
    const allowedTypes = ['visio','presentiel','telephone','autre']
    const { data: newApt, error: insErr } = await supabase
      .from('appointments')
      .insert({
        title: a.title,
        client_id: a.client_id || null,
        project_id: a.project_id || null,
        type: allowedTypes.includes(a.type) ? a.type : 'presentiel',
        start_at: a.start_at,
        duration_minutes: a.duration_minutes || 60,
        location: a.location || null,
        notes: a.notes || null,
        status: 'planifie',
      })
      .select('id, start_at')
      .single()
    if (insErr) {
      await sendTelegram(chatId, `❌ Erreur création RDV : ${insErr.message}`, LOVABLE_API_KEY, TELEGRAM_API_KEY)
      return json({ error: insErr.message }, 500)
    }
    await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
    const url = `https://flowk.lovable.app/rendez-vous`
    const when = new Date(newApt.start_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' })
    await sendTelegram(
      chatId,
      `✅ <b>Rendez-vous créé</b>\n\n📅 ${escapeHtml(a.title)}\n🕐 ${escapeHtml(when)} (${a.duration_minutes || 60} min)\n${a.location ? `📍 ${escapeHtml(a.location)}\n` : ''}\n<a href="${url}">Ouvrir dans Flowk</a>`,
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true, appointment_id: newApt.id })
  }

  if (parsed.action === 'create_print_order' && parsed.print_order?.description) {
    const o = parsed.print_order
    const { data: newOrder, error: insErr } = await supabase
      .from('print_orders')
      .insert({
        description: o.description,
        client_id: o.client_id || null,
        project_id: o.project_id || null,
        quantity: o.quantity || null,
        format: o.format || null,
        support: o.support || null,
        colors: o.colors || null,
        finitions: o.finitions || null,
        observations: o.observations || null,
        amount: o.amount || null,
        status: 'bat_en_attente',
      })
      .select('id')
      .single()
    if (insErr) {
      await sendTelegram(chatId, `❌ Erreur création commande : ${insErr.message}`, LOVABLE_API_KEY, TELEGRAM_API_KEY)
      return json({ error: insErr.message }, 500)
    }
    await supabase.from('telegram_conversations').delete().eq('chat_id', chatId)
    const url = `https://flowk.lovable.app/impressions/${newOrder.id}`
    await sendTelegram(
      chatId,
      `✅ <b>Commande d'impression créée</b>\n\n🖨️ ${escapeHtml(o.description)}\n${o.quantity ? `📦 ${o.quantity} ex.\n` : ''}${o.format ? `📐 ${escapeHtml(o.format)}\n` : ''}\n<a href="${url}">Ouvrir dans Flowk</a>`,
      LOVABLE_API_KEY,
      TELEGRAM_API_KEY,
    )
    return json({ ok: true, order_id: newOrder.id })
  }

  // ask or reply : on garde le contexte
  await supabase.from('telegram_conversations').upsert({
    chat_id: chatId,
    pending_payload: parsed.task ?? parsed.client ?? parsed.project ?? parsed.appointment ?? parsed.print_order ?? null,
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