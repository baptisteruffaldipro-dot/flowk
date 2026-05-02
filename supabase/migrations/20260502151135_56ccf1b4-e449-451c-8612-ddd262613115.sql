-- Table des stratégies de marque
CREATE TABLE public.brand_strategies (
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

CREATE INDEX idx_brand_strategies_client ON public.brand_strategies(client_id);
CREATE INDEX idx_brand_strategies_share_token ON public.brand_strategies(share_token);

-- updated_at auto
CREATE TRIGGER trg_brand_strategies_updated_at
BEFORE UPDATE ON public.brand_strategies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.brand_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all brand_strategies"
ON public.brand_strategies
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "client sees own brand_strategy"
ON public.brand_strategies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = brand_strategies.client_id
      AND c.portal_user_id = auth.uid()
  )
);

-- Fonction pour lecture publique par jeton (contourne RLS de manière contrôlée)
CREATE OR REPLACE FUNCTION public.get_brand_strategy_by_token(_token TEXT)
RETURNS public.brand_strategies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.brand_strategies
  WHERE share_token = _token
    AND is_published = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_brand_strategy_by_token(TEXT) TO anon, authenticated;