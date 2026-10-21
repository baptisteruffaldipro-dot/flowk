# Création automatique de factures Tiime depuis Flowk (extension Chrome)

## Principe
Ton idée d'extension marche, et on peut la simplifier : pas besoin d'un serveur sur ton Mac. L'extension « Flowk ↔ Tiime » reste dans Chrome. Elle utilise ta session Tiime déjà ouverte pour créer la facture. Ta connexion Tiime ne sort jamais du navigateur : elle n'est ni envoyée à Flowk, ni enregistrée en ligne, ni lue par moi.

```text
Flowk (tâche)  --"Créer la facture Tiime"-->  extension Chrome
extension  --ta session Tiime ouverte-->  Tiime : facture en brouillon
extension  --n° de facture-->  Flowk (affiché sur la tâche)
```

## Ce que tu verras
1. Dans Flowk, une page « Extension Tiime » : bouton de téléchargement et installation en 4 étapes.
2. Dans la fiche tâche (facturation) et dans Impressions, un bouton « Créer la facture Tiime ». Il est grisé, avec une explication, si l'extension n'est pas installée ou si Tiime n'est pas ouvert.
3. Ce qui est envoyé : le client (nom, email, adresse), les lignes en HT (prestation, quantité choisie, prix unitaire HT), la TVA et la date.
4. La facture arrive en **brouillon** dans Tiime. Tu la relis et tu l'envoies toi-même.
5. La tâche affiche ensuite « Facture Tiime n° … ». Le bouton ne peut plus créer de doublon.

## À savoir
- Cette méthode passe par le fonctionnement interne du site Tiime, qui n'est pas officiel. Si Tiime change son site, il faudra mettre l'extension à jour. Solution de repli : l'intégration officielle Make.com.
- Ça ne fonctionne que sur ton Chrome, avec Tiime ouvert dans un onglet.
- Premier test sur un client fictif « Test » uniquement, en brouillon. Aucun vrai client.
- Le module Finance n'est pas modifié.

## Détails techniques
- `extension/` (Manifest V3) : `host_permissions` sur `apps.tiime.fr` et `chronos-api.tiime-apps.com`. Un `webRequest` lit l'en-tête Authorization et le garde dans `chrome.storage.session` (mémoire uniquement). Le service worker appelle les endpoints internes : clients, puis facture brouillon.
- `externally_connectable` limité aux domaines flowk.lovable.app et preview. Flowk utilise `chrome.runtime.sendMessage(extId, {type:"createInvoice", payload})` et l'extension répond `{id, number}`.
- Les endpoints de facturation de Tiime ne sont pas documentés. Première étape de construction : les identifier avec ta session pendant une création manuelle, puis les figer dans l'extension.
- Migration : colonnes `tiime_invoice_id`, `tiime_invoice_number`, `tiime_created_at` sur les tâches et commandes d'impression, sous les règles d'accès existantes.
- Tests : construction des lignes HT/TVA et blocage des doublons.
- ZIP servi depuis `public/` et téléchargé dans l'app via fetch+blob.
