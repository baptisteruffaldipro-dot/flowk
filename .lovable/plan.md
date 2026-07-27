## Objectif

Enrichir le lien client partagé (`/p/c/:token`, page publique + panneau admin de la tâche/projet) avec : conditions de paiement explicites, facture téléchargeable, visionneuse PDF des livrables avec validation/refus, et affichage d'une commande d'impression liée.

## 1. Paiement — CB, RIB et solde dû

Côté admin (`PortalPanel.tsx`), nouveau bloc « Conditions de paiement » :
- Choix des moyens proposés : **lien carte bleue** (URL à coller) et/ou **RIB** (affiche le RIB déjà saisi dans Réglages paiement) — cases à cocher indépendantes.
- **Modalité** : `Acompte 50 %` / `Totalité avant livraison` / `Libre`.
- **Montant TTC dû** (pré-rempli depuis le montant de la tâche/projet, modifiable).

Côté client (`ClientPortalPublic.tsx`) : encart « Règlement » affichant le montant à régler (ex. « Acompte de 50 % — 120,00 € TTC à régler ») avec, selon la configuration, le bouton **Payer par carte** et/ou le bloc RIB copiable. Le lien carte est aussi visible dès la validation (pas seulement après).

## 2. Mention impression + facture

- Si une commande d'impression est liée (voir §4), affichage automatique de l'encadré :
  « Pour toute commande d’impression, merci de régler la facture afin de lancer la production. »
- **Facture téléchargeable** : la page publique expose la facture existante (lien externe `invoice_url` **ou** PDF uploadé `invoice_file_path`). Le PDF uploadé sera servi via une URL signée courte durée générée côté serveur ; la facture reste téléchargeable même avant paiement.

## 3. Visionneuse PDF + validation / refus des livrables

- Nouvelle section « Documents à valider » sur la page publique : chaque livrable PDF s'affiche dans une **visionneuse intégrée** (iframe, barre d'outils masquée, pas de bouton de téléchargement).
- Sous chaque document : **Valider** / **Demander une modification** (zone d'observation obligatoire en cas de refus).
- Chaque action crée un message dans le fil d'échanges, met à jour le statut du portail et **envoie un email de notification** (fonction e-mail transactionnelle existante) + notification in-app.
- **Téléchargement uniquement après paiement confirmé** : avant paiement, seule la prévisualisation est possible ; les URLs de téléchargement ne sont plus renvoyées au navigateur tant que la livraison est verrouillée.

## 4. Commande d'impression liée

- Dans `PortalPanel.tsx` : sélecteur « Commande d'impression liée » (liste des commandes du client).
- Sur la page publique : carte récapitulative de la commande (description, quantité, format, support, finitions, délai estimé, montant, statut BAT/production), avec lien vers le BAT s'il est publié.

## Détails techniques

- Migration : ajout sur `client_portals` de `payment_methods` (text[]), `payment_terms` (`deposit_50` | `full` | `libre`), `amount_due_ttc` (numeric), `print_order_id` (uuid, FK `print_orders`), et sur les livrables un état de validation (`deliverable_reviews` jsonb : nom du fichier, statut, observation, date).
- `get_client_portal_by_token` : renvoie en plus la commande d'impression liée (pour tâche **et** projet), la facture (URL ou indicateur de PDF), les nouveaux champs de paiement et les revues de livrables.
- `portal_deliverables_by_token` : renvoie une **URL de prévisualisation** courte durée quand c'est verrouillé, et une URL de téléchargement seulement quand c'est déverrouillé.
- `portal_action_by_token` : nouvelles actions `approve_file` et `request_changes` (avec observation).
- Nouvelle fonction edge `portal-file-url` (publique, validée par token) pour générer les URLs signées de facture / prévisualisation depuis le bucket `livrables`.
- RLS/GRANT : aucune table exposée directement, tout passe par les fonctions `SECURITY DEFINER` existantes.
