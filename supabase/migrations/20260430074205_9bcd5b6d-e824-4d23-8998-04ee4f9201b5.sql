-- Type de questionnaire
CREATE TYPE public.questionnaire_template AS ENUM ('logo', 'print', 'web', 'rapide');
CREATE TYPE public.questionnaire_status AS ENUM ('brouillon', 'envoye', 'complete', 'archive');

CREATE TABLE public.questionnaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template public.questionnaire_template NOT NULL,
  status public.questionnaire_status NOT NULL DEFAULT 'brouillon',
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  ai_summary_generated_at TIMESTAMPTZ,
  share_token TEXT UNIQUE,
  filled_by_client BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin all questionnaires"
ON public.questionnaires FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Client peut voir les questionnaires liés à son client_id
CREATE POLICY "client sees own questionnaires"
ON public.questionnaires FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clients c
  WHERE c.id = questionnaires.client_id
    AND c.portal_user_id = auth.uid()
));

-- Client peut mettre à jour ses questionnaires (réponses)
CREATE POLICY "client updates own questionnaires"
ON public.questionnaires FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.clients c
  WHERE c.id = questionnaires.client_id
    AND c.portal_user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clients c
  WHERE c.id = questionnaires.client_id
    AND c.portal_user_id = auth.uid()
));

-- Trigger updated_at
CREATE TRIGGER touch_questionnaires_updated_at
BEFORE UPDATE ON public.questionnaires
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_questionnaires_client ON public.questionnaires(client_id);
CREATE INDEX idx_questionnaires_project ON public.questionnaires(project_id);
CREATE INDEX idx_questionnaires_share_token ON public.questionnaires(share_token);