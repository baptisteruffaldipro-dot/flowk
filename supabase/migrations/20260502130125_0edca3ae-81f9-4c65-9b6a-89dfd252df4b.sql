-- Multi-prestations sur les tâches
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS prestations text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill : reprendre la prestation existante dans le nouveau tableau
UPDATE public.tasks
SET prestations = ARRAY[prestation::text]
WHERE (prestations IS NULL OR cardinality(prestations) = 0)
  AND prestation IS NOT NULL;

-- Rattachement à un questionnaire / brief
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid;

CREATE INDEX IF NOT EXISTS idx_tasks_questionnaire_id ON public.tasks(questionnaire_id);
