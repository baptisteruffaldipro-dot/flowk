ALTER TABLE public.tasks ALTER COLUMN position TYPE numeric USING position::numeric;
ALTER TABLE public.kanban_dividers ALTER COLUMN position TYPE numeric USING position::numeric;