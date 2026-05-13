
# Intégration Tiime — création de factures

## Contexte

Tiime n'expose **aucune API publique officielle**. Le SDK communautaire `yabbal/tiime` a été retiré de GitHub/npm. Il reste deux voies :

1. **Rétro-ingénierie de l'API interne** utilisée par l'app web Tiime (login + endpoints `/invoices`). C'est ce que faisait le SDK supprimé. Risque : Tiime peut casser à tout moment.
2. **Chift** comme intermédiaire payant (~50€/mois). Stable, mais coût récurrent.

Tu as choisi le SDK non officiel + priorité basse. On garde donc le lien manuel comme fallback partout, et on ajoute la création automatique en option.

## Ce qu'on construit

Un edge function `tiime-create-invoice` qui :
- s'authentifie sur l'API interne Tiime avec tes identifiants stockés en secrets
- crée une facture (brouillon) à partir d'une de nos `invoices`
- stocke l'ID + l'URL Tiime retournés dans notre table `invoices`

Côté UI : un bouton **"Créer dans Tiime"** sur chaque facture, qui appelle l'edge function et remplit ensuite automatiquement le champ `invoice_url` (déjà utilisé par le DeliveryGate).

## Étapes

### 1. Reconnaissance API Tiime (avant tout code)
Avant d'écrire l'edge function, je dois inspecter les requêtes réseau de l'app web Tiime pendant que **toi** tu te connectes et crées une facture manuellement. J'ai besoin de :
- L'URL de l'endpoint d'auth (probablement `https://chronos.tiime-apps.com/auth/login` ou similaire)
- Le payload de création de facture (champs requis : client, lignes, TVA, etc.)
- Le format de la réponse (id, numéro, URL publique)

**Action requise de ta part** : ouvrir Tiime, F12 → onglet Network, créer une facture test, et me copier-coller les 2-3 requêtes clés (URL + headers + body). Je ne peux pas faire ça moi-même.

### 2. Secrets
Ajouter `TIIME_EMAIL` + `TIIME_PASSWORD` (ou un token long-lived si Tiime en propose un dans son interface).

### 3. Mapping de données

Mapper notre `invoices` + `invoice_installments` vers le payload Tiime :

```text
Flowk invoice              →  Tiime invoice
─────────────────────────     ──────────────────────
client_id (→ profiles)     →  customer (matching par email/nom)
lines (description, qty,   →  items[]
       unit_price)
total_ht, tva, total_ttc   →  calculs Tiime
installments[]             →  due_date + plan d'échéances
```

Le matching client est délicat : si le client n'existe pas dans Tiime, il faut le créer avant. Je gère les deux cas dans l'edge function.

### 4. Edge function `tiime-create-invoice`
- Input : `{ invoice_id }`
- Process : login → find/create customer → POST invoice → save `tiime_invoice_id` + `invoice_url` sur notre `invoices`
- Output : `{ tiime_id, url }`

### 5. UI
- Page `Invoices` et `InstallmentsManager` : bouton **"Créer dans Tiime"** (visible quand `invoice_url` est vide)
- Toast succès → le champ `invoice_url` se remplit tout seul → le client voit le lien dans son portail
- Bouton **"Voir dans Tiime"** quand déjà créé

### 6. Fallback
Le champ `invoice_url` manuel + l'upload PDF restent en place. Si l'API casse, tu continues comme aujourd'hui sans rien perdre.

## Hors scope (v2)

- **Synchro retour** (Tiime → Flowk pour marquer payé). Trop fragile sans webhook officiel. Tu coches les paiements à la main, comme aujourd'hui.
- **Création de devis**.
- **Avoirs / annulations**.

## Migration DB

Ajout sur `invoices` :
- `tiime_invoice_id` text
- `tiime_synced_at` timestamptz

## Décision à prendre maintenant

Je peux **préparer le squelette** (UI, edge function avec stub, secrets, migration) sans attendre — tu remplis les vrais endpoints Tiime quand tu as 5 min pour faire la capture réseau.

Ou on attend que tu aies les requêtes Tiime en main pour tout faire d'un coup.
