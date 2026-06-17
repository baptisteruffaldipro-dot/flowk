CREATE TABLE public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  objective TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phases TO authenticated;
GRANT ALL ON public.project_phases TO service_role;

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project phases"
  ON public.project_phases FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_project_phases_touch
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_project_phases_project ON public.project_phases(project_id, position);

CREATE TABLE public.phase_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.project_phases(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_actions TO authenticated;
GRANT ALL ON public.phase_actions TO service_role;

ALTER TABLE public.phase_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage phase actions"
  ON public.phase_actions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_phase_actions_touch
  BEFORE UPDATE ON public.phase_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_phase_actions_phase ON public.phase_actions(phase_id, position);
CREATE INDEX idx_phase_actions_task ON public.phase_actions(task_id);