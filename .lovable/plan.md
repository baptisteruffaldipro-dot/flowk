## 1. Lien de paiement par carte saisissable (admin)

Dans `src/components/PortalPanel.tsx`, le champ « Lien de paiement » est aujourd'hui affiché uniquement si `portal.payment_method_requested === "link"` — c'est-à-dire seulement après que le client ait demandé un lien. C'est pourquoi tu ne peux pas le renseigner.

Changement : afficher le champ dès que la méthode « Carte bancaire (lien) » est cochée dans `payment_methods` (indépendamment de toute demande du client), avec le bouton Enregistrer inchangé et un petit message d'aide « Visible par le client dans le bloc Paiement ».

## 2. Ordre des blocs dans le portail client public

Dans `src/pages/ClientPortalPublic.tsx`, réorganiser les sections dans cet ordre :

```text
1. Récapitulatif de la prestation
2. Commande d'impression liée
3. Livrables — visionneuse PDF + validation / observations
4. Échanges (messages)
5. Validation globale (si applicable)
6. Règlement (montant dû, mention impression, facture) + Paiement (RIB / lien CB / déclaration)
7. Devis & factures
```

Détails :
- Le bloc « Règlement » (montant, mention impression, télécharger la facture) et le bloc « Paiement » (virement, lien carte, « j'ai payé ») sont déplacés en fin de page et regroupés l'un au-dessus de l'autre.
- Le bloc « Refus affiché » reste juste après la validation.
- Aucun changement de logique : mêmes conditions d'affichage, mêmes actions, mêmes verrous de téléchargement.

## Technique
- Deux fichiers touchés : `src/components/PortalPanel.tsx` (condition d'affichage du champ lien) et `src/pages/ClientPortalPublic.tsx` (déplacement de blocs JSX). Pas de migration base de données.
