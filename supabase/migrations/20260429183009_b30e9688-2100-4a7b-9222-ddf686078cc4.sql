
CREATE TYPE public.capture_source AS ENUM ('sms','whatsapp','email','instagram','messenger','telephone','autre');
CREATE TYPE public.capture_status AS ENUM ('a_traiter','traite','archive');

CREATE TABLE public.quick_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  content text NOT NULL,
  source public.capture_source NOT NULL DEFAULT 'autre',
  status public.capture_status NOT NULL DEFAULT 'a_traiter',
  ai_summary text,
  ai_suggestions jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  print_order_id uuid REFERENCES public.print_orders(id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all captures" ON public.quick_captures
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER quick_captures_touch
  BEFORE UPDATE ON public.quick_captures
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX quick_captures_status_idx ON public.quick_captures(status, created_at DESC);
