ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS free_revisions integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS extra_revision_rate numeric;