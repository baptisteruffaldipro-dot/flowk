# Création automatique de factures Tiime depuis Flowk

## Constat
- Tiime ne fournit pas d'API publique : elle est réservée aux éditeurs partenaires, sur demande.
- La seule voie officielle sans partenariat est l'intégration Tiime sur Make.com, qui sait créer des factures.
- Il existe un connecteur non officiel qui utilise l'API interne de Tiime. Je l'écarte : il peut casser sans prévenir, et il faudrait stocker ton mot de passe Tiime.

## Fonctionnement proposé
```text
Flowk (tâche / commande)  ->  bouton "Créer la facture Tiime"
        -> envoi sécurisé vers un scénario Make
        -> Make crée la facture brouillon dans Tiime
        -> Make renvoie le n° de facture à Flowk  ->  affiché sur la tâche
```

## Ce que tu verras
1. Dans la fiche tâche (section facturation) et dans Impressions : un bouton « Créer la facture Tiime ».
2. Les éléments envoyés : client (nom, email, adresse), lignes HT (prestation, quantité choisie, prix unitaire HT), taux de TVA et date.
3. La facture arrive en **brouillon** dans Tiime. Tu la vérifies, puis tu l'envoies toi-même : rien ne part au client automatiquement.
4. Une fois la facture créée, la tâche affiche « Facture Tiime créée » avec son numéro. Le bouton ne peut plus créer de doublon.
5. Option, à confirmer plus tard : la facture se crée toute seule quand la tâche passe en « En facturation ».

## Ce que tu devras faire (une seule fois)
- Créer un compte Make et y connecter Tiime. Je te donne le modèle de scénario et les étapes, clic par clic.
- Coller dans Flowk l'adresse du scénario Make (je te la demanderai de façon sécurisée).

## Hors périmètre
- Le module Finance n'est pas modifié : il reste figé.
- Aucun test n'utilise un vrai client. Pour tester, on créera une facture sur un client fictif « Test ».

## Détails techniques
- Une function backend `tiime-create-invoice` envoie un payload JSON signé au webhook Make, stocké dans le secret `MAKE_TIIME_WEBHOOK_URL`, plus un secret partagé pour le retour.
- Une function `tiime-invoice-callback` reçoit l'ID et le numéro de facture, après vérification du secret.
- Migration : colonnes `tiime_invoice_id`, `tiime_invoice_number`, `tiime_invoice_status`, `tiime_sent_at` sur les tâches et commandes d'impression. Les règles d'accès (RLS) existantes s'appliquent.
- Tests : construction du payload (lignes HT, TVA, quantité choisie) et blocage des doublons.
- Plus tard, si Tiime accorde un accès API partenaire, le passage par Make pourra être remplacé par un appel direct, sans changer l'interface.
