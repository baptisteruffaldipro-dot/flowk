
-- Enums
CREATE TYPE public.social_post_status AS ENUM ('idee','a_faire','pret','programme','publie','annule');
CREATE TYPE public.social_platform AS ENUM ('instagram','facebook','linkedin','tiktok','pinterest','autre');
CREATE TYPE public.social_format AS ENUM ('reel','post','carrousel','story','linkedin','video','autre');

-- Strategies
CREATE TABLE public.social_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  objective text,
  axes jsonb NOT NULL DEFAULT '[]'::jsonb,
  pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone text,
  rhythm jsonb NOT NULL DEFAULT '{}'::jsonb,
  weekly_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_strategies TO authenticated;
GRANT ALL ON public.social_strategies TO service_role;
ALTER TABLE public.social_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all social_strategies" ON public.social_strategies FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "client reads own social_strategy" ON public.social_strategies FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = social_strategies.client_id AND c.portal_user_id = auth.uid())
);
CREATE TRIGGER tg_social_strategies_touch BEFORE UPDATE ON public.social_strategies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Posts
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  scheduled_at timestamptz,
  platforms social_platform[] NOT NULL DEFAULT '{}',
  format social_format NOT NULL DEFAULT 'post',
  title text NOT NULL,
  caption text,
  notes text,
  status social_post_status NOT NULL DEFAULT 'idee',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_name text,
  pillar text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_posts_client_date ON public.social_posts(client_id, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all social_posts" ON public.social_posts FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "client reads own social_posts" ON public.social_posts FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = social_posts.client_id AND c.portal_user_id = auth.uid())
);
CREATE TRIGGER tg_social_posts_touch BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Links
CREATE TABLE public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  category text,
  position numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_links_client ON public.social_links(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
GRANT ALL ON public.social_links TO service_role;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all social_links" ON public.social_links FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "client reads own social_links" ON public.social_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients c WHERE c.id = social_links.client_id AND c.portal_user_id = auth.uid())
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('social-media','social-media', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "admin all social-media" ON storage.objects FOR ALL USING (bucket_id = 'social-media' AND is_admin()) WITH CHECK (bucket_id = 'social-media' AND is_admin());
CREATE POLICY "client reads own social-media" ON storage.objects FOR SELECT USING (
  bucket_id = 'social-media' AND EXISTS (
    SELECT 1 FROM clients c WHERE c.portal_user_id = auth.uid() AND (storage.foldername(name))[1] = c.id::text
  )
);
