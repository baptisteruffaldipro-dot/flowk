
# Livraison conditionnée par BAT + paiement

Objectif : un client ne peut télécharger un livrable que si **(a) le BAT est validé** quand applicable, et **(b) l'acompte ou le solde est encaissé** — sauf si tu actives un override manuel.

## 1. Modèle de données

Ajouts minimes, le reste réutilise `invoices` + `invoice_installments` qui existent déjà.

**`tasks`** (livraison de fichiers / logos)
- `delivery_unlock_rule` enum `acompte | total | libre` — défaut `acompte`
- `delivery_override` bool — bypass paiement
- `invoice_url` text (lien Tiime) — en plus du PDF déjà uploadable dans `deliverables`

**`print_orders`** (impressions)
- mêmes 3 colonnes (`delivery_unlock_rule`, `delivery_override`, `invoice_url`)
- on garde `bat_validated_at` comme verrou supplémentaire : pas de livrable tant que BAT non validé.

**`logo_presentations`**
- `deliverables` jsonb (liste de fichiers téléchargeables — sources, vectoriels)
- `delivery_unlock_rule`, `delivery_override`, `invoice_url`
- la **présentation** reste libre (token public) ; seul le **pack final** est gated.

**`invoices`** : on s'appuie sur `invoice_installments.paid_amount` vs `amount` pour savoir ce qui est payé. Pas besoin de nouveau champ.

**Fonction SQL `public.can_download(entity_type, entity_id)`** (security definer) qui renvoie un booléen :
1. si `delivery_override` → true
2. si `entity_type='print_order'` et `bat_validated_at IS NULL` → false
3. selon `delivery_unlock_rule` :
   - `libre` → true
   - `acompte` → true si au moins une `invoice_installments` liée est payée (paid_amount ≥ amount)
   - `total` → true si somme(paid_amount) ≥ somme(amount) sur toutes les échéances liées
4. sinon false.

Cette fonction est appelée côté client avant de générer un signed URL via Storage.

## 2. UI admin (toi)

**Sur une tâche / commande / présentation logo :**
- Sélecteur **Règle de déblocage** : Acompte / Total / Libre
- Bloc **Facture** :
  - Bouton « Joindre PDF » (upload dans bucket `livrables`)
  - Champ « Lien Tiime » (URL externe)
  - Les deux peuvent coexister
- Liste des **échéances** (déjà gérée par `InstallmentsManager`) : checkbox « Encaissé » → set `paid_amount = amount`, `paid_at = today`
- Toggle **« Autoriser le téléchargement maintenant »** (override)
- Badge d'état : 🔒 Verrouillé / ⏳ BAT en attente / 💰 Acompte requis / ✅ Disponible

**Notification automatique** quand l'état passe à ✅ : email "Vos fichiers sont disponibles" (template `files-delivered` existe déjà).

## 3. UI portail client

Sur `ClientPortal` / `ClientProjectPortal` / `ClientPrintOrderPortal` / page logo :
- Carte **Livraison** qui montre toujours :
  - le **récapitulatif financier** (forfait/horaire, montant, ce qui est dû, ce qui est payé)
  - la/les **factures** (lien Tiime ou PDF téléchargeable)
  - l'état du **BAT** (impressions uniquement)
  - l'état du **paiement** (acompte ✅ / solde ⏳)
- Bouton **Télécharger** :
  - actif → signed URL généré
  - inactif → tooltip explicite (« BAT à valider », « Acompte à régler », etc.)

## 4. Intégration Tiime (v2 — pas dans cette plan)

On prévoit la place : champ `invoice_url` + un futur edge function `sync-tiime` qui mettra à jour `paid_amount` automatiquement via l'API Tiime. Pour l'instant tu coches manuellement.

## 5. Découpage d'implémentation

1. **Migration DB** : nouvelles colonnes + fonction `can_download` + RLS qui interdit aux clients de modifier ces champs.
2. **Helper TS partagé** `useDeliveryState(entity)` qui calcule l'état (verrouillé / disponible / raison) côté admin **et** côté client (mêmes règles).
3. **UI admin** : composant `DeliveryGate` réutilisable injecté dans `TaskDetail`, `PrintOrderDetail`, `LogoPresentationEditor`.
4. **UI client** : composant `ClientDeliveryCard` réutilisable injecté dans les 3 portails.
5. **Email auto** : trigger côté UI admin quand l'état devient « disponible » → envoi `files-delivered`.
6. **Tiime** : juste le champ texte pour l'instant.

## Détails techniques

- Les fichiers livrables restent dans le bucket privé `livrables` ; on ne change pas le RLS du bucket. Le téléchargement passe par `supabase.storage.createSignedUrl` côté client uniquement si `can_download()` renvoie true (vérifié par un appel RPC juste avant).
- Pour les logos, on ajoute un bucket privé `logo-deliverables` (le bucket actuel `logo-presentations` est public et sert à l'affichage de la présentation, pas au pack final).
- L'override est tracé : on log `delivery_override_at` + `delivery_override_by` pour audit.
