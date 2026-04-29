DO $$ BEGIN
  CREATE TYPE appointment_type AS ENUM ('visio', 'presentiel', 'telephone', 'autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('planifie', 'confirme', 'annule', 'termine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  type appointment_type NOT NULL DEFAULT 'presentiel',
  status appointment_status NOT NULL DEFAULT 'planifie',
  client_id uuid,
  project_id uuid,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all appointments" ON public.appointments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "client sees own appointments" ON public.appointments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM clients c WHERE c.id = appointments.client_id AND c.portal_user_id = auth.uid())
  );

CREATE TRIGGER appointments_touch_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON public.appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);