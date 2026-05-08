
CREATE TYPE public.lead_status AS ENUM ('nouveau', 'contacte', 'qualifie', 'perdu', 'converti');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text,
  phone text,
  company text,
  message text,
  source text,
  status public.lead_status NOT NULL DEFAULT 'nouveau',
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all leads" ON public.leads
FOR ALL TO public
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "public can submit leads" ON public.leads
FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'nouveau'
  AND read_at IS NULL
  AND (email IS NOT NULL OR phone IS NOT NULL OR name IS NOT NULL)
);

CREATE TRIGGER touch_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX idx_leads_status ON public.leads (status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
