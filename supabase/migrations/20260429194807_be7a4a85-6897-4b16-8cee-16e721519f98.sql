-- Add a position column to tasks for manual ordering inside columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_status_position ON public.tasks (status, position);

-- Kanban dividers table
CREATE TABLE IF NOT EXISTS public.kanban_dividers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status task_status NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_dividers_status_position
  ON public.kanban_dividers (status, position);

ALTER TABLE public.kanban_dividers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all kanban_dividers"
  ON public.kanban_dividers
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER kanban_dividers_touch_updated_at
  BEFORE UPDATE ON public.kanban_dividers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();