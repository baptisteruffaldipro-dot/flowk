
DO $$ BEGIN
  CREATE TYPE public.bat_status AS ENUM ('brouillon','en_relecture','valide','rejete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  reference text,
  title text NOT NULL,
  description text,
  quantity integer,
  format text,
  support text,
  finitions text,
  colors text,
  observations text,
  file_path text,
  file_uploaded_at timestamptz,
  status public.bat_status NOT NULL DEFAULT 'brouillon',
  sent_at timestamptz,
  validated_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  signed_by_name text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bats_client ON public.bats(client_id);
CREATE INDEX IF NOT EXISTS idx_bats_project ON public.bats(project_id);

ALTER TABLE public.bats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all bats" ON public.bats FOR ALL TO public
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "client sees own bats" ON public.bats FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = bats.client_id AND c.portal_user_id = auth.uid()));

CREATE POLICY "client validates own bats" ON public.bats FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = bats.client_id AND c.portal_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM clients c WHERE c.id = bats.client_id AND c.portal_user_id = auth.uid()));

CREATE TRIGGER trg_bats_updated_at BEFORE UPDATE ON public.bats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.bat_annotations ADD COLUMN IF NOT EXISTS bat_id uuid REFERENCES public.bats(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_bat_annotations_bat ON public.bat_annotations(bat_id);

CREATE POLICY "client reads annotations on own bats" ON public.bat_annotations FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM bats b JOIN clients c ON c.id = b.client_id
    WHERE b.id = bat_annotations.bat_id AND c.portal_user_id = auth.uid()
  ));

CREATE POLICY "client adds annotations on own bats" ON public.bat_annotations FOR INSERT TO public
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM bats b JOIN clients c ON c.id = b.client_id
    WHERE b.id = bat_annotations.bat_id AND c.portal_user_id = auth.uid()
  ));
