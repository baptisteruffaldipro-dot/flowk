# Simplifier le pilotage financier

Objectif : passer de 13 onglets à 5 écrans clairs, avec un seul endroit pour labelliser les transactions issues des exports Tiime.

## Nouvelle navigation

```text
Tableau de bord | Transactions | Pôles | TVA & Trésorerie | Import Tiime
```

Les anciens écrans (Chiffre d'affaires, Répartition presta/achat, Dépenses, Récurrents, Prévisions, Objectifs, Rentabilité, Rapports) ne disparaissent pas : leur contenu est regroupé dans les 5 écrans ci-dessus, et leurs URLs redirigent vers le bon onglet pour ne rien casser.

## 1. Tableau de bord (vue globale)

Une seule barre de filtre en haut : période (mois / trimestre / année / perso) + pôle (Tous, ou un pôle).

Blocs, dans cet ordre :
- Chiffre d'affaires HT de la période, avec la répartition **prestation / achat-revente** (montant, % et mini-graphe).
- Dépenses HT de la période, dont **frais fixes du mois** (récurrents détectés + charges marquées « frais fixe »).
- Résultat et marge.
- Trésorerie : solde actuel, encaissements et décaissements à venir sur 30 jours.
- TVA : TVA collectée − déductible sur la période, et montant estimé à payer le mois prochain (au global, un seul compte).
- Comparatif des pôles : une ligne par pôle (CA, presta/achat, dépenses, frais fixes, résultat) + graphe mensuel empilé.

Quand un pôle est sélectionné dans le filtre, tous les blocs se recalculent sur ce pôle (sauf la TVA, qui reste globale et est indiquée comme telle).

## 2. Transactions (le cœur de la labellisation)

Une seule table pour tout : ventes, achats, mouvements bancaires.

- Filtres rapides : période, pôle, type (vente / dépense / banque), nature (prestation, achat-revente, frais fixe, autre), « à labelliser ».
- Recherche libre (fournisseur, client, libellé).
- Labellisation en ligne, sans ouvrir de fenêtre : menu pôle + menu nature directement dans la ligne, sauvegarde immédiate.
- Sélection multiple : appliquer un pôle ou une nature à plusieurs lignes d'un coup.
- Ventilation multi-pôles conservée pour les dépenses partagées (bouton sur la ligne).
- Bandeau « X transactions non labellisées » en haut, cliquable pour ne voir qu'elles.
- Règles automatiques : quand tu labellises un fournisseur, proposition de mémoriser la règle pour les prochains imports.

## 3. Pôles

Liste des pôles avec leurs chiffres clés, et une fiche par pôle regroupant : CA (presta/achat), dépenses, frais fixes mensuels, marge, temps passé et coût du temps, objectifs et prévisionnel. C'est l'écran actuel, allégé et aligné sur les mêmes filtres.

## 4. TVA & Trésorerie

Fusion des deux écrans existants, puisqu'ils répondent à la même question « combien je dois sortir et quand » :
- TVA collectée / déductible / à payer par mois, échéance du mois prochain, au global.
- Solde bancaire, projection 90 jours, dettes clients et dettes fournisseurs.

## 5. Import Tiime

Inchangé sur le fond (dédoublonnage par clé), mais après import : redirection directe vers Transactions filtrée sur « à labelliser », avec application automatique des règles fournisseurs mémorisées.

## Détails techniques

- Aucun changement de schéma nécessaire côté données : on réutilise `finance_transactions` (`business_unit_id`, `category`, `dedupe_key`), `finance_tx_splits`, `recurring_expenses`, `finance_category_rules`, `business_units`, `bank_balances`.
- Nouveaux écrans : `FinanceTransactions.tsx` (table unifiée + labellisation en ligne + actions groupées) et fusion `FinanceVAT` + `FinanceTreasury`.
- `FinanceNav.tsx` réduit à 5 entrées ; `App.tsx` garde les anciennes routes en redirections (`/finance/ca`, `/finance/split`, `/finance/depenses`, `/finance/recurrents` → `/finance/transactions`, etc.).
- Les calculs restent dans `src/lib/finance/units.ts` (agrégation par pôle, ventilations) — pas de recalcul dupliqué dans les pages.
- Les frais fixes s'appuient sur la catégorie `frais_fixe` et sur `recurring_expenses`, agrégés par pôle.
- Les pages actuelles Prévisions / Objectifs / Rentabilité / Rapports deviennent des sections repliées dans Pôles et Tableau de bord plutôt que des onglets séparés.

## Étapes

1. Nouvelle navigation à 5 onglets + redirections des anciennes routes.
2. Écran Transactions unifié avec labellisation en ligne et actions groupées.
3. Refonte du Tableau de bord (global + par pôle, presta/achat, frais fixes, TVA, trésorerie, comparatif pôles).
4. Fusion TVA & Trésorerie.
5. Import Tiime : règles automatiques + redirection vers « à labelliser ».
6. Allègement de l'écran Pôles (objectifs, prévisions, rentabilité intégrés).
