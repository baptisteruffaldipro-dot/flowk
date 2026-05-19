## Objectif

Depuis le Kanban des tâches, permettre de transformer une tâche terminée en :
- **BAT** (popup `NewBatDialog`)
- **Commande d'impression** (popup nouvelle impression)
- **Facture** (popup `NewTiimeInvoiceDialog`)

Sans quitter le Kanban, et en pré-remplissant un maximum de champs depuis la tâche source.

---

## Options proposées (à choisir une ou combiner)

### Option A — Bouton "Terminer →" sur chaque carte (recommandé)
Un petit bouton vert en bas/coin de la carte Kanban (visible au hover) ouvre un mini-menu :
```text
Terminer la tâche en…
 ├─ 📄 Envoyer en BAT
 ├─ 🖨️ Envoyer en impression
 ├─ 💶 Envoyer en facturation
 └─ ✅ Marquer terminée (sans suite)
```
Avantage : 1 clic, découvrable, pas besoin d'ouvrir la tâche.

### Option B — Menu contextuel (clic droit / "⋯")
Trois points "⋯" sur la carte → mêmes 4 actions. Plus discret, moins découvrable.

### Option C — Colonne spéciale "À clôturer"
Drag d'une tâche vers une colonne dédiée déclenche automatiquement le menu de choix. Visuel mais ajoute du bruit au Kanban.

### Option D — Drag direct vers colonnes existantes
Glisser dans `bat` → ouvre popup BAT. Glisser dans `a_facturer` → ouvre popup facture. Pas de popup pour impression (créer colonne ou rester sur A).

**Recommandation** : **Option A** + **Option D** (drag déjà naturel pour BAT/facturation, bouton "Terminer →" pour exposer aussi l'impression).

---

## Comportement détaillé des 3 popups

Tous les popups reçoivent la tâche en prop et pré-remplissent :

| Popup | Source pré-remplie | Au succès |
|---|---|---|
| **BAT** (`NewBatDialog` existant) | titre, client, projet | `task.bat_id` mis à jour + `status = 'bat'` |
| **Impression** (nouveau `NewPrintOrderDialog`, calqué sur `NewBatDialog`) | description = titre tâche, client, projet, montant = `flat_amount` ou calcul horaire | `status = 'envoye'`, lien optionnel `task.id` stocké dans description |
| **Facturation** (`NewTiimeInvoiceDialog` existant) | label = titre, montant, heures, taux | `task.status = 'a_facturer'` ou `'tiime'` |

Action **"Marquer terminée"** : passe simplement `status = 'archive'`.

---

## Section technique

**Fichiers à modifier**
- `src/pages/Tasks.tsx` :
  - Composant `KanbanCard` : ajouter bouton "Terminer →" (DropdownMenu shadcn) qui ouvre un menu avec 4 entrées.
  - State local au niveau de `Tasks` pour piloter les 3 dialogs : `{ batTask, printTask, invoiceTask }`.
  - Callback `onComplete(task, action)` passé aux cartes.
- `src/components/NewPrintOrderDialog.tsx` (nouveau) :
  - Calqué sur `NewBatDialog`, insère dans `print_orders` avec `client_id`, `project_id`, `description`, `amount`, `status = 'a_commander'`.
  - Champs : description, référence, quantité, format, support, finitions, observations, montant estimé.
- Réutiliser `NewBatDialog` et `NewTiimeInvoiceDialog` tels quels (props déjà compatibles).

**Sur succès d'un popup** : mettre à jour la tâche source (`status`, `bat_id` si BAT) via le `onUpdate` existant + refresh local.

**Drag-to-column (Option D)** : dans `onDragEnd`, si `newStatus === 'bat'` et `task.bat_id` est nul → ouvrir popup BAT au lieu de muter directement. Idem pour `'a_facturer'`.

---

## Décision à prendre

Je peux implémenter :
1. **A seul** (bouton "Terminer →" + 3 popups) — le plus simple, le plus clair
2. **A + D** (bouton + drag intelligent vers `bat`/`a_facturer`)
3. **B seul** (menu "⋯" discret)
4. **C** (colonne "À clôturer" dédiée)

Dis-moi quelle option tu préfères et je l'implémente.