# Plan — App de gestion projets graphiques

Une application web minimaliste (style Notion/Linear) pour gérer ton activité de graphiste de bout en bout, avec un portail dédié à tes clients.

## Authentification & rôles

- Connexion par email/mot de passe + Google.
- Deux rôles : **admin** (toi) et **client**.
- Tu invites un client par email depuis sa fiche → il reçoit un lien pour  accéder uniquement à ses projets sans mot de passe ou inscription.

## Espace admin (toi)

### 1. Dashboard principal

Trois vues côte à côte (cartes/colonnes) :

- **Tâches à faire** — regroupées par statut (À faire, Aujourd'hui, En attente).
- **Impressions en cours** — commandes avec statut actif (en attente BAT, en impression, expédiée).
- **Gestion budgétaire** — tâches "À facturer" + factures à envoyer, avec montants cumulés.
- Un bouton Nouveau + (Client, projet, client, impression,...)

Compteurs en haut : nb tâches du jour, CA en attente de facturation, BAT en attente de validation client.

### 2. Clients

- Liste + fiche client : coordonnées, projets liés, tâches, commandes impression, historique factures.
- Bouton "Inviter au portail" 

### 3. Projets

Rattachés à un client. Contiennent :

- Mini Brief / questionnaire (réponses du client) / Notes / indications clients / ...
- Type (identité graphique, support com, etc.) + supports liés.
- Tâches associées, fichiers, commandes impression.

### 4. Tâches

- Statuts : À faire / En attente / Aujourd'hui / Envoyé / À facturer / Archivé.
- Champs : client, projet, prestation (Mise en page, Création, Logo, Impression, Devis, Moodboard, Ajustements…), deadline, montant (taux horaire ou forfait), notes, sous-tâches (checklist), nb retours clients.
- **Timer intégré** : démarrer / mettre en pause / arrêter. À chaque démarrage ou reprise, une petite popup demande de **valider le temps estimé** ; à l'arrêt, comparaison estimé vs réel affichée pour ajuster la facturation.
- Vue liste filtrable + vue Kanban par statut.
- **Envoi automatique des fichiers finaux par email** au client possible

### 5. Commandes impression

- Client, projet, description, statut (BAT en attente, Validé, En impression, Expédié, Livré), montant prestation, temps passé global, fichiers.
- **Système de validation BAT** : tu uploades le BAT, le client le valide depuis son portail (avec annotations possibles).
- **Envoi automatique des fichiers finaux par email** au client une fois la commande marquée "prête".

### 6. Gestion budgétaire (suivi simple)

- Liste des prestations à facturer (issues des tâches "À facturer") avec montants.
- Statuts manuels : À facturer / Facturée / Payée.
- Pas de génération PDF — juste suivi et totaux (CA mois, en attente, payé).

## Portail client

Vue épurée, uniquement ses données :

- **Mes projets** : avancement, fichiers livrés à télécharger.
- **Brief / questionnaire** à remplir pour chaque nouveau projet.
- **BAT à valider** : visionneuse de documents (PDF/images) avec **annotations** (clics-commentaires sur le document) + bouton "Valider le BAT" ou "Demander modification".
- **Factures & devis** : liste consultable avec statut.
- Notifications email à chaque BAT à valider ou fichier livré.
- Upload fichiers vers graphiste, 
- Demande de prise de rdv ou contact

## Système de retours / annotations BAT

- Visionneuse intégrée affichant le document.
- Le client clique sur une zone → ajoute un commentaire épinglé.
- Tu vois les annotations dans ta fiche tâche/commande, tu réponds, le compteur "nb retours clients" s'incrémente.
- Validation finale en un clic = statut "BAT validé" + notification email pour toi.

## Style & UX

- Design minimaliste clair (blanc, typo soignée, beaucoup d'espace, accents discrets).
- Navigation sidebar gauche : Dashboard · Clients · Projets · Tâches · Impressions · Facturation.
- Responsive (utilisable depuis mobile pour consulter et démarrer un timer).

## Détails techniques

- React + Tailwind + shadcn/ui.
- **Lovable Cloud** pour l'auth, la base de données (clients, projets, tâches, commandes, time entries, annotations, factures), le stockage de fichiers (BAT, livrables) et l'envoi des emails (invitations portail, livraison fichiers, notifications BAT).
- Rôles stockés dans une table dédiée `user_roles` avec RLS pour cloisonner strictement chaque client à ses propres données.
- Timer persisté côté base (résiste au refresh / changement d'appareil).
- Visionneuse PDF via `react-pdf`, annotations stockées en base avec coordonnées x/y + page.

## Approche de livraison

Vu la taille, je propose de construire en 3 vagues après approbation :

1. **Fondations** : auth + rôles, schéma BDD, clients, projets, tâches avec timer, dashboard.
2. **Impressions & facturation** : commandes impression, suivi facturation, emails automatiques.
3. **Portail client & BAT** : accès client, brief, visionneuse + annotations, validation BAT.

Tu pourras tester chaque vague avant de passer à la suivante.

## Backlog (à intégrer dans les prochains lots)

- **Projets / Tâches** : afficher la **date de création** et la **date de livraison client** (deadline annoncée) sur les fiches et les listes.
- **Page Agenda des réalisations** : vue chronologique transversale liant tâches livrées + projets terminés (ligne du temps des livraisons passées et à venir).
- **Page onboarding client par projet** : page récap accessible au client depuis son portail, regroupant pour chaque projet :
  - montant estimé
  - nombre de retours / révisions inclus & utilisés
  - délais de livraison commande impression
  - date de livraison projet
  - deadline annoncée
  - BAT disponible (lien direct)
  - temps réel passé (timers cumulés)