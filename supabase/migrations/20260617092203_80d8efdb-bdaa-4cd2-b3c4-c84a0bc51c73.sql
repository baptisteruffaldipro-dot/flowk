
-- goals
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  deadline date,
  color text DEFAULT '#6366f1',
  icon text,
  status text NOT NULL DEFAULT 'actif',
  archived boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER touch_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- subgoals
CREATE TABLE public.subgoals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subgoals TO authenticated;
GRANT ALL ON public.subgoals TO service_role;

ALTER TABLE public.subgoals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subgoals" ON public.subgoals
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER touch_subgoals_updated_at
  BEFORE UPDATE ON public.subgoals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_subgoals_goal ON public.subgoals(goal_id);

-- goal_tasks
CREATE TABLE public.goal_tasks (
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, task_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_tasks TO authenticated;
GRANT ALL ON public.goal_tasks TO service_role;

ALTER TABLE public.goal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage goal_tasks" ON public.goal_tasks
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_goal_tasks_task ON public.goal_tasks(task_id);

-- goal_projects
CREATE TABLE public.goal_projects (
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_projects TO authenticated;
GRANT ALL ON public.goal_projects TO service_role;

ALTER TABLE public.goal_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage goal_projects" ON public.goal_projects
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_goal_projects_project ON public.goal_projects(project_id);
