ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_start time;
CREATE INDEX IF NOT EXISTS tasks_scheduled_date_idx ON public.tasks(scheduled_date);

CREATE TABLE IF NOT EXISTS public.agenda_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'gestion',
  start_time time NOT NULL DEFAULT '09:00',
  duration_minutes integer NOT NULL DEFAULT 60,
  recurrence text NOT NULL DEFAULT 'daily',
  weekdays integer[] NOT NULL DEFAULT '{}',
  month_day integer,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_blocks TO authenticated;
GRANT ALL ON public.agenda_blocks TO service_role;
ALTER TABLE public.agenda_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage agenda blocks" ON public.agenda_blocks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());