
## Objectif

Un lien unique par tâche ou projet (partageable, sans compte) qui accompagne le client de bout en bout : brief → récap → validation → paiement → livraison. Les portails BAT et Demande client existants deviennent des vues intégrées dans ce portail unifié.

## Parcours client (une seule URL `/p/c/{token}`)

```text
Brief & récap → Validation devis → Paiement (RIB + lien) → Livraison verrouillée
    │              │                    │                        │
    │              signe engagement     tu confirmes manuel      téléchargement débloqué
    │                                                            après confirmation
    visionneuse BAT / aperçus (watermark, pas de DL)
```

Sections empilées sur la même page publique :

1. **En-tête** — nom du projet/tâche, statut, client, deadline estimée.
2. **Brief & infos** — description, notes visibles client, sous-tâches (checklist en lecture), prestation, deadline, plage de réalisation estimée.
3. **Estimation & budget** — temps estimé, forfait/horaire, montant HT, mention légale d'engagement.
4. **Validation devis** — bouton « Valider » / « Refuser » (avec motif). Statut verrouillé une fois validé.
5. **BAT & aperçus** — visionneuse intégrée (image/PDF via iframe + watermark CSS « APERÇU », `oncontextmenu` désactivé, URL signée courte 5 min). Bouton valider/annoter BAT si présent.
6. **Commande d'impression** — récap produits, quantités, prix, date livraison estimée si liée.
7. **Paiement** — s'affiche après validation :
   - Onglet **Virement** : IBAN/BIC/référence à copier
   - Onglet **Lien de paiement** : bouton « Demander un lien » → notif admin, tu colles ton lien externe (Stripe/PayPal/Tiime) qui s'affiche ensuite
   - Bouton client « J'ai payé » (déclaratif, informatif)
8. **Livrables** — cadenassés tant que tu n'as pas coché « Paiement reçu » côté admin. Ensuite téléchargement débloqué (fichiers `livrables` bucket, URL signée).
9. **Fil d'échanges** — messages client ↔ toi (comme demande client).

## Génération du lien

- À chaque `INSERT` dans `tasks` ou `projects` : trigger DB crée une ligne `client_portals` avec `share_token`, `is_published=false`.
- Bouton « Publier & copier le lien » sur la fiche admin.
- Bouton « Envoyer par email » (template `client-portal-link`) réutilisant `getPublicAppUrl()`.

## Côté admin

- Nouveau bloc **Portail client** sur les pages `/taches/:id` et `/projets/:id` :
  - Lien public + copier + prévisualiser + envoyer par email
  - Toggle « Publier »
  - Choix règle de déblocage : `libre` / `acompte` / `solde total` (réutilise `delivery_unlock_rule` existant)
  - RIB affiché au client (config globale dans nouveau `payment_settings` singleton : IBAN, BIC, titulaire, référence par défaut)
  - Champ « Lien de paiement externe » (collable quand client le demande)
  - Bouton **« Marquer paiement reçu »** → débloque livrables, notif client par email
  - Timeline des événements (vue, validé, paiement demandé, payé, téléchargé)
- Notifications (cloche existante) : validation, refus, demande de lien, confirmation « j'ai payé », téléchargement.

## Modèle de données

Nouvelle table `client_portals` :
- `entity_type` (`task` | `project`), `entity_id`, `client_id`
- `share_token` unique, `is_published`, `published_at`
- `status` : `draft`, `awaiting_validation`, `validated`, `refused`, `payment_pending`, `payment_link_requested`, `paid`, `delivered`
- `client_validated_at`, `client_refused_at`, `refusal_reason`
- `payment_method_requested` (`transfer` | `link`), `payment_link_url`, `client_declared_paid_at`, `admin_confirmed_paid_at`
- `delivery_unlock_rule`, `delivery_override`

Table `client_portal_messages` (comme `client_request_messages`).

Table `client_portal_events` (audit : vue, action, timestamp, ip).

Table `payment_settings` (singleton admin : IBAN, BIC, titulaire, notes virement).

Trigger `after insert on tasks/projects` → crée portail brouillon.

RPC `SECURITY DEFINER` publiques par token : `get_portal_by_token`, `portal_validate`, `portal_refuse`, `portal_request_payment_link`, `portal_declare_paid`, `portal_add_message`.

## Visionneuse protégée (niveau léger)

- PDF/image affichés via `<iframe>` ou `<img>` avec URL signée 5 min
- Overlay CSS filigrane « APERÇU — {nom client} — {date} » répété
- `onContextMenu`, `onDragStart` bloqués + `user-select: none`
- Pas de bouton téléchargement tant que non payé

## Livrables

Nouveau champ `deliverable_files` (jsonb : `[{path, name, size}]`) sur `tasks` et `projects`, upload dans bucket `livrables` existant. Téléchargement via URL signée uniquement si `client_portals.status = 'delivered'` (vérifié par fonction `can_download` étendue).

## Emails

Nouveaux templates app :
- `client-portal-ready` (envoi initial)
- `client-portal-validated` (confirmation au client)
- `client-portal-payment-link` (quand tu envoies le lien)
- `client-portal-delivered` (livrables débloqués)

## Portails existants

- BAT et Demande client restent techniquement mais deviennent des **vues embarquées** dans le portail unifié quand liés à la même tâche/projet.
- Ancienne route `/p/bat/{token}` conservée pour rétrocompat.

## Idées bonus (à valider avant implém, non incluses par défaut)

- **Signature en ligne** du devis (case à cocher + IP + timestamp = valeur légale suffisante pour freelance FR).
- **Relances auto** : email J+3, J+7, J+14 si paiement non confirmé.
- **CGV attachées** au moment de la validation (checkbox obligatoire).
- **Acompte 30% par défaut** avant démarrage, solde avant livraison — 2 phases de paiement dans le même portail.
- **Timeline visible client** avec jalons cochés (rassure sur l'avancement).
- **QR code** du lien pour envoi WhatsApp/SMS facile.
- **Verrou anti-modif** : une fois validé, le client voit clairement que toute nouvelle demande = avenant facturé.
- **Score « client fiable »** interne (délai moyen de paiement, litiges) pour prioriser tes prochains projets.

Dis-moi si tu veux inclure certains bonus (signature, relances, acompte 30/solde) directement dans la V1, ou si on garde la V1 minimale et on itère.

## Détails techniques

- Migration : `client_portals`, `client_portal_messages`, `client_portal_events`, `payment_settings`, colonne `deliverable_files` sur `tasks`/`projects`, trigger auto-create, RPC publiques, extension `can_download`.
- Pages : `src/pages/ClientPortalPublic.tsx` (nouvelle), bloc `PortalPanel` réutilisable dans `TaskDetail.tsx` / `ProjectDetail.tsx`, page `src/pages/PaymentSettings.tsx`.
- Edge functions : nouveau template `client-portal-ready` + variantes, réutilise `send-transactional-email`.
- Route : `/p/c/:token` (client), `/parametres/paiement` (admin RIB).
- Sécurité : toutes les mutations passent par RPC `SECURITY DEFINER` avec vérif du token ; téléchargement livrables via fonction serveur qui vérifie `admin_confirmed_paid_at`.
