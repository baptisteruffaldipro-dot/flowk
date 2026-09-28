# Nettoyage + notifications + impressions

## 1. Notifications « point rouge »
- Un point rouge apparaît sur la carte de la tâche, du projet ou de la commande d'impression concernés quand le client écrit dans « Échanges », valide ou refuse un fichier, ou choisit des quantités.
- Le point disparaît quand j'ouvre la fiche.
- La cloche de notifications reste en place et mène directement à la bonne fiche.

## 2. Tableau de bord allégé
Retirer : Tâches à faire, BAT à valider, Chiffre d'affaires, Facturation, Impressions à commander, Projets en cours, Vacances.

## 3. Menu allégé
Retirer du menu : Inbox, Réseaux sociaux, BAT, Chiffre d'affaires, Facturation, Finance & pilotage, Bot Telegram.
Les données ne sont pas supprimées : les pages sont seulement masquées (réactivables plus tard). Le chiffrage reste dans les tâches pour informer le client des coûts.

## 4. Tâches
- Retirer le bloc « Pilotage financier » de la fiche tâche.
- Validation BAT par fichier : à gauche de « Visionner », un bouton « Valider BAT » sur chaque fichier (côté client), avec statut visible côté admin.
- Commande d'impression côté client : le client coche la quantité voulue dans la grille de tarifs ; je reçois une notification et la quantité/prix choisis s'affichent sur la commande.

## 5. Page Impressions
- Cases à cocher sur chaque commande + bouton « Supprimer la sélection » (avec confirmation).
- Les commandes non réglées remontent automatiquement en haut de la liste.

## Détails techniques
- Colonne `has_unread_client_activity` (ou table de lecture) sur tasks/projects/print_orders, mise à jour par les triggers de notification existants ; remise à zéro à l'ouverture de la fiche.
- Nouvelle action `choose_quantity` dans `portal_action_by_token` stockant `selected_tier` sur `print_orders` + notification admin.
- Validation BAT par fichier : réutilise `approve_file` / `deliverable_reviews`, bouton déplacé à gauche de Visionner.
- Menu : `AdminLayout.tsx` ; tableau de bord : `Dashboard.tsx` ; tri/suppression : `PrintOrders.tsx`.
