# Sélection des références du moodboard par le client

## Ce que verra le client
- Sur la présentation logo partagée, chaque image du moodboard porte un bouton cœur / coche « J'aime ».
- Un clic sélectionne ou désélectionne l'image (bordure et coche visibles).
- Un compteur discret « X références sélectionnées » par univers.
- La sélection est enregistrée automatiquement, sans compte, et retrouvée à la prochaine ouverture du lien.

## Ce que vous verrez
- Dans l'éditeur de la présentation, les images choisies par le client sont marquées (coche + badge « Choisie par le client »), avec un total par univers.
- Une notification vous prévient quand le client modifie sa sélection.

## Hors périmètre
- Pas de commentaire par image (possible ensuite).
- Aucun changement sur les pistes logo, couleurs, typos.

## Détails techniques
- Nouvelle colonne `client_selections jsonb default '{}'` sur `logo_presentations` (clé = `universeIndex:imageIndex` ou URL de l'image, plus robuste aux réordonnancements → on utilise l'URL).
- Nouvelle fonction security definer `logo_presentation_toggle_selection_by_token(_token, _image_url, _selected)` qui ne modifie que ce champ ; `get_logo_presentation_by_token` le renvoie déjà (retour de ligne complète).
- Notification admin via insert dans `notifications` dans la même fonction (dédoublonnée sur 10 min).
- `LogoPresentationView` reçoit des props optionnelles `selections` / `onToggleSelection` ; mode lecture seule inchangé dans l'aperçu admin, sauf affichage des badges.
- Mise à jour optimiste côté public, régénération des types, test unitaire de la logique de bascule.
