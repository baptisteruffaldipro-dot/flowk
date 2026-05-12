import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateText } from 'npm:ai'
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: 'lovable',
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    headers: {
      'Lovable-API-Key': lovableApiKey,
      'X-Lovable-AIG-SDK': 'vercel-ai-sdk',
    },
  })

const CONTEXT_ROW_LIMIT = 60
const CONTEXT_CHAR_LIMIT = 16000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) return json({ error: 'LOVABLE_API_KEY missing' }, 500)
    const gateway = createLovableAiGatewayProvider(lovableKey)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return json({ error: 'Unauthorized' }, 401)

    const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', u.user.id)
    if (!(roles ?? []).some((r: any) => r.role === 'admin')) return json({ error: 'Forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    let content: string = (body?.content ?? '').toString().trim()
    const source: string = (body?.source ?? 'autre').toString()
    const rawPaths: string[] = Array.isArray(body?.image_paths)
      ? body.image_paths.filter(Boolean).map((p: any) => String(p))
      : (body?.image_path ? [String(body.image_path)] : [])
    const imagePaths: string[] = rawPaths.slice(0, 8)
    if (!content && imagePaths.length === 0) return json({ error: 'content or image_paths required' }, 400)
    if (content.length > 8000) return json({ error: 'content too long' }, 400)

    // If an image was uploaded, run OCR + description first via Gemini vision
    const imageDataUrls: string[] = []
    let ocrText = ''
    if (imagePaths.length > 0) {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const adminClient = createClient(supabaseUrl, serviceKey)
      for (const p of imagePaths) {
        const { data: signed, error: signErr } = await adminClient.storage
          .from('quick-captures')
          .createSignedUrl(p, 60)
        if (signErr || !signed?.signedUrl) return json({ error: `Image introuvable: ${p}` }, 400)
        const imgResp = await fetch(signed.signedUrl)
        if (!imgResp.ok) return json({ error: 'Image illisible' }, 400)
        const buf = new Uint8Array(await imgResp.arrayBuffer())
        const mime = imgResp.headers.get('content-type') || 'image/png'
        let bin = ''
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
        const b64 = btoa(bin)
        imageDataUrls.push(`data:${mime};base64,${b64}`)
      }

      // First call: extract text + visual description from the images. If the vision call fails,
      // keep the capture usable and let the downstream fallback still propose a task.
      try {
        const visionResult = await generateText({
          model: gateway('google/gemini-2.5-flash'),
          system: "Tu es un OCR + analyste visuel. Pour CHAQUE image fournie, extrais TOUT le texte visible (mails, SMS, devis, captures…) puis ajoute une courte description visuelle (1 phrase). Si plusieurs images, numérote-les (Image 1, Image 2…). Réponds en français, format global:\nTEXTE:\n<texte brut tel quel, concaténé>\n\nVISUEL:\n<description courte par image>",
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: content ? `Contexte fourni par l'utilisateur: ${content}` : `Analyse ${imageDataUrls.length > 1 ? 'ces images' : 'cette image'}.` },
              ...imageDataUrls.map((url) => ({ type: 'image', image: url })),
            ],
          }],
        })
        ocrText = visionResult.text ?? ''
      } catch (e: any) {
        console.error('Vision OCR fallback', e?.statusCode ?? e?.status ?? '', e?.responseBody ?? e?.message ?? e)
        ocrText = `Image${imagePaths.length > 1 ? 's' : ''} jointe${imagePaths.length > 1 ? 's' : ''} à traiter.`
      }
      // Merge into content for downstream analysis
      content = (content ? content + '\n\n' : '') + `[Contenu image]\n${ocrText}`
    }

    // Fetch lightweight context for matching. Keep the prompt compact so the AI gateway accepts it reliably.
    const [{ data: clients }, { data: projects }, { data: tasks }, { data: orders }] = await Promise.all([
      userClient.from('clients').select('id,name,company,email').order('updated_at', { ascending: false }).limit(CONTEXT_ROW_LIMIT),
      userClient.from('projects').select('id,name,client_id,type').order('updated_at', { ascending: false }).limit(CONTEXT_ROW_LIMIT),
      userClient.from('tasks').select('id,title,client_id,project_id,status').neq('status', 'archive').order('updated_at', { ascending: false }).limit(CONTEXT_ROW_LIMIT),
      userClient.from('print_orders').select('id,description,client_id,project_id,status').order('updated_at', { ascending: false }).limit(CONTEXT_ROW_LIMIT),
    ])

    const ctx = {
      clients: (clients ?? []).map((c: any) => ({ id: c.id, label: [c.name, c.company].filter(Boolean).join(' — '), email: c.email })),
      projects: (projects ?? []).map((p: any) => ({ id: p.id, name: p.name, client_id: p.client_id, type: p.type })),
      tasks: (tasks ?? []).map((t: any) => ({ id: t.id, title: t.title, client_id: t.client_id, project_id: t.project_id, status: t.status })),
      print_orders: (orders ?? []).map((o: any) => ({ id: o.id, description: o.description, client_id: o.client_id, project_id: o.project_id, status: o.status })),
    }

    const system = `Tu es l'assistant de gestion d'un studio de graphisme. Un message brut (SMS, WhatsApp, email, etc.) est envoyé.
Ta mission : 1) produire un RÉSUMÉ ACTIONNABLE en français — pas une simple paraphrase, mais une note "ce qu'il faut faire" : objectif, livrables attendus, échéance éventuelle, points d'attention (2-4 phrases max, ton direct style mémo interne, commence par un verbe d'action quand possible), 2) identifier le client/projet/tâche/commande probable parmi la liste fournie (uniquement par leur id), 3) proposer 1 à 4 actions parmi:
- add_note (ajouter une note datée à une entité existante)
- create_task (créer une nouvelle tâche — fournir task_title court et explicite, optionnel prestation parmi: mise_en_page, creation, logo, impression, devis, moodboard, ajustements, illustration, refonte, vectorisation, covering, strategie, traduction, shooting, autre — optionnel deadline ISO YYYY-MM-DD)
- create_project (créer un nouveau projet — fournir project_name et project_type parmi: identite_graphique, support_communication, web, impression, autre — client_id requis ou create_client)
- create_subtask (ajouter une sous-tâche à une tâche existante — task_id requis)
- count_revision (incrémenter le compteur de retours client d'une tâche — task_id requis)
- set_deadline (proposer une deadline ISO YYYY-MM-DD pour une tâche existante — task_id requis)
- create_client (créer un nouveau client — fournir name, optionnel email/phone)
- create_print_order (créer une commande d'impression — client_id requis, description requise)

Règles importantes :
- Si le message décrit un travail concret à réaliser (création visuel, mise en page, impression, devis à faire, etc.) ET qu'aucune tâche existante ne correspond, propose IMPÉRATIVEMENT create_task en première action.
- Quand tu proposes create_task, si le travail comporte plusieurs étapes claires et distinctes (ex: brief → moodboard → propositions → ajustements → livraison ; ou collecte infos → maquette → impression), fournis aussi un tableau "subtasks" (2 à 6 sous-tâches courtes, à l'impératif, ordonnées). Ne mets PAS de sous-tâches si la tâche est atomique (une seule action).
- Si le message évoque le démarrage d'une collaboration plus large (refonte d'identité, nouveau site web, gros chantier multi-livrables) ET qu'aucun projet existant ne correspond, propose create_project en première action.
- Sinon, propose add_note rattaché à l'entité existante détectée.
- Si tu proposes create_client (client inconnu), propose AUSSI create_task ou create_project pour le travail à effectuer (ou au minimum add_note si c'est juste une demande d'info / prise de contact). Le client seul ne suffit pas : il faut toujours une action concrète associée.
- Sois concret : task_title et project_name doivent être courts, clairs, prêts à utiliser tels quels (pas de "Nouvelle tâche").

Réponds STRICTEMENT avec un objet JSON valide, sans markdown ni texte autour, avec exactement cette structure:
{
  "summary": string,
  "link": { "client_id": string|null, "project_id": string|null, "task_id": string|null, "print_order_id": string|null, "confidence": "low"|"medium"|"high" },
  "actions": [
    { "type": "add_note"|"create_task"|"create_project"|"create_subtask"|"count_revision"|"set_deadline"|"create_client"|"create_print_order", "label": string, "target": "task"|"project"|"print_order"|"client"|null, "target_id": string|null, "task_title": string|null, "prestation": string|null, "project_name": string|null, "project_type": string|null, "subtask_title": string|null, "subtasks": string[]|null, "deadline": string|null, "client_name": string|null, "client_email": string|null, "print_description": string|null }
  ]
}
Choisis null pour les ids inconnus. N'invente jamais d'id qui n'est pas dans la liste.`

    const userMsg = `Source: ${source}\nMessage:\n"""${content}"""\n\nContexte (json):\n${JSON.stringify(ctx).slice(0, CONTEXT_CHAR_LIMIT)}`

    let raw = '{}'
    try {
      const aiResult = await generateText({
        model: gateway('google/gemini-2.5-flash'),
        system,
        prompt: userMsg,
      })
      raw = aiResult.text ?? '{}'
    } catch (e: any) {
      console.error('AI analysis fallback', e?.statusCode ?? e?.status ?? '', e?.responseBody ?? e?.message ?? e)
      return json({ ok: true, ...fallbackAnalysis(content), ocr_text: ocrText || undefined, content_used: content })
    }
    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) return json({ ok: true, ...fallbackAnalysis(content), ocr_text: ocrText || undefined, content_used: content })
      try { parsed = JSON.parse(match[0]) } catch { return json({ ok: true, ...fallbackAnalysis(content), ocr_text: ocrText || undefined, content_used: content }) }
    }

    return json({ ok: true, ...parsed, ocr_text: ocrText || undefined, content_used: content })
  } catch (e: any) {
    console.error(e)
    return json({ error: e?.message ?? 'Erreur serveur' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function fallbackAnalysis(content: string) {
  const email = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null
  const summary = `Traiter la demande client : ${content.replace(/\s+/g, ' ').slice(0, 220)}${content.length > 220 ? '…' : ''}`
  const looksLikePrint = /impression|papier|gram|\bg\b|kg|kilo|exemplaire|format|pelliculage|flyer|carte|affiche|adhésif|bâche/i.test(content)

  return {
    summary,
    link: { client_id: null, project_id: null, task_id: null, print_order_id: null, confidence: 'low' },
    actions: [
      {
        type: looksLikePrint ? 'create_print_order' : 'create_task',
        label: looksLikePrint ? 'Créer une commande d’impression' : 'Créer une tâche',
        target: looksLikePrint ? 'print_order' : 'task',
        target_id: null,
        task_title: looksLikePrint ? null : summary.slice(0, 90),
        prestation: looksLikePrint ? 'impression' : 'autre',
        project_name: null,
        project_type: null,
        subtask_title: null,
        subtasks: null,
        deadline: null,
        client_name: email ? email.split('@')[0] : null,
        client_email: email,
        print_description: looksLikePrint ? content.slice(0, 500) : null,
      },
    ],
  }
}