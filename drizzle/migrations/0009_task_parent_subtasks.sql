ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS parent_id uuid;
CREATE INDEX IF NOT EXISTS subtasks_parent_id_idx ON public.subtasks (parent_id);
COMMENT ON COLUMN public.subtasks.parent_id IS 'NULL = tâche (niveau 1) ; sinon id de la tâche parente = sous-tâche';