## Le problème

Tiime n'a pas d'API publique. Notre edge function se connecte en simulant l'app web (Auth0 / `password-realm`). Comme ton compte Tiime a la **double authentification activée**, Auth0 refuse ce mode de connexion et renvoie `mfa_required` → 409.

Désactiver la MFA sur Tiime serait la solution la plus simple, mais c'est dangereux pour un compte qui contient ta compta. On garde la MFA.

## La solution : authentification par refresh_token

Auth0 (utilisé par Tiime) accepte un **refresh_token** long-lived (scope `offline_access`, déjà demandé par l'app web Tiime). Une fois que tu t'es connecté **une fois manuellement** sur apps.tiime.fr (avec MFA), un refresh_token est stocké dans le navigateur. On le récupère, on le colle dans Lovable Cloud, et l'edge function s'en sert ensuite pour obtenir un access_token frais à chaque appel — sans jamais redemander la MFA.

Le refresh_token rote à chaque utilisation. Donc on doit le **persister en base** (pas en secret), et le mettre à jour après chaque échange. S'il expire (typiquement après 30 jours d'inactivité), tu refais la capture une fois.

L'objectif reste : créer une **facture en brouillon** dans Tiime, ouvrir l'URL renvoyée, et finir la validation / l'envoi côté Tiime.

## Étapes

### 1. Stockage du refresh_token (base)

Nouvelle table `tiime_auth` (row unique, admin uniquement) :
- `refresh_token` text
- `access_token` text (cache court)
- `access_token_expires_at` timestamptz
- `updated_at`, `created_at`

RLS : lecture/écriture admin uniquement.

### 2. Page admin "Connexion Tiime"

Nouvelle page `/parametres/tiime` (lien dans la sidebar admin) avec :
- **État** : connecté ✅ / déconnecté ❌, dernière rotation du token
- **Bouton "Tester la connexion"** : appelle l'edge function en mode `verify`, qui tente un refresh + un `GET /companies`
- **Champ "Coller le refresh_token"** + bouton "Enregistrer"
- **Notice pas-à-pas** pour récupérer le token :
  1. Ouvrir https://apps.tiime.fr, se connecter (avec MFA)
  2. F12 → onglet *Application* → *Local Storage* → `https://apps.tiime.fr`
  3. Chercher la clé qui commence par `@@auth0spajs@@::iEbsbe3o66gcTBfGRa012kj1Rb6vjAND`
  4. Copier la valeur de `body.refresh_token`
  5. Coller dans le champ ci-dessus

### 3. Edge function refactorée

`supabase/functions/tiime-create-invoice/index.ts` :
- Lit `refresh_token` depuis `tiime_auth` (au lieu d'utiliser `password-realm`)
- Si `access_token` en cache encore valide (>5 min) → l'utilise
- Sinon → POST Auth0 `/oauth/token` avec `grant_type=refresh_token` + `client_id` + `refresh_token`
- Stocke le nouveau `access_token`, son expiration, et le **nouveau refresh_token rotaté** dans `tiime_auth`
- Continue avec la création de facture (statut `draft` — déjà le cas)
- Si Auth0 répond `invalid_grant` → erreur claire : "refresh_token expiré, refais la capture sur /parametres/tiime"

Nouvelle action `verify` (query param `?action=verify`) : tente juste le refresh + `/companies` et renvoie l'état, sans créer de facture. Utilisé par le bouton de test.

Les secrets `TIIME_EMAIL` / `TIIME_PASSWORD` ne sont plus utilisés (on peut les laisser ou les supprimer plus tard).

### 4. UX côté Kanban / facturation

Inchangé : le bouton "Terminer → Facturation (Tiime)" ouvre toujours `NewTiimeInvoiceDialog`, qui appelle la même edge function. Si la connexion Tiime n'est pas configurée, on affiche un toast "Connecte Tiime dans Paramètres" avec un lien direct.

## Section technique

**Fichiers à créer**
- Migration : `tiime_auth` table + RLS admin
- `src/pages/TiimeSettings.tsx` (page de connexion + statut + champ refresh_token)
- Route dans `App.tsx` : `/parametres/tiime`
- Lien dans la sidebar admin (sous "Paramètres")

**Fichiers à modifier**
- `supabase/functions/tiime-create-invoice/index.ts` :
  - Remplacer `tiimeLogin(email, password)` par `getAccessToken()` basé sur refresh_token de la DB
  - Ajouter rotation/persistance du refresh_token
  - Ajouter mode `verify`
- `src/components/NewTiimeInvoiceDialog.tsx` : si erreur `tiime_not_configured` → toast avec lien vers `/parametres/tiime`

**Aucun secret API key supplémentaire requis** — tout passe par la DB.

## Limites à connaître

- Si Tiime invalide le refresh_token (changement de mot de passe, déconnexion forcée), il faudra refaire la capture. Le bouton "Tester la connexion" t'aide à le détecter avant de créer une facture.
- Auth0 peut limiter la durée totale du refresh_token (absolute lifetime, souvent 30 jours sans usage). Une utilisation régulière le maintient en vie.
- On reste dépendants des endpoints non documentés de Tiime — si Tiime change son auth, il faudra adapter.

## Décision à prendre

Tu valides cette approche (refresh_token capturé manuellement, stocké en base, page admin pour le gérer) ? Si oui je l'implémente.
