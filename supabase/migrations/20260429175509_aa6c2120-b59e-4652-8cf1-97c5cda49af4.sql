
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'client');
CREATE TYPE public.task_status AS ENUM ('a_faire', 'en_attente', 'aujourdhui', 'envoye', 'a_facturer', 'archive');
CREATE TYPE public.prestation_type AS ENUM ('mise_en_page', 'creation', 'logo', 'impression', 'devis', 'moodboard', 'ajustements', 'autre');
CREATE TYPE public.billing_type AS ENUM ('horaire', 'forfait');
CREATE TYPE public.print_status AS ENUM ('bat_en_attente', 'bat_valide', 'en_impression', 'expedie', 'livre');
CREATE TYPE public.invoice_status AS ENUM ('a_facturer', 'facturee', 'payee');
CREATE TYPE public.project_type AS ENUM ('identite_graphique', 'support_communication', 'web', 'impression', 'autre');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin') $$;

-- Trigger: create profile + assign first user as admin, otherwise client
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type project_type NOT NULL DEFAULT 'autre',
  description TEXT,
  brief JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  prestation prestation_type NOT NULL DEFAULT 'autre',
  status task_status NOT NULL DEFAULT 'a_faire',
  deadline DATE,
  notes TEXT,
  billing_type billing_type NOT NULL DEFAULT 'horaire',
  hourly_rate NUMERIC(10,2),
  flat_amount NUMERIC(10,2),
  estimated_minutes INT DEFAULT 0,
  total_minutes INT NOT NULL DEFAULT 0,
  client_revisions_count INT NOT NULL DEFAULT 0,
  timer_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  estimated_minutes_at_start INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- ============ PRINT ORDERS ============
CREATE TABLE public.print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  status print_status NOT NULL DEFAULT 'bat_en_attente',
  amount NUMERIC(10,2),
  total_minutes INT NOT NULL DEFAULT 0,
  bat_file_path TEXT,
  bat_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;

-- ============ BAT ANNOTATIONS ============
CREATE TABLE public.bat_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_order_id UUID REFERENCES public.print_orders(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page INT NOT NULL DEFAULT 1,
  x NUMERIC(6,4) NOT NULL,
  y NUMERIC(6,4) NOT NULL,
  comment TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bat_annotations ENABLE ROW LEVEL SECURITY;

-- ============ INVOICES (simple tracking) ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  print_order_id UUID REFERENCES public.print_orders(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'a_facturer',
  invoiced_at DATE,
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_print_orders_updated BEFORE UPDATE ON public.print_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "users see own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin sees all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: only admin can manage; users can read their own roles
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admin reads all roles" ON public.user_roles FOR SELECT USING (public.is_admin());
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- clients
CREATE POLICY "admin all clients" ON public.clients FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "client sees own client row" ON public.clients FOR SELECT USING (portal_user_id = auth.uid());

-- projects
CREATE POLICY "admin all projects" ON public.projects FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "client sees own projects" ON public.projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = projects.client_id AND c.portal_user_id = auth.uid()));
CREATE POLICY "client updates own brief" ON public.projects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = projects.client_id AND c.portal_user_id = auth.uid()));

-- tasks
CREATE POLICY "admin all tasks" ON public.tasks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "client sees own tasks" ON public.tasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = tasks.client_id AND c.portal_user_id = auth.uid()));

-- subtasks
CREATE POLICY "admin all subtasks" ON public.subtasks FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- time_entries (admin only)
CREATE POLICY "admin all time_entries" ON public.time_entries FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- print_orders
CREATE POLICY "admin all print_orders" ON public.print_orders FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "client sees own print_orders" ON public.print_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = print_orders.client_id AND c.portal_user_id = auth.uid()));

-- bat_annotations
CREATE POLICY "admin all annotations" ON public.bat_annotations FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "client reads annotations on own orders" ON public.bat_annotations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.print_orders po JOIN public.clients c ON c.id = po.client_id
            WHERE po.id = bat_annotations.print_order_id AND c.portal_user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.tasks t JOIN public.clients c ON c.id = t.client_id
            WHERE t.id = bat_annotations.task_id AND c.portal_user_id = auth.uid())
  );
CREATE POLICY "client adds own annotations" ON public.bat_annotations FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.print_orders po JOIN public.clients c ON c.id = po.client_id
              WHERE po.id = bat_annotations.print_order_id AND c.portal_user_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM public.tasks t JOIN public.clients c ON c.id = t.client_id
              WHERE t.id = bat_annotations.task_id AND c.portal_user_id = auth.uid())
    )
  );

-- invoices
CREATE POLICY "admin all invoices" ON public.invoices FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "client reads own invoices" ON public.invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.portal_user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_print_orders_client ON public.print_orders(client_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_time_entries_task ON public.time_entries(task_id);
