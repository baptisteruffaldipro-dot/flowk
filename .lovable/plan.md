# Nommer chaque BAT (BAT 1 : Flyer, BAT 2 : Carte de visite…)

## Ce que vous aurez
- Dans l'onglet « Fichiers & BAT » de la tâche ou du projet, chaque fichier a un champ **Nom du BAT** (ex. « Flyer », « Carte de visite »), modifiable à tout moment. Enregistré quand vous quittez le champ.
- Côté client, les boutons deviennent **« BAT 1 : Flyer »**, **« BAT 2 : Carte de visite »**… S'il n'y a pas de nom, ça reste « BAT 1 », « BAT 2 » comme aujourd'hui.
- Le nom apparaît aussi au-dessus de l'aperçu du BAT sélectionné côté client.
- Renommer ne touche pas aux validations déjà faites par le client (un BAT validé reste validé), ni au fichier lui-même.

## Détails techniques
- Ajout d'un champ optionnel `label` dans chaque élément de `deliverable_files` (tâches / projets) ; type `Deliverable` étendu. Pas de nouvelle colonne.
- `PortalPanel` : input par ligne de livrable, `saveDeliverables` au blur. Le `name` (clé des validations `deliverable_reviews`) n'est pas modifié.
- Migration : `portal_deliverables_by_token` renvoie aussi `'label', f->>'label'` (reste de la fonction identique).
- `ClientPortalPublic` : libellé du bouton `BAT {i+1}{label ? " : " + label : ""}`, titre au-dessus de l'aperçu.
- Petit test sur la fonction de libellé (avec et sans nom). Publication nécessaire pour le côté client.
