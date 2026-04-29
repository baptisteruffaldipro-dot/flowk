CREATE TYPE public.task_priority AS ENUM ('en_priorite', 'secondaire', 'attente_retour_client', 'devis');

ALTER TABLE public.tasks
ADD COLUMN priority public.task_priority NOT NULL DEFAULT 'secondaire';