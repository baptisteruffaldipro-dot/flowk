CREATE TABLE public.tiime_auth (
  id INT PRIMARY KEY DEFAULT 1,
  refresh_token TEXT,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tiime_auth_singleton CHECK (id = 1)
);

ALTER TABLE public.tiime_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all tiime_auth"
  ON public.tiime_auth
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER tiime_auth_touch_updated_at
  BEFORE UPDATE ON public.tiime_auth
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.tiime_auth (id) VALUES (1) ON CONFLICT DO NOTHING;