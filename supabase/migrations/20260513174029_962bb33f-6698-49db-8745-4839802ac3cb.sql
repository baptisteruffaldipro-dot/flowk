-- 1) Add the new task status value
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'bat';

-- 2) Link a task to its BAT
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS bat_id uuid REFERENCES public.bats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_bat_id ON public.tasks(bat_id);