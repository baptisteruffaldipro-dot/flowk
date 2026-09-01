# Pilotage financier multi-pôles (Graphisme, Platorama, Côté Souvenir, Royan Impression)

## Ce qui existe déjà et qu'on réutilise

Le module Finance actuel couvre déjà une bonne partie du besoin, mais sans notion de pôle :

- `finance_transactions` : la table centrale (ventes / dépenses / mouvements bancaires) avec date, échéance, date de paiement, HT / TVA / TTC, catégorie, fournisseur, coût fournisseur, et rattachement client / projet / tâche. C'est elle qui portera tout le réel.
- `finance_forecasts` : lignes prévisionnelles (montant, date prévue, récurrence) — base du prévisionnel et des dépenses récurrentes.
- `finance_financings` : crédits, apports, dettes fournisseurs.
- Clients, projets, tâches, `time_entries` (timer réel par tâche) et les règles de facturation (`src/lib/billing.ts`, `src/lib/budget.ts`) : source du temps passé et de la rentabilité Graphisme.
- Commandes d'impression (`print_orders`) avec montant vendu : source Royan Impression.
- Écrans existants : Tableau de bord, Import Tiime, Trésorerie, CA, Répartition presta/achat, Dépenses, TVA, Prévisions, Rentabilité, Rapports.

Conclusion : pas de nouveau module parallèle. On ajoute une **dimension « pôle »** au module Finance existant, plus les objets qui manquent réellement (pôles, objectifs, abonnements récurrents, règles de répartition des charges communes).

## Modèle de données à ajouter

1. **`business_units`** — les pôles (nom, code couleur, taux horaire interne, actif, ordre). Créés en seed : Graphisme, Platorama, Côté Souvenir, Royan Impression. Extensible.
2. **`business_unit_id`** ajouté sur `finance_transactions`, `finance_forecasts`, `projects`, `tasks`, `print_orders` (nullable = « global / commun »).
3. **`bu_allocation_rules`** — répartition des charges communes : soit clé en % par pôle, soit « laisser en global ». Une dépense sans pôle est soit ventilée par la règle active, soit conservée au niveau global selon un flag sur la ligne.
4. **`bu_goals`** — objectifs par pôle et par période (mois/trimestre/année) : CA, dépenses, résultat.
5. **`recurring_expenses`** — abonnements et charges récurrentes (libellé, pôle, montant HT, TVA, périodicité, date de début/fin, actif). Génère les échéances à venir dans le prévisionnel et propose la matérialisation en dépense réelle une fois payée.
6. **`subscriptions`** (Platorama et tout pôle à abonnement) — client, offre (Classic / Business / Premium / custom), frais de mise en service, montant mensuel, date de démarrage, statut, options (plats supplémentaires, chevalets QR). Alimente MRR/ARR et la facturation récurrente.
7. **`catalog_items`** — grille tarifaire par pôle (Platorama : Classic 450 + 49/mois, Business 850 + 69/mois, Premium devis + 99/mois, plat supplémentaire 30, chevalet QR 70 / 50 lancement ; Côté Souvenir : produits avec coût POD ; Royan : prestations avec coût fournisseur). Sert de saisie rapide, pas de contrainte.
8. **Coûts horaires internes par pôle et par nature** (table `bu_hourly_rates` : production, prospection, création graphique) — Platorama 25 €/h, prospection 20 €/h, création graphique 60 €/h ; Graphisme utilise les taux existants des tâches.

Chaque nouvelle table publique reçoit ses GRANT + RLS (accès admin authentifié), `created_at` / `updated_at` avec trigger, comme le reste du projet.

## Écrans

**Modifiés**
- `FinanceNav` : ajout d'un sélecteur global de pôle (Tous / Graphisme / Platorama / …) et d'un sélecteur de période (mois / trimestre / année / personnalisé) partagés par toutes les pages Finance via un contexte.
- `TransactionDialog` (dépense et revenu) : champ Pôle, nature (ponctuel / récurrent / investissement), payé ou non, coût fournisseur, rattachement client / projet / tâche. Une dépense récurrente peut créer sa règle en un clic.
- `FinanceDashboard` : bascule entre vue consolidée et vue pôle, comparaison des 4 pôles, objectifs vs réel.
- `FinanceProfitability` : agrégation supplémentaire par pôle, et intégration du coût du temps (minutes réelles × taux interne du pôle) dans la marge.
- `FinanceExpenses` / `FinanceCA` : filtre pôle + colonne pôle.

**Nouveaux**
- `/finance/poles` : liste des pôles avec CA encaissé / facturé, dépenses, marge brute, résultat, temps passé, coût du temps, rentabilité, objectifs.
- `/finance/poles/:code` : fiche pôle complète — KPI, tableau mensuel, graphiques CA / dépenses / résultat, encaissements et impayés, prévisionnel vs réel, blocs spécifiques :
  - Graphisme : rentabilité par projet/tâche à partir du timer et de la facturation.
  - Platorama : abonnements actifs, MRR / ARR, mises en service, options, renouvellements de carte, coûts récurrents, support consommé.
  - Royan Impression : commandes avec prix de vente, coût fournisseur, marge unitaire et cumulée.
  - Côté Souvenir : ventes produits, coût de production / POD, frais de plateforme et publicité, marge produit.
- `/finance/recurrents` : abonnements et charges récurrentes, échéancier, génération des lignes prévisionnelles.
- `/finance/objectifs` : saisie des objectifs CA / dépenses / résultat par pôle et période.

## Automatismes (sans doublon)

- Le réel vient **toujours** de `finance_transactions`. Les projets / tâches / commandes ne créent pas de ligne financière tant qu'ils ne sont pas facturés.
- À la facturation d'une tâche, d'un projet ou d'une commande d'impression, proposition (bouton, pas silencieux) de créer la vente correspondante avec pôle, client, projet et montants pré-remplis, avec `dedupe_key` pour éviter le doublon avec l'import Tiime.
- Le temps passé n'est jamais une écriture financière : il est valorisé à la volée (minutes × taux interne) et affiché comme coût analytique, séparé du résultat comptable.
- Le prévisionnel reste dans `finance_forecasts` / récurrents, jamais mélangé au réel ; les écrans affichent les deux côte à côte.
- Les charges communes sont ventilées au moment de l'affichage selon la règle active, pas dupliquées en base.

## Étapes de réalisation

1. Migration socle : `business_units` + seed des 4 pôles, `business_unit_id` sur les tables concernées, `bu_hourly_rates`, GRANT / RLS.
2. Contexte pôle + période dans le module Finance, filtres dans `FinanceNav`, champ pôle dans `TransactionDialog` et dans les listes Dépenses / CA.
3. Page `/finance/poles` et fiche pôle générique (KPI, tableau mensuel, graphiques, prévisionnel vs réel, coût du temps).
4. Récurrents et abonnements : `recurring_expenses`, `subscriptions`, `catalog_items`, écran `/finance/recurrents`, MRR / ARR.
5. Objectifs par pôle et comparaison objectif vs réel sur le dashboard consolidé.
6. Blocs métier spécifiques : Graphisme (rentabilité via timer), Royan (marge fournisseur), Côté Souvenir (marge produit), Platorama (abonnements, renouvellements, support).
7. Automatismes de reprise : bouton « Créer la vente » depuis tâche / projet / commande, rattachement rétroactif des transactions existantes à un pôle (écran d'affectation en masse).

## Risques identifiés

- Doublons avec l'import Tiime : traités par `dedupe_key` et création de vente explicite plutôt qu'automatique.
- Historique sans pôle : les anciennes transactions resteront en « global » tant qu'elles ne sont pas affectées ; l'écran d'affectation en masse (étape 7) permet de rattraper par client ou par fournisseur.
- Confusion coût du temps / résultat comptable : le coût du temps est toujours affiché comme indicateur analytique distinct.
