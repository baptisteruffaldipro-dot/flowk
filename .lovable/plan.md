## Objectif
Centraliser tes mails dans l'app (page `/mails`), pouvoir y répondre, transférer, archiver/marquer lu (sync 2 voies avec ta boîte), et convertir un mail en tâche ou projet.

## Compte à connecter
Tu fourniras une fois les identifiants IMAP + SMTP de ta boîte :
- Serveur IMAP (host, port, SSL)
- Serveur SMTP (host, port, SSL/TLS)
- Adresse + mot de passe (idéalement un **mot de passe d'application** si ton fournisseur le propose — bien plus sûr qu'un mdp principal)

Stockés en secrets Lovable, jamais exposés au front.

## Modèle de données

```text
mail_accounts        — 1 ligne (ton compte connecté)
  id, email, imap_host, imap_port, smtp_host, smtp_port, last_uid_seen, last_synced_at

mails                — un mail importé
  id, account_id, message_id, thread_id, uid (IMAP),
  from_email, from_name, to_emails[], cc_emails[],
  subject, body_text, body_html, snippet,
  received_at, is_read, is_archived, is_starred,
  client_id (auto-détecté), task_id, project_id,
  raw_headers (jsonb)

mail_attachments     — pièces jointes (stockées dans bucket "mails")
  id, mail_id, filename, mime, size, storage_path
```

RLS : admin only.

## Synchronisation (polling 5 min)
Edge function `sync-mailbox` :
- Connexion IMAP (lib Deno), INBOX, fetch des UID > `last_uid_seen`
- Parse MIME → insert dans `mails` + upload pièces jointes
- Auto-match `client_id` via `from_email` ↔ table `clients`
- Cron pg_cron toutes les 5 min

Bouton "Rafraîchir maintenant" qui appelle la même fonction à la demande.

## UI — page `/mails`
- Liste type inbox (3 colonnes : dossiers / liste mails / lecture)
- Filtres : Non lus / Tous / Archivés / Par client
- Recherche plein texte (sujet + expéditeur + corps)
- Actions sur un mail :
  - **Répondre / Transférer** → composer + envoi SMTP via edge function `send-mail`
  - **Marquer lu/non lu** → patch IMAP (STORE flag \Seen) + update local
  - **Archiver** → MOVE vers dossier "Archive" IMAP + flag local
  - **→ Tâche** : ouvre dialog pré-rempli (titre = sujet, description = corps, client auto)
  - **→ Projet** : idem, crée un projet rattaché au client
- Badge non-lus dans la sidebar

## Edge functions
- `sync-mailbox` (IMAP fetch, cron + on-demand)
- `send-mail` (SMTP, répondre/transférer/nouveau)
- `mail-action` (mark read/unread, archive — actions IMAP)

## Détails techniques
- Lib IMAP Deno : `jsr:@workingdevshero/deno-imap` (ou équivalent maintenu)
- SMTP : `denomailer`
- Parsing MIME : `mailparser` via npm specifier
- Pièces jointes : bucket privé `mails`, lien signé à la demande
- Idempotence : unique `(account_id, uid)` pour éviter les doublons

## Limites assumées (V1)
- 1 seul compte mail
- Pas de push temps réel (polling 5 min)
- Pas d'éditeur HTML riche pour répondre (texte + signature simple) — possible d'ajouter ensuite
- Pas de gestion multi-dossiers (INBOX + Archive seulement)

## Étapes d'implémentation
1. Migration tables `mail_accounts`, `mails`, `mail_attachments` + bucket
2. Demande des secrets IMAP/SMTP
3. Edge function `sync-mailbox` + test manuel
4. Cron pg_cron 5 min
5. Edge functions `send-mail` et `mail-action`
6. Page `/mails` (liste + lecture)
7. Composer (répondre/transférer/nouveau)
8. Convertir en tâche / projet
9. Lien sidebar + badge non-lus

Prêt à lancer dès que tu valides — je te demanderai les identifiants IMAP/SMTP juste avant l'étape 3.