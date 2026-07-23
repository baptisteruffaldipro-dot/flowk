## Analyse de cohérence

### ✅ Ce qui est juste
- **Solde bancaire** 1 270,44 € au 31/07 : cohérent avec les imports Tiime.
- **Dette en cours** 2 884 € = 1 300 € (compte courant dirigeant) + 1 584 € (3 loyers Studio 130) ✓
- **Encours clients** 3 657 € ✓ (somme des 5 lignes)
- **Prochaine TVA** 718,83 € = TVA collectée − déductible sur juillet ✓

### ⚠️ Problèmes de calcul détectés

1. **CA encaissé estimé = 0,00 €** — bug bloquant.
   Le calcul filtre `paid_date IS NOT NULL` sur les 3 derniers mois. Or la majorité des ventes importées n'ont pas de `paid_date` renseigné → la moyenne tombe à 0. Il faut soit basculer sur `date` (date de facture), soit dériver le `paid_date` depuis les mouvements bancaires entrants.

2. **Solde estimé fin de mois −1 681,82 €** — faussé par le point 1 (CA = 0). Dès que le CA est correctement estimé, ce chiffre remonte.

3. **Argent réellement disponible 1 178,63 € — réserve TVA 0 %** — la réserve TVA est à 0 %, donc les 718,83 € dus le mois prochain ne sont pas provisionnés. La ligne dit "réellement disponible" mais ne l'est pas. Deux options : forcer une provision par défaut (ex. 100 % de la TVA du mois) ou renommer en "Solde net upcoming 30 j".

4. **Risque de double comptage loyer** — le loyer Studio 130 apparaît :
   - dans **Dettes fournisseurs** (1 584 € restant dû)
   - probablement aussi dans **Frais fixes** mensualisés (moyenne 6 mois)
   → le loyer est compté 2 fois dans "Solde requis" du mois prochain. À dédupliquer (marquer les financements `other` liés à un frais fixe existant, ou exclure la catégorie `frais_fixe` du calcul quand une dette fournisseur du même libellé existe).

5. **Dispo après remb. compte courant −1 705,37 €** — le libellé est trompeur : il retranche aussi les 1 584 € de dettes fournisseurs. À renommer en **"Dispo après remboursement total"** ou séparer en 2 KPI distincts.

6. **Alertes incomplètes** — aucune alerte sur les dettes fournisseurs en retard ni sur les loyers dus.

## Plan de correction

**Fichier : `src/pages/finance/FinanceDashboard.tsx`**

1. Corriger l'estimation du CA encaissé : utiliser `date` (fait générateur) plutôt que `paid_date`, et déduire un ratio d'encaissement moyen (ex. `caHT * (encaissé/facturé sur 3 mois)`).
2. Renommer "Dispo après remb. compte courant" → "Dispo après remboursement total (CC + fournisseurs)" et ajouter le détail dans le hint.
3. Ajouter une provision TVA par défaut : si `reserve_pct = 0`, afficher aussi une valeur "après provision TVA mois prochain".
4. Dédupliquer le loyer : quand un `finance_financings` de type `other` a le même libellé qu'une catégorie récurrente, exclure ce montant de `fixedMonthly` pour éviter le double comptage.
5. Ajouter alertes : "Loyer STUDIO 130 — 3 mois en retard" ; "Client X en retard depuis N jours".

## Idées d'amélioration à ajouter

**Priorité haute**
- **Graphique trésorerie prévisionnelle 90 jours** (courbe solde jour par jour intégrant : encaissements attendus par `expected_payment_date`, dépenses récurrentes, TVA, mensualités crédit, loyers).
- **DSO (Days Sales Outstanding)** : délai moyen d'encaissement client → aide à repérer les mauvais payeurs.
- **Comparaison N vs N-1** sur chaque KPI (CA mois, dépenses, résultat).

**Priorité moyenne**
- **Objectif CA mensuel** paramétrable avec barre de progression.
- **Scénario "et si"** : simulateur (si j'encaisse X d'ici Y, mon solde devient…).
- **Échéancier consolidé** : timeline des sorties d'argent des 60 prochains jours (TVA, URSSAF, loyer, crédit, fournisseurs).
- **Ratio marge** par client / par projet (croisement `finance_transactions` × `projects`).

**Confort**
- Export PDF/CSV du dashboard mensuel.
- Toggle "HT/TTC" global.
- Widget "Top 3 clients du mois" et "Top 3 postes de dépenses".

Je propose de traiter d'abord les 5 corrections de calcul, puis on choisit ensemble 2-3 améliorations à implémenter.
