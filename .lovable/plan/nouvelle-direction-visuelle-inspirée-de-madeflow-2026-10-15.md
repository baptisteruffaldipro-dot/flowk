# Nouvelle direction visuelle inspirée de Madeflow

## Ce qu'on reprend
- **Barre latérale noire** avec logo en haut, champ « Rechercher ou demander… ⌘K » (ouvre la capture rapide), gros bouton **jaune « + Nouveau »** (remplace le « + » près du timer, même menu de création).
- **Menu regroupé en rubriques repliables** avec sous-éléments en retrait :
  - Aujourd'hui : Accueil, Agenda, Demandes clients, Leads
  - Ventes : Clients, Tâches, Impressions
  - Création : Questionnaires, Stratégies de marque, Présentations logo, Idées / Notes
  - Pilotage : Finance, Rendez-vous
  - Réglages (en bas) : Paiement (RIB)
  - Profil en bas (pastille jaune + nom + déconnexion)
- **Fond gris très clair**, cartes blanches à coins arrondis, bordures fines, chiffres en gros, petits libellés gris.
- **Jaune comme couleur d'accent** (boutons principaux, onglet actif souligné, points d'état), noir pour les boutons secondaires forts.
- **Barre du haut** : titre de page avec fil d'Ariane (ex. « Ventes › Clients »), à droite timer, notifications.
- Police : Satoshi/« DM Sans »-like géométrique (proche de la capture), pas Inter.

## Tableau de bord « Aujourd'hui » (idées reprises)
1. Titre « Bonjour Baptiste » + « Jeudi 15 octobre · semaine 42 · X tâches aujourd'hui, Y en retard ».
2. **Bandeau de 4 chiffres** : Aujourd'hui · En attente du client (BAT envoyés non validés) · En retard · Impressions à commander.
3. **« À faire maintenant »** en tableau : Tâche · Client · **La balle est chez** (Moi / Client / Imprimeur) · Où en est-on (ex. « BAT client · en attente depuis 3 j ») · Action (Ouvrir / Renvoyer le lien). Filtres pastilles : Tout · Moi · Client · Imprimeur.
4. Colonne de droite :
   - **« Pour aller plus vite »** : 4 tuiles (Nouvelle tâche, Demande client, Commande d'impression, Note).
   - **Activité récente** : derniers événements clients (BAT signé, message, paiement).
   - **Petit récap rubriques** compact (Leads, RDV, Trésorerie, Dettes clients) en liste.

## Pages listes (Clients, Impressions, Tâches liste)
- En-tête avec 3 cartes chiffres (ex. Clients · Facturé HT · Reste dû TTC), puis barre recherche + filtres pastilles avec compteurs, tableau épuré en majuscules grises.
- Appliqué d'abord à Clients et Impressions ; le reste hérite automatiquement des nouvelles couleurs.

## Hors périmètre
- Pas de changement de fonctionnement ni de données ; l'assistant IA « Demandez à… » n'est pas inclus (possible plus tard).

## Détails techniques
- `index.css` : nouveaux tokens (background gris 96%, accent jaune ~ 45 100% 51%, sidebar noire), police via Google Fonts dans `index.html`, `tailwind.config.ts` fontFamily.
- `AdminLayout.tsx` : groupes repliables (Collapsible), recherche ⌘K, bouton Nouveau jaune réutilisant `QuickCreateMenu`, en-tête avec fil d'Ariane dérivé de la route ; menu mobile identique dans le Sheet.
- `Dashboard.tsx` réécrit : « balle chez » déduite du statut tâche/portail (BAT en attente → Client, impression à commander → Imprimeur, sinon Moi) ; activité via `client_portal_events`.
- `Clients.tsx`, `PrintOrders.tsx` : cartes KPI + filtres pastilles.
