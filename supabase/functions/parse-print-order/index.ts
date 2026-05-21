import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableKey) return json({ error: 'LOVABLE_API_KEY missing' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return json({ error: 'Unauthorized' }, 401)

    const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', u.user.id)
    if (!(roles ?? []).some((r: any) => r.role === 'admin')) return json({ error: 'Forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const text: string = (body?.text ?? '').toString().trim()
    const images: string[] = Array.isArray(body?.images) ? body.images.filter((x: any) => typeof x === 'string').slice(0, 5) : []
    if (!text && images.length === 0) return json({ error: 'text or images required' }, 400)
    if (text.length > 12000) return json({ error: 'text too long' }, 400)

    const system = `Tu es un assistant OCR + extraction qui lit une commande d'impression depuis un texte brut (copié-collé d'un site d'imprimeur, devis, email, etc.) ou une capture d'écran.
Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour, avec EXACTEMENT ces clés :
{
  "reference": string|null,
  "observations": string|null,
  "amount": number|null,
  "products": [
    {
      "description": string|null,
      "quantity": number|null,
      "format": string|null,
      "grammage": string|null,
      "support": string|null,
      "colors": string|null,
      "finitions": string|null,
      "amount": number|null
    }
  ]
}

Règles :
- "products" : UN OBJET PAR LIGNE/PRODUIT distinct visible dans la commande. Si la capture montre 3 lignes (ex: flyers + cartes + affiches, ou microperforé + étiquettes), retourne 3 objets — JAMAIS un seul produit fusionné. Si un seul produit est visible, retourne un tableau d'un seul objet.
- Pour chaque produit :
  • "description" : libellé court et clair (ex: "Cartes de visite 85×55mm", "Flyer A5 recto-verso", "Microperforé 110×96cm").
  • "quantity" : nombre d'exemplaires de CETTE ligne uniquement (entier).
  • "format" : dimensions de CETTE ligne (ex: "A4", "85 × 55 mm").
  • "grammage" : grammage du papier (ex: "350 g/m²", "170 g").
  • "support" : type de papier/support (ex: "Couché brillant", "Polymère blanc").
  • "colors" : impression (ex: "Quadri R°/V°", "Pantone 485 C").
  • "finitions" : finitions/options (ex: "Pelliculage mat", "Coins carrés").
  • "amount" : montant HT/TTC de cette ligne en euros (positif, sans symbole). Null si seul un total global est visible.
- "reference" : numéro de commande / devis / référence interne de l'imprimeur si présent (commun à toute la commande).
- "observations" : remarques globales utiles non couvertes ailleurs (livraison, délais, conditions).
- "amount" : montant TOTAL de la commande en euros (positif). Si seulement les lignes ont un montant, additionne-les. Si seulement HT visible, prends le HT. Les montants négatifs (ex: -210,00) doivent être interprétés comme positifs.
- Réponds en français pour les valeurs textuelles.`

    const userContent: any[] = []
    if (text) userContent.push({ type: 'text', text: `Texte de la commande :\n${text}` })
    else userContent.push({ type: 'text', text: 'Lis tout le texte visible de cette capture puis extrait les informations de commande. Les montants négatifs affichés sur une ligne doivent être interprétés comme des montants positifs à additionner.' })
    for (const url of images) {
      userContent.push({ type: 'image_url', image_url: { url } })
    }

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: images.length > 0 ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (aiResp.status === 429) return json({ error: 'Trop de requêtes IA, réessayez bientôt.' }, 429)
    if (aiResp.status === 402) return json({ error: 'Crédits IA épuisés. Ajoutez-en dans Lovable.' }, 402)
    if (!aiResp.ok) {
      const t = await aiResp.text()
      console.error('AI error', aiResp.status, t)
      return json({ error: 'Analyse IA impossible' }, 500)
    }
    const aiData = await aiResp.json()
    const raw = aiData?.choices?.[0]?.message?.content ?? '{}'
    let parsed: Record<string, any> = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { parsed = {} }
      }
    }

    const str = (v: any) => (typeof v === 'string' && v.trim() ? v : null)
    const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null)
    const int = (v: any) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)

    const productsRaw = Array.isArray(parsed.products) ? parsed.products : []
    const products = productsRaw.map((p: any) => ({
      description: str(p?.description),
      quantity: int(p?.quantity),
      format: str(p?.format),
      grammage: str(p?.grammage),
      support: str(p?.support),
      colors: str(p?.colors),
      finitions: str(p?.finitions),
      amount: num(p?.amount),
    })).filter((p: any) => p.description || p.quantity || p.format || p.amount)

    // Backward-compatible main fields = first product (if any)
    const first = products[0] ?? {}
    const out = {
      description: first.description ?? str(parsed.description),
      reference: str(parsed.reference),
      quantity: first.quantity ?? int(parsed.quantity),
      format: first.format ?? str(parsed.format),
      grammage: first.grammage ?? str(parsed.grammage),
      support: first.support ?? str(parsed.support),
      colors: first.colors ?? str(parsed.colors),
      finitions: first.finitions ?? str(parsed.finitions),
      observations: str(parsed.observations),
      amount: num(parsed.amount) ?? (products.length ? products.reduce((s: number, p: any) => s + (p.amount ?? 0), 0) : null),
      products,
    }

    return json(out)
  } catch (e: any) {
    console.error(e)
    return json({ error: e?.message ?? 'Erreur' }, 500)
  }
})