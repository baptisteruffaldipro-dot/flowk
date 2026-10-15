# Prévenir le client quand j'écris dans « Échanges »

## Ce qui change
- Quand j'envoie un message depuis la section « Échanges » du portail (fiche tâche), le client reçoit un email avec mon message en entier et un bouton « Ouvrir mon espace ».
- Une case « Prévenir le client par email » est cochée par défaut sous la zone de réponse. Je la décoche si je ne veux pas envoyer de mail (petite correction, note sans importance).
- Un message de confirmation s'affiche : « Message envoyé et client prévenu par email », ou une erreur si le client n'a pas d'adresse email.
- Côté client, en ouvrant le portail : un bandeau en haut « Nouveau message de l'atelier » reprend mon dernier message, avec un lien vers la section Échanges. Le bandeau disparaît une fois le message lu.

## Exemple
J'écris : « J'ai mis à jour le tarif de l'impression, merci de valider impérativement le BAT pour lancer l'impression. »
Le client reçoit un email « Nouveau message concernant votre projet [nom] » avec ce texte et le bouton vers son portail.

## Détails techniques
- Nouveau modèle d'email transactionnel `portal-message` (texte du message, nom du client, titre de la tâche/projet, lien `/p/c/:token`), ajouté au registre et envoyé via `send-app-email` (copie vers l'adresse de l'atelier comme les autres envois).
- `PortalPanel.tsx` : case à cocher + appel à l'envoi après insertion du message admin; publie le portail si nécessaire pour que le lien fonctionne.
- `ClientPortalPublic.tsx` : bandeau basé sur le dernier message `author = 'admin'` plus récent que la dernière visite (mémorisée dans le navigateur du client).
- Déploiement de `send-app-email`. À publier ensuite pour que les clients voient le bandeau.
