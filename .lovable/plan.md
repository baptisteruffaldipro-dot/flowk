# Création automatique de factures Tiime depuis Flowk (via Make.com)

## Principe
Make.com est l'intégration officielle de Tiime : elle sait créer des factures. Quand tu cliques dans Flowk, Flowk envoie la facture à un scénario Make. Make la crée dans Tiime, puis renvoie le numéro de facture à Flowk.

```text
Flowk (tâche / commande) -> "Créer la facture Tiime"
   -> scénario Make -> facture en brouillon dans Tiime
   -> Make renvoie le n° de facture -> affiché sur la tâche
```

## Ce que tu verras
1. Un bouton « Créer la facture Tiime » dans la fiche tâche (section facturation) et dans Impressions.
2. Ce qui est envoyé : le client (nom, email, adresse), les lignes en HT (prestation, quantité choisie, prix unitaire HT), la TVA et la date.
3. La facture arrive en **brouillon** dans Tiime. Tu la relis et tu l'envoies toi-même.
4. La tâche affiche ensuite « Facture Tiime n° … ». Le bouton ne peut plus créer de doublon.
5. En cas d'erreur, un message clair s'affiche, par exemple « Make n'a pas répondu ». Tu peux alors réessayer.

## Ce que tu feras une seule fois
- Créer un compte Make et y connecter Tiime.
- Créer le scénario en suivant mon guide pas à pas : réception depuis Flowk, puis « Tiime : créer une facture », puis renvoi du numéro à Flowk.
- Coller l'adresse du scénario dans un formulaire sécurisé que je t'enverrai.

## Hors périmètre
- Le module Finance n'est pas modifié.
- Premier test uniquement sur un client fictif « Test », en brouillon. Aucun vrai client.

## Détails techniques
- Function `tiime-create-invoice` : elle vérifie la session admin, construit le payload (lignes HT, TVA, quantité), puis fait un POST vers `MAKE_TIIME_WEBHOOK_URL`, avec l'en-tête `x-flowk-secret`.
- Function `tiime-invoice-callback` : Make y envoie `{task_id | print_order_id, tiime_invoice_id, number}`. La requête est vérifiée avec le même secret partagé (add_secret avec generate, collé aussi dans Make).
- Migration : colonnes `tiime_invoice_id`, `tiime_invoice_number`, `tiime_invoice_status`, `tiime_sent_at` sur les tâches et commandes d'impression, sous les règles d'accès existantes.
- Tests : construction du payload et blocage des doublons.
