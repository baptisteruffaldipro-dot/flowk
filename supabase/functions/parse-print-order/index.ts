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
 Tu DOIS répondre UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour, avec EXACTEMENT ces clés (toutes optionnelles, mets null si inconnu). Ne réponds jamais avec un tableau : si plusieurs lignes/produits sont visibles, regroupe-les dans une seule commande :
{
  "description": string|null,
  "reference": string|null,
  "quantity": number|null,
  "format": string|null,
  "grammage": string|null,
  "support": string|null,
  "colors": string|null,
  "finitions": string|null,
  "observations": string|null,
  "amount": number|null
}

Règles :
 - "description" : libellé court et clair du produit imprimé (ex: "Cartes de visite", "Flyer A5 recto-verso"). Si plusieurs lignes proches existent, synthétise (ex: "Enseigne vitres").
- "reference" : numéro de commande / devis / référence interne de l'imprimeur si présent.
 - "quantity" : nombre d'exemplaires/unités total visible (entier). Si plusieurs lignes affichent 7 unités et 4 unités, retourne 11.
 - "format" : dimensions (ex: "A4", "85 × 55 mm", "10 × 21 cm"). S'il y en a plusieurs, mets les dimensions principales séparées par des virgules ou null si trop nombreuses.
- "grammage" : grammage du papier (ex: "350 g/m²", "170 g").
- "support" : type de papier/support (ex: "Couché brillant", "Offset", "Carton").
- "colors" : impression couleur (ex: "Quadri recto-verso", "Pantone 485 C", "Noir recto").
- "finitions" : finitions/options (ex: "Pelliculage mat", "Vernis sélectif", "Coins arrondis").
 - "observations" : remarques utiles non couvertes ailleurs. Pour les captures avec plusieurs lignes, détaille les lignes, vues, dimensions et quantités ici.
 - "amount" : montant TTC en euros (nombre positif, sans symbole). Si seulement HT visible, prends le HT. Si plusieurs montants de ligne sont visibles et aucun total n'est affiché, additionne-les. Si les montants sont affichés négatifs (ex: -210,00), retourne leur valeur positive.
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

    const out = {
      description: typeof parsed.description === 'string' ? parsed.description : null,
      reference: typeof parsed.reference === 'string' ? parsed.reference : null,
      quantity: Number.isFinite(Number(parsed.quantity)) ? Math.round(Number(parsed.quantity)) : null,
      format: typeof parsed.format === 'string' ? parsed.format : null,
      grammage: typeof parsed.grammage === 'string' ? parsed.grammage : null,
      support: typeof parsed.support === 'string' ? parsed.support : null,
      colors: typeof parsed.colors === 'string' ? parsed.colors : null,
      finitions: typeof parsed.finitions === 'string' ? parsed.finitions : null,
      observations: typeof parsed.observations === 'string' ? parsed.observations : null,
      amount: Number.isFinite(Number(parsed.amount)) ? Number(parsed.amount) : null,
    }

    return json(out)
  } catch (e: any) {
    console.error(e)
    return json({ error: e?.message ?? 'Erreur' }, 500)
  }
})