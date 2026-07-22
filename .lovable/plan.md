
# Module Finance & Pilotage

Nouveau menu `Finance` s'ajoutant à la sidebar existante, sans toucher aux modules déjà en place. Les données financières viennent d'imports Tiime (Excel/CSV), rapprochées automatiquement avec `clients`, `projects`, `tasks` et `invoices` déjà présents.

> Prérequis : upload d'un fichier d'export Tiime réel (anonymisé si besoin) avant de coder l'import — la détection auto et le mapping seront calibrés dessus. Sans échantillon, je pars sur un mapping générique et tu ajustes via l'UI.

## Architecture données

Une seule source pour la finance : les lignes importées. On garde `invoices`/`print_orders` intacts et on ajoute un lien optionnel vers les factures Tiime pour la fusion.

### Nouvelles tables (public, avec RLS admin)

- `tiime_imports` : trace chaque import (fichier, hash, date, nb lignes, statut, `rolled_back_at`). Permet retour arrière.
- `tiime_column_mappings` : sauvegarde le mapping colonnes → champs canoniques (mémorisé par type de fichier).
- `finance_transactions` : ligne unique factures vente / factures achat / mouvements. Champs : `import_id`, `kind` (sale/expense/bank), `doc_number`, `date`, `due_date`, `paid_date`, `label`, `counterparty` (fournisseur/client), `amount_ht`, `vat_amount`, `amount_ttc`, `vat_rate`, `account_code`, `category` (`prestation` | `achat_revente` | `expense` | `bank`), `client_id` (fk clients, nullable), `project_id`, `task_id`, `invoice_id`, `supplier_cost_ht`, `raw` (jsonb). Unicité `(kind, doc_number, date, amount_ttc)` pour éviter doublons.
- `finance_category_rules` : règles mots-clés (`pattern`, `field` libellé/compte, `category`, `priority`). Utilisées à l'import pour trancher Prestation vs Achat/Revente, éditables.
- `finance_link_rules` : associations mémorisées (`counterparty_normalized` → `client_id`, `keyword` → `project_id`/`task_id`).
- `bank_balances` : historique de solde (`as_of_date`, `amount`, `source` import/manuel). Alimenté par la colonne solde de l'export Tiime en priorité, saisie manuelle en fallback.
- `vat_adjustments` : ajustements manuels TVA + réserve TVA.
- `finance_forecasts` : simulations de dépenses futures.

### Fusion avec l'existant

À l'import d'une facture de vente Tiime : matching sur `invoices.number` (ou montant + date proche) ; si trouvé, on remplit `finance_transactions.invoice_id` et on marque `invoices.tiime_synced_at`. Pas de duplication de la facture — l'UI Facturation continue d'afficher les `invoices`, la Finance affiche les `finance_transactions`.

## Nouveau menu (sidebar)

Section `Finance` avec sous-items :
- Tableau de bord
- Import Tiime
- Trésorerie
- Chiffre d'affaires
- Dépenses
- TVA
- Prévisions
- Rentabilité
- Rapports

Style, composants (`Card`, `Table`, `PageHeader`, `NavLink`), couleurs et navigation identiques aux pages existantes.

## Pages

### Import Tiime (`/finance/import`)
- Drop de fichier `.xlsx`/`.csv`, parsing côté client (SheetJS) + edge function `tiime-import` pour normaliser et insérer par batch.
- Détection auto colonnes via heuristiques + mapping mémorisé. Si colonne inconnue → écran de mapping (select par colonne), sauvegardé dans `tiime_column_mappings`.
- Prévisualisation avant validation : nb factures vente, factures achat, mouvements bancaires, doublons détectés, lignes non catégorisées.
- Rapprochement automatique client/projet via `finance_link_rules`. Écran de résolution pour les lignes non appariées.
- Historique des imports + bouton "Annuler cet import" (soft-delete des `finance_transactions` liées).

### Tableau de bord (`/finance`)
Cartes : solde bancaire, dispo réel (solde − réserve TVA − paiements dus 30j), encaissements à venir, paiements à venir, TVA estimée, trésorerie prévisionnelle 30j, CA mois, CA année, dépenses mois, résultat estimé, alertes (retards paiement, TVA due, trésorerie tendue). Toggle Prestation / Achat-Revente sur les cartes CA/marge.

### Chiffre d'affaires (`/finance/ca`)
Deux blocs strictement séparés : **Prestations** et **Achats / Reventes**. Tableau + graphes mensuels. Pour Achat/Revente : marge brute, taux de marge (`marge / PV`), taux de marque (`marge / PA`).

### Dépenses (`/finance/depenses`)
Table avec filtres fournisseur / client / projet / tâche / catégorie / période. Édition de la catégorie + association projet/tâche mémorisée.

### TVA (`/finance/tva`)
Mensuel/trimestriel/annuel : TVA collectée, déductible, nette. Ajustements manuels. Réserve TVA (curseur %). Estimation TVA due affichée aussi sur le dashboard.

### Trésorerie (`/finance/tresorerie`)
Vue courbe (recharts) 30/60/90j/6 mois. Colonnes : solde, entrées, sorties, TVA future, dispo réel. Historique des soldes.

### Prévisions (`/finance/previsions`)
Simulateur : montant, date, catégorie, récurrence. Calcule impact tréso / TVA / résultat et affiche pastille 🟢 🟠 🔴 selon dispo réel projeté.

### Rentabilité (`/finance/rentabilite`)
Vues par client / projet / tâche. Pour chaque tâche : CA (via `finance_transactions` reliées ou `invoices` liées), dépenses affectées, coût interne (`total_minutes / 60 × hourly_rate` réutilisé depuis `computeTaskBilling`), marge, résultat. Rollup automatique tâche → projet → client.

### Rapports (`/finance/rapports`)
Graphiques modernes (recharts, tokens de couleur existants) : évolution CA, prestations vs achats/reventes, TVA, tréso, dépenses, marge, rentabilité, mensuel/annuel. Export CSV.

## Catégorisation Prestation vs Achat/Revente

Règles mots-clés éditables (`finance_category_rules`), appliquées à l'import sur libellé + compte. Chaque ligne garde `category_source` (rule/manual). Recatégorisation manuelle possible partout, et sauvegardée comme nouvelle règle proposée.

## Contraintes respectées

- Aucun module existant modifié (juste ajout d'items sidebar + éventuel `tiime_synced_at` sur `invoices`).
- Aucune 2ᵉ base : réutilise `clients`, `projects`, `tasks`, `invoices`.
- RLS admin uniquement sur toutes les nouvelles tables, GRANT `authenticated` + `service_role`.
- Architecture extensible : `finance_transactions.source` (`tiime_import` | futur `tiime_api` | `stripe` | `bank_api`) permet d'ajouter des connecteurs plus tard sans refactor.

## Étapes de livraison

1. Migration SQL : tables + RLS + GRANT + index sur `(date, category, client_id)`.
2. Ajout menu Finance dans `AdminLayout` + routes protégées admin dans `App.tsx`.
3. Page **Import Tiime** (parser SheetJS, écran de mapping, edge function `tiime-import`, historique + rollback).
4. Page **Tableau de bord** Finance.
5. Pages **CA**, **Dépenses**, **TVA**, **Trésorerie**.
6. Pages **Rentabilité**, **Prévisions**, **Rapports**.
7. Réglages : règles catégorisation, associations, réserve TVA.

Uploade un export Tiime pour caler l'étape 3 sur ton format réel — sans ça je pars sur un mapping générique modifiable via l'UI.
