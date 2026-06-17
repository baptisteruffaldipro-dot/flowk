## Roadmap projet — Plan

Transformer la fiche projet en **roadmap verticale par phases**, façon ta fiche Plat'O'Rama.

### 1. Modèle de données

Deux nouvelles tables liées au projet :

- `project_phases` : `project_id`, `title` (ex: "Phase 1 — Cadrage"), `objective` (texte court, le 🎯), `position`, `color` (vert/orange/gris auto selon progression), `collapsed`.
- `phase_actions` : `phase_id`, `label`, `done` (bool), `position`, `task_id` (nullable, lien vers `tasks.id` si l'action a été promue en tâche).

Les "livrables" ne sont pas une table séparée — ce sont des actions comme les autres (tu as choisi "Actions seulement"). On peut les distinguer via un flag optionnel `is_deliverable` si tu veux les styliser plus tard, mais V1 = simple liste plate.

RLS : mêmes règles que `projects` (admin gère tout, client lit si projet visible).

### 2. UI dans la fiche projet (`ProjectDetail.tsx`)

Nouvel onglet/section **Roadmap** au-dessus du kanban de tâches, en **timeline verticale** :

```text
●──── Phase 1 — Cadrage & fondations          [75%] ▾
│     🎯 Poser des bases solides
│     ☑ Valider le nom commercial
│     ☑ Valider le positionnement
│     ☐ Définir l'offre V1            [→ créer tâche]
│     [+ ajouter une action]
│
●──── Phase 2 — Identité & crédibilité        [0%]  ▸
│
[+ ajouter une phase]
```

Comportements :
- Pastille colorée à gauche : verte (100%), orange (en cours), grise (0%).
- Barre de progression par phase + barre globale projet en haut (somme des actions).
- Phases pliables, drag-and-drop pour réordonner phases et actions.
- Édition inline du titre, de l'objectif, du label d'action (comme sous-objectifs).
- Bouton "→ créer tâche" sur une action : crée une tâche kanban liée à ce projet, stocke `task_id`. Cocher la tâche dans le kanban coche l'action, et inversement.

### 3. Projets vs Objectifs — recommandation

Vu ton doute, je propose une règle simple à garder en tête (et qu'on inscrira dans la mémoire projet) :

- **Projet** = un livrable concret avec deadline (Plat'O'Rama, refonte site client X). Il a une roadmap.
- **Objectif** = un résultat plus large, souvent transverse à plusieurs projets ("Atteindre 10k€ MRR", "Lancer 3 produits en 2026"). Il agrège.

Donc on garde les deux séparés, **mais** : un projet peut être taggé à un ou plusieurs objectifs (comme les tâches le sont déjà via `GoalsTagSelector` — c'est déjà en place). La progression du projet (= % d'actions de roadmap cochées) remontera dans l'objectif lié, au même titre que les tâches/sous-projets.

Pas de nouveau lien Phase↔Objectif en V1 : trop granulaire, on reste sur projet↔objectif.

### 4. Migration des projets existants

Aucun projet n'aura de phase au début. La section Roadmap affichera un état vide avec un bouton "Créer la première phase" + un template optionnel "6 phases type lancement" pré-rempli (Cadrage / Identité / Preuve / Web / Stratégie / Lancement) inspiré de Plat'O'Rama.

### 5. Dashboard

La carte Projet du dashboard affichera désormais la barre de progression issue de la roadmap (au lieu / en plus du compteur de tâches actuel).

### Détails techniques

- Migration Supabase : 2 tables + GRANT + RLS + trigger `updated_at`.
- Composants : `ProjectRoadmap.tsx` (conteneur), `PhaseCard.tsx`, `PhaseAction.tsx`.
- DnD : `@dnd-kit/sortable` (déjà utilisé dans le kanban si présent, sinon à ajouter).
- Sync action↔tâche : quand `phase_actions.task_id` est défini, on lit `tasks.status` pour déterminer `done` (`done` si status = `termine`), et un toggle sur l'action met à jour la tâche.
- `ProjectDetail.tsx` : la roadmap est insérée entre la grille de métadonnées et la liste de tâches/kanban.

### Hors scope V1

- Pas de Gantt / dates par phase (échéance reste au niveau projet).
- Pas de templates personnalisables au-delà du template lancement fourni.
- Pas de lien phase↔objectif (uniquement projet↔objectif).
