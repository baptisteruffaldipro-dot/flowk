# Choisir les produits Realisaprint dans Flowk, puis commander une fois payé

## Le parcours
```text
Commande d'impression Flowk
  1. Choisir un produit Realisaprint  ->  options pré-remplies
  2. Compléter infos d'impression + tarifs (HT, TTC mis en avant)
  3. Client valide le BAT et règle  (comme aujourd'hui)
  4. Bouton « Lancer sur Realisaprint »  ->  vous passez la commande sur leur site
  5. Vous notez le n° Realisaprint  ->  commande marquée « commandée »
```

## 1. Liste des produits Realisaprint dans Flowk
- Nouvelle page **Produits Realisaprint** (menu Impression) : chaque produit avec ses options habituelles (support/grammage, format, recto-verso, finitions, couleurs) et le lien vers sa page sur Realisaprint.
- Pré-remplie avec les produits trouvés dans votre enregistrement : Carte de visite (350 g couché mat, 8,5 × 5,4 cm, pelliculage, vernis 3D, dorure…), Tapis de sol, Autocollant grand format, et les autres de vos 10 commandes.
- Vous pouvez ajouter, modifier ou masquer un produit, et y garder vos tarifs habituels par quantité (prix d'achat et prix de vente HT).

## 2. Dans une commande d'impression
- Bouton **« Produit Realisaprint »** à côté de « Ajouter un produit » : vous choisissez le produit, puis ses options dans des listes ; la ligne produit se remplit (description, format, support, grammage, finitions, couleurs).
- Vous saisissez quantité et prix (ou piochez un tarif enregistré) ; les totaux HT/TTC restent calculés comme aujourd'hui, TTC mis en avant. Plusieurs produits Realisaprint possibles dans une même commande.
- Rien ne change pour le client : il voit les mêmes infos, BAT et règlement qu'aujourd'hui.

## 3. Lancer la commande une fois payé
- Quand le règlement est reçu, un encadré **« À commander chez Realisaprint »** apparaît sur la commande (et la commande ressort dans un filtre « Payé, à commander »).
- Bouton **« Lancer sur Realisaprint »** : ouvre la page du produit sur leur site, avec à côté le récapitulatif à reproduire (options, quantité, adresse et date de livraison) et le fichier BAT validé à télécharger. Bouton « Copier le récapitulatif ».
- Avant paiement, le bouton reste disponible mais avec un avertissement « Pas encore réglé ».
- Après commande sur leur site, vous collez le n° Realisaprint : la commande passe en « En impression » et garde ce n° en référence. Le client ne voit l'étape que lorsque vous l'avez enregistrée.

## Ce qui n'est pas fait
- Flowk ne passe pas la commande à votre place et ne lit pas les prix en direct sur Realisaprint (pas d'accès officiel ; une erreur coûterait une vraie commande). Ça pourra venir plus tard si besoin.
- Aucun email au client, rien vers Tiime, Finance non touché.
- Pensez à vous déconnecter/reconnecter sur Realisaprint : l'enregistrement envoyé contient votre session.

## Détails techniques
- Table `realisaprint_products` (libellé, url, `options` jsonb `{groupe: [valeurs]}`, `price_tiers` jsonb au format `PriceTier` + coût HT, actif, ordre) : GRANTs + RLS admin dans la même migration ; seed des produits extraits du HAR via requête de données (pas dans la migration).
- `print_orders` : colonnes ajoutées `realisaprint_order_number text`, `supplier_ordered_at timestamptz` (nullable). Lignes de `products` jsonb enrichies de `realisaprint_product_id` et `options`.
- UI : page `RealisaprintProducts.tsx` (+ route/menu) réutilisant `PriceTiersEditor` ; `RealisaprintProductPicker` branché dans `PrintProductsEditor` / `NewPrintOrderDialog` / `PrintOrderDetail` ; carte `SupplierOrderCard` dans `PrintOrderDetail` (condition paiement via `payment_status` / état existant).
- `src/lib/realisaprint.ts` : construction du récapitulatif ; tests : options appliquées sur la ligne, encadré visible seulement si réglé, enregistrement du n° → statut `en_impression`.
- Types régénérés, règle ajoutée dans AGENTS.md.
