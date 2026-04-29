import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const user = userData.user
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', user.id)
    const isAdmin = (roles ?? []).some((r: any) => r.role === 'admin')
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)

    const body = await req.json()
    const clientId: string = body?.client_id
    if (!clientId) return json({ error: 'client_id required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: client, error: cErr } = await admin
      .from('clients')
      .select('id,email,name,portal_user_id')
      .eq('id', clientId)
      .maybeSingle()
    if (cErr || !client) return json({ error: 'Client introuvable' }, 404)
    if (!client.email) return json({ error: 'Email du client manquant' }, 400)
    if (client.portal_user_id) return json({ error: 'Client déjà invité' }, 400)

    const origin = req.headers.get('origin') ?? ''
    const redirectTo = `${origin}/portail`

    // Try invite first; if email already registered, fall back to magic link
    let userId: string | null = null
    const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(client.email, {
      redirectTo,
      data: { full_name: client.name },
    })
    if (invite?.user) {
      userId = invite.user.id
    } else if (inviteErr?.message?.toLowerCase().includes('already')) {
      // user exists, fetch by email via magic link generation
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: client.email,
        options: { redirectTo },
      })
      if (linkErr || !link?.user) return json({ error: linkErr?.message ?? 'Invitation impossible' }, 400)
      userId = link.user.id
    } else if (inviteErr) {
      return json({ error: inviteErr.message }, 400)
    }

    if (!userId) return json({ error: 'Création utilisateur impossible' }, 500)

    // Ensure client role
    await admin.from('user_roles').upsert({ user_id: userId, role: 'client' }, { onConflict: 'user_id,role' })

    // Link client row
    const { error: updErr } = await admin
      .from('clients')
      .update({ portal_user_id: userId })
      .eq('id', clientId)
    if (updErr) return json({ error: updErr.message }, 400)

    return json({ ok: true, user_id: userId })
  } catch (e: any) {
    return json({ error: e?.message ?? 'Erreur serveur' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}