## Contexte

Diagnostic effectué :
- Domaine `notify.atelier-rufo.fr` ✅ vérifié
- Dernière invitation portail à `pierrealexandre@leothemis.fr` → statut **`sent`** sans erreur. Le système marche, le mail est probablement en spam ou filtré.
- La création d'un onboarding **n'envoie actuellement aucun email**.

## Ce qu'on va ajouter

### 1. Email automatique à la création/envoi d'un onboarding
- Nouveau template transactionnel `onboarding-ready.tsx` (branding identique au mail d'invitation portail).
- Sujet : « Votre espace onboarding est prêt »
- Contenu : nom du client, lien direct vers son portail (`/portail`) ou page dédiée onboarding, message court invitant à compléter les infos.
- Déclencheur : dans `ClientOnboarding.tsx` (mode admin), à la création de l'onboarding (ou via un bouton « Envoyer au client » à côté), on appelle `send-transactional-email` avec `templateName: "onboarding-ready"` et `recipientEmail: client.email`.
- Garde-fous : ne s'envoie que si le client a un email ; idempotency key = `onboarding-ready-<client_id>` pour éviter les doublons.
- Toast UI confirmant l'envoi.

### 2. Bouton « Renvoyer l'invitation portail »
- Dans `ClientDetail.tsx`, quand `portal_user_id` existe (donc déjà invité), afficher en plus du badge « Portail activé » un bouton secondaire **« Renvoyer l'invitation »**.
- Modifier la fonction edge `invite-client` : accepter un flag `resend: true` qui, au lieu de bloquer si déjà invité, génère un nouveau magic link via `admin.auth.admin.generateLink({ type: 'magiclink' })` et déclenche l'envoi (le hook `auth-email-hook` existant rend le template `invite.tsx`).
- Toast UI « Invitation renvoyée ».

### 3. Préalable email transactionnel
- L'infrastructure `send-transactional-email` est déjà déployée (templates `bat-ready` et `files-delivered` existent).
- Il suffit d'ajouter le nouveau template dans `_shared/transactional-email-templates/onboarding-ready.tsx` et de le référencer dans `registry.ts`, puis redéployer `send-transactional-email`.

## Détails techniques

**Fichiers créés**
- `supabase/functions/_shared/transactional-email-templates/onboarding-ready.tsx`

**Fichiers modifiés**
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (enregistrer template)
- `supabase/functions/invite-client/index.ts` (support `resend`)
- `src/components/ClientOnboarding.tsx` (envoi à la création, mode admin)
- `src/pages/ClientDetail.tsx` (bouton « Renvoyer l'invitation »)

**Déploiements**
- `send-transactional-email`, `invite-client`

## Vérification après implémentation

Je relancerai un envoi de test et vérifierai dans `email_send_log` que le statut passe à `sent`. Pour la non-réception du mail précédent, je te recommande de vérifier le dossier spam/promotions de `pierrealexandre@leothemis.fr` — le système a bien envoyé, c'est très probablement un filtre côté destinataire.