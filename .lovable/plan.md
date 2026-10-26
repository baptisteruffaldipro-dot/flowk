# Pont Realisaprint dans Flowk

Trois briques, livrées dans cet ordre. Realisaprint n'a pas d'accès officiel pour les applications : Flowk se connecte à votre compte comme vous le feriez, avec vos identifiants rangés de façon sécurisée. Si Realisaprint change son site, la récupération peut s'arrêter et il faudra l'ajuster.

## 1. Récupération automatique des commandes
- Vous enregistrez une fois votre email et mot de passe Realisaprint (formulaire sécurisé, jamais visibles ensuite).
- Chaque jour (et via un bouton « Synchroniser maintenant »), Flowk lit votre page « Mes commandes » : n°, date, état, montant, chaque ligne produit avec ses options, date de livraison prévue, transporteur.
- Les nouvelles commandes arrivent dans une liste **« À rattacher »** sur la page Commandes d'impression. Vous choisissez le client (et la tâche ou le projet) puis validez : la commande Flowk est créée (référence = n° Realisaprint, montant en HT, TTC mis en avant).
- Les commandes déjà rattachées se mettent à jour : date de livraison prévue et lien de suivi du colis. Le statut de production, le BAT et le règlement restent gérés par vous, rien n'est déduit automatiquement côté client.
- Le fichier d'enregistrement que vous avez envoyé sert à construire et tester la lecture ; un import manuel par fichier reste disponible en secours.

## 2. Catalogue de vos produits Realisaprint
- Nouvelle page **Catalogue impression** : vos produits habituels (Carte de visite 350 g couché mat, Tapis de sol, Autocollant grand format…) avec support, format, finitions, couleurs et tarifs par quantité en HT.
- Pré-rempli à partir des produits trouvés dans vos commandes ; vous ajustez les prix (prix de revient et prix de vente).
- Dans une commande d'impression Flowk, bouton **« Depuis le catalogue »** : un clic remplit la ligne produit et les tarifs par quantité proposés au client.
- Séparé du module Finance, qui n'est pas touché.

## 3. Commander depuis Flowk
- Passer la commande toute seule chez Realisaprint (choix des options, envoi du fichier, paiement) n'est pas fiable sans accès officiel : un mauvais clic coûterait une vraie commande. Je ne l'automatise donc pas.
- À la place : sur une commande Flowk, bouton **« Commander chez Realisaprint »** qui ouvre la bonne page produit et affiche à côté le récapitulatif à reproduire (options, quantité, fichier BAT à télécharger). Une fois commandée, la synchronisation du point 1 la retrouve et vous propose de la relier à cette commande Flowk.

## Ce qui ne change pas
Aucun email au client, rien vers Tiime, aucune étape de production inventée. Après ça, pensez à vous déconnecter/reconnecter sur Realisaprint : l'enregistrement envoyé contient votre session.

## Détails techniques
- Secrets `REALISAPRINT_EMAIL` / `REALISAPRINT_PASSWORD` via le formulaire sécurisé.
- Fonction `realisaprint-sync` : login par formulaire (cookie de session), GET `/site/dashboard/?page=orders`, parse HTML (deno-dom) partagé avec `src/lib/realisaprintImport.ts` (logique de découpe commande/ligne testée sur un extrait anonymisé du HAR : 10 commandes, #1854195 = 50,40 € TTC → 42,00 € HT, 3 lignes sur #1845908). Admin uniquement ; tâche planifiée quotidienne (pg_cron + pg_net).
- Table `realisaprint_orders` (n° unique, date, état, total TTC, lignes jsonb, livraison, suivi, `print_order_id` nullable, synced_at) : RLS admin + GRANTs dans la même migration.
- Table `print_catalog_items` (libellé, support, grammage, format, finitions, couleurs, `price_tiers` jsonb au format existant, coût HT, url Realisaprint, actif) : RLS admin + GRANTs. Réutilise `PriceTiersEditor`.
- UI : onglet « À rattacher » + `RealisaprintImportDialog` dans `PrintOrders.tsx` ; page `PrintCatalog` ; sélecteur catalogue dans `NewPrintOrderDialog`/`PrintOrderDetail` ; bouton « Commander chez Realisaprint » dans `PrintOrderDetail`.
- Régénération des types après migration, déploiement de la fonction, règle ajoutée dans AGENTS.md.
