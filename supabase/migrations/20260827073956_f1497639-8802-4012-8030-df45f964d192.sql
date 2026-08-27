CREATE TABLE public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  images jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  color text,
  pinned boolean not null default false,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideas TO authenticated;
GRANT ALL ON public.ideas TO service_role;

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ideas" ON public.ideas FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER ideas_touch_updated_at BEFORE UPDATE ON public.ideas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX ideas_project_id_idx ON public.ideas(project_id);
CREATE INDEX ideas_task_id_idx ON public.ideas(task_id);

CREATE POLICY "Admins read ideas bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ideas' AND public.is_admin());
CREATE POLICY "Admins write ideas bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ideas' AND public.is_admin());
CREATE POLICY "Admins update ideas bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ideas' AND public.is_admin());
CREATE POLICY "Admins delete ideas bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ideas' AND public.is_admin());