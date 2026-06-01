
CREATE TYPE public.social_task_status AS ENUM ('a_faire', 'en_cours', 'fait');
CREATE TYPE public.social_task_priority AS ENUM ('basse', 'normale', 'haute');

CREATE TABLE public.social_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status public.social_task_status NOT NULL DEFAULT 'a_faire',
  priority public.social_task_priority NOT NULL DEFAULT 'normale',
  due_date date,
  reminder_at timestamptz,
  done_at timestamptz,
  position numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_tasks TO authenticated;
GRANT ALL ON public.social_tasks TO service_role;

ALTER TABLE public.social_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all social_tasks" ON public.social_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "client reads own social_tasks" ON public.social_tasks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = social_tasks.client_id AND c.portal_user_id = auth.uid()
  ));

CREATE TRIGGER social_tasks_touch_updated
BEFORE UPDATE ON public.social_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_social_tasks_client ON public.social_tasks(client_id);
CREATE INDEX idx_social_tasks_post ON public.social_tasks(post_id);
