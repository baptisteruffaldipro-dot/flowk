# Importer les commandes Realisaprint dans « Commandes d'impression »

## Ce que contient l'enregistrement
La page « Mes commandes » Realisaprint y est complète : **10 commandes** (28/08 au 22/10/2026), avec pour chacune le numéro (#1854195…), la date, l'état (En cours / Terminée…), le montant TTC et chaque ligne produit (libellé, support/grammage, format, recto/verso, finitions, quantité). On y trouve aussi l'étape de chaque ligne (En impression, En expédition, Livrée), la date de livraison prévue et le transporteur. Tout ça se range directement dans les champs actuels d'une commande d'impression.

Ce qui manque : le client final. Realisaprint ne sait pas pour quel client vous commandez, donc il faudra le choisir pour chaque commande.

## Ce que vous aurez
1. Sur la page Commandes d'impression, un bouton **« Importer depuis Realisaprint »**.
2. Vous déposez le fichier enregistré depuis la page « Mes commandes » (ou la page enregistrée en HTML).
3. Un aperçu affiche une ligne par commande : n°, date, produits, montant HT (le TTC est converti à 20 %, et les totaux HT/TTC restent affichés, TTC mis en avant), livraison prévue.
4. Pour chaque commande, vous choisissez le **client** (obligatoire) et, si vous voulez, la tâche ou le projet. Vous pouvez décocher celles à ignorer.
5. Les commandes déjà importées (même n° Realisaprint) sont repérées et grisées, pour éviter les doublons.
6. « Importer » crée les commandes avec : référence = n° Realisaprint, une ligne produit par article, montant HT, date et lieu de livraison prévus, transporteur dans les observations.

## Ce qui ne bouge pas
- Le statut de production, le BAT et le règlement ne sont **pas** déduits de Realisaprint : les nouvelles commandes partent dans l'état de départ, vous gardez la main (aucune étape inventée côté client).
- Rien n'est envoyé au client, rien n'est créé dans Tiime.
- Le fichier est lu dans votre navigateur et n'est **jamais conservé** : il contient votre connexion Realisaprint.

## Détails techniques
- `src/lib/realisaprintImport.ts` : extraction depuis HAR (entrée `dashboard/?page=orders`) ou HTML, via DOMParser ; découpe par commande (`date | #num | état | montant €`) puis par ligne (« Détails de la ligne », paires `clé : valeur`). Mapping : Support → support/grammage, Format/Hauteur/Largeur → format, Pelliculage/Vernis/Dorure/Coins/Face → finitions, Couleur d'impression → colors, Quantité → quantity, montant ligne inconnu (seul le total TTC est fourni) → total HT = TTC/1.2 sur la commande.
- Doublons : recherche des `print_orders.reference` existants.
- Insertion via le client existant (RLS admin) dans `print_orders`, `products` en JSON. Aucune migration.
- `src/components/RealisaprintImportDialog.tsx` + bouton dans `PrintOrders.tsx`.
- Test `realisaprintImport.test.ts` sur un extrait anonymisé : 10 commandes, n° 1854195 à 50,40 € TTC → 42,00 € HT, 3 lignes sur #1845908, livraison 03/11/2026.

## Conseil
Votre enregistrement contient vos cookies de connexion Realisaprint : déconnectez-vous puis reconnectez-vous sur leur site pour les invalider.
