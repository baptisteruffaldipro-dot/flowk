
CREATE TABLE public.logo_presentations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'Document de travail — Version 1',
  tagline TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_token TEXT UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logo_presentations_client ON public.logo_presentations(client_id);
CREATE INDEX idx_logo_presentations_share_token ON public.logo_presentations(share_token);

CREATE TRIGGER trg_logo_presentations_updated_at
BEFORE UPDATE ON public.logo_presentations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.logo_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all logo_presentations"
ON public.logo_presentations FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "client sees own logo_presentation"
ON public.logo_presentations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = logo_presentations.client_id
      AND c.portal_user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.get_logo_presentation_by_token(_token TEXT)
RETURNS public.logo_presentations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.logo_presentations
  WHERE share_token = _token AND is_published = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_logo_presentation_by_token(TEXT) TO anon, authenticated;

-- Storage bucket public
INSERT INTO storage.buckets (id, name, public)
VALUES ('logo-presentations', 'logo-presentations', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read logo-presentations"
ON storage.objects FOR SELECT
USING (bucket_id = 'logo-presentations');

CREATE POLICY "Admin upload logo-presentations"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logo-presentations' AND public.is_admin());

CREATE POLICY "Admin update logo-presentations"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logo-presentations' AND public.is_admin());

CREATE POLICY "Admin delete logo-presentations"
ON storage.objects FOR DELETE
USING (bucket_id = 'logo-presentations' AND public.is_admin());
