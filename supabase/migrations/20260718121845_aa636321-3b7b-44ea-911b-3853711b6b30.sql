
-- =========================================================
-- CLIENT PORTAL UNIFIED
-- =========================================================

-- Enum statut portail
DO $$ BEGIN
  CREATE TYPE public.client_portal_status AS ENUM (
    'draft',
    'awaiting_validation',
    'validated',
    'refused',
    'payment_pending',
    'payment_link_requested',
    'paid',
    'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_portal_entity AS ENUM ('task', 'project');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_portal_payment_method AS ENUM ('transfer', 'link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1) client_portals
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.client_portal_entity NOT NULL,
  entity_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  status public.client_portal_status NOT NULL DEFAULT 'draft',
  client_validated_at TIMESTAMPTZ,
  client_refused_at TIMESTAMPTZ,
  refusal_reason TEXT,
  payment_method_requested public.client_portal_payment_method,
  payment_link_url TEXT,
  payment_link_sent_at TIMESTAMPTZ,
  client_declared_paid_at TIMESTAMPTZ,
  client_declared_paid_note TEXT,
  admin_confirmed_paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_unlock_rule public.delivery_unlock_rule NOT NULL DEFAULT 'total',
  delivery_override BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portals TO authenticated;
GRANT ALL ON public.client_portals TO service_role;

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client_portals"
  ON public.client_portals FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_client_portals_updated
  BEFORE UPDATE ON public.client_portals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_client_portals_entity ON public.client_portals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_client ON public.client_portals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portals_token ON public.client_portals(share_token);

-- =========================================================
-- 2) client_portal_messages
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('client', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_messages TO authenticated;
GRANT ALL ON public.client_portal_messages TO service_role;

ALTER TABLE public.client_portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage portal messages"
  ON public.client_portal_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_portal_messages_portal ON public.client_portal_messages(portal_id, created_at);

-- =========================================================
-- 3) client_portal_events (audit)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_portal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.client_portal_events TO authenticated;
GRANT ALL ON public.client_portal_events TO service_role;

ALTER TABLE public.client_portal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read portal events"
  ON public.client_portal_events FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_portal_events_portal ON public.client_portal_events(portal_id, created_at DESC);

-- =========================================================
-- 4) payment_settings (singleton)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  iban TEXT,
  bic TEXT,
  account_holder TEXT,
  bank_name TEXT,
  transfer_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment_settings"
  ON public.payment_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_payment_settings_updated
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 5) Deliverable files on tasks/projects
-- =========================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverable_files JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deliverable_files JSONB NOT NULL DEFAULT '[]'::jsonb;

-- =========================================================
-- 6) Auto-create portal on task/project insert
-- =========================================================
CREATE OR REPLACE FUNCTION public.auto_create_client_portal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  et public.client_portal_entity;
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    et := 'task';
  ELSIF TG_TABLE_NAME = 'projects' THEN
    et := 'project';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.client_portals (entity_type, entity_id, client_id, status)
  VALUES (et, NEW.id, NEW.client_id, 'draft')
  ON CONFLICT (entity_type, entity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_autoportal ON public.tasks;
CREATE TRIGGER trg_tasks_autoportal
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_portal();

DROP TRIGGER IF EXISTS trg_projects_autoportal ON public.projects;
CREATE TRIGGER trg_projects_autoportal
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_portal();

-- Backfill : create portals for existing tasks/projects that don't have one
INSERT INTO public.client_portals (entity_type, entity_id, client_id, status)
SELECT 'task'::public.client_portal_entity, t.id, t.client_id, 'draft'
FROM public.tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_portals cp
  WHERE cp.entity_type = 'task' AND cp.entity_id = t.id
);

INSERT INTO public.client_portals (entity_type, entity_id, client_id, status)
SELECT 'project'::public.client_portal_entity, p.id, p.client_id, 'draft'
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_portals cp
  WHERE cp.entity_type = 'project' AND cp.entity_id = p.id
);

-- =========================================================
-- 7) Notify admins on client actions
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_portal_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  notif_kind TEXT;
  notif_title TEXT;
  notif_body TEXT;
  entity_label TEXT;
BEGIN
  entity_label := CASE WHEN NEW.entity_type = 'task' THEN 'Tâche' ELSE 'Projet' END;

  IF NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated') THEN
    notif_kind := 'portal_validated';
    notif_title := 'Portail validé par le client';
    notif_body := entity_label || ' validé — passer au paiement';
  ELSIF NEW.status = 'refused' AND (OLD.status IS DISTINCT FROM 'refused') THEN
    notif_kind := 'portal_refused';
    notif_title := 'Portail refusé par le client';
    notif_body := entity_label || ' refusé' || COALESCE(' — ' || NEW.refusal_reason, '');
  ELSIF NEW.status = 'payment_link_requested' AND (OLD.status IS DISTINCT FROM 'payment_link_requested') THEN
    notif_kind := 'portal_payment_link_requested';
    notif_title := 'Lien de paiement demandé';
    notif_body := 'Un client demande un lien de paiement — colle-le dans le portail';
  ELSIF NEW.client_declared_paid_at IS NOT NULL AND OLD.client_declared_paid_at IS NULL THEN
    notif_kind := 'portal_client_declared_paid';
    notif_title := 'Le client a déclaré avoir payé';
    notif_body := entity_label || ' — vérifier et confirmer le paiement';
  ELSE
    RETURN NEW;
  END IF;

  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (admin_id, notif_kind, notif_title, notif_body, '/portails/' || NEW.id, 'client_portal', NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_notify ON public.client_portals;
CREATE TRIGGER trg_portal_notify
  AFTER UPDATE ON public.client_portals
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_portal_action();

-- =========================================================
-- 8) Public RPCs by token
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_client_portal_by_token(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.client_portals;
  entity JSONB;
  client_row JSONB;
  msgs JSONB;
  bats_json JSONB;
  po_json JSONB;
  invoices_json JSONB;
  subtasks_json JSONB;
  pay JSONB;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true LIMIT 1;
  IF p.id IS NULL THEN RETURN NULL; END IF;

  IF p.entity_type = 'task' THEN
    SELECT to_jsonb(t) INTO entity FROM public.tasks t WHERE t.id = p.entity_id;
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.position), '[]'::jsonb) INTO subtasks_json
      FROM public.subtasks s WHERE s.task_id = p.entity_id;
    SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO invoices_json
      FROM public.invoices i WHERE i.task_id = p.entity_id;
  ELSE
    SELECT to_jsonb(pr) INTO entity FROM public.projects pr WHERE pr.id = p.entity_id;
    subtasks_json := '[]'::jsonb;
    SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO invoices_json
      FROM public.invoices i
      WHERE i.task_id IN (SELECT id FROM public.tasks WHERE project_id = p.entity_id)
         OR i.print_order_id IN (SELECT id FROM public.print_orders WHERE project_id = p.entity_id);
  END IF;

  IF p.client_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)
      INTO client_row FROM public.clients c WHERE c.id = p.client_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'author', m.author, 'body', m.body, 'created_at', m.created_at
  ) ORDER BY m.created_at), '[]'::jsonb) INTO msgs
  FROM public.client_portal_messages m WHERE m.portal_id = p.id;

  -- BAT & print orders liés au projet (ou à la tâche via son projet)
  IF p.entity_type = 'project' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', b.id, 'title', b.title, 'status', b.status,
      'share_token', b.share_token, 'is_published', b.is_published
    )), '[]'::jsonb) INTO bats_json
    FROM public.bats b WHERE b.project_id = p.entity_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', o.id, 'description', o.description, 'status', o.status,
      'amount', o.amount, 'estimated_delivery_date', o.estimated_delivery_date
    )), '[]'::jsonb) INTO po_json
    FROM public.print_orders o WHERE o.project_id = p.entity_id;
  ELSE
    bats_json := '[]'::jsonb;
    po_json := '[]'::jsonb;
  END IF;

  -- Paramètres de paiement (RIB) — publics une fois validé
  IF p.status IN ('validated','payment_pending','payment_link_requested','paid','delivered')
     OR p.payment_method_requested IS NOT NULL THEN
    SELECT jsonb_build_object(
      'iban', ps.iban, 'bic', ps.bic, 'account_holder', ps.account_holder,
      'bank_name', ps.bank_name, 'transfer_note', ps.transfer_note
    ) INTO pay FROM public.payment_settings ps WHERE ps.id = 1;
  ELSE
    pay := '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'portal', to_jsonb(p),
    'entity', entity,
    'client', client_row,
    'messages', msgs,
    'subtasks', subtasks_json,
    'bats', bats_json,
    'print_orders', po_json,
    'invoices', invoices_json,
    'payment_settings', pay
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_by_token(TEXT) TO anon, authenticated;

-- --- Actions ---

CREATE OR REPLACE FUNCTION public.portal_action_by_token(
  _token TEXT,
  _action TEXT,
  _payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.client_portals;
  new_status public.client_portal_status;
  reason TEXT;
  body TEXT;
  method TEXT;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Portail introuvable'; END IF;

  IF _action = 'validate' THEN
    IF p.status NOT IN ('draft','awaiting_validation') THEN
      RAISE EXCEPTION 'Portail déjà traité';
    END IF;
    UPDATE public.client_portals
      SET status = 'validated',
          client_validated_at = now()
      WHERE id = p.id;

  ELSIF _action = 'refuse' THEN
    reason := NULLIF(_payload->>'reason', '');
    UPDATE public.client_portals
      SET status = 'refused',
          client_refused_at = now(),
          refusal_reason = reason
      WHERE id = p.id;

  ELSIF _action = 'request_payment_link' THEN
    IF p.status NOT IN ('validated','payment_pending','payment_link_requested') THEN
      RAISE EXCEPTION 'Validation requise avant paiement';
    END IF;
    UPDATE public.client_portals
      SET status = 'payment_link_requested',
          payment_method_requested = 'link'
      WHERE id = p.id;

  ELSIF _action = 'choose_transfer' THEN
    IF p.status NOT IN ('validated','payment_pending','payment_link_requested') THEN
      RAISE EXCEPTION 'Validation requise avant paiement';
    END IF;
    UPDATE public.client_portals
      SET status = 'payment_pending',
          payment_method_requested = 'transfer'
      WHERE id = p.id;

  ELSIF _action = 'declare_paid' THEN
    UPDATE public.client_portals
      SET client_declared_paid_at = now(),
          client_declared_paid_note = NULLIF(_payload->>'note',''),
          status = CASE WHEN status IN ('validated','payment_pending','payment_link_requested')
                        THEN 'payment_pending'::public.client_portal_status
                        ELSE status END
      WHERE id = p.id;

  ELSIF _action = 'add_message' THEN
    body := NULLIF(_payload->>'body','');
    IF body IS NULL THEN RAISE EXCEPTION 'Message vide'; END IF;
    IF length(body) > 4000 THEN RAISE EXCEPTION 'Message trop long'; END IF;
    INSERT INTO public.client_portal_messages(portal_id, author, body)
    VALUES (p.id, 'client', body);

  ELSE
    RAISE EXCEPTION 'Action invalide';
  END IF;

  INSERT INTO public.client_portal_events(portal_id, kind, payload)
  VALUES (p.id, _action, COALESCE(_payload, '{}'::jsonb));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_action_by_token(TEXT, TEXT, JSONB) TO anon, authenticated;

-- --- Signed URL helper: liste des livrables ---
-- On expose seulement les chemins, l'app fera la signed URL via edge/rpc.
CREATE OR REPLACE FUNCTION public.portal_deliverables_by_token(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.client_portals;
  files JSONB;
  unlocked BOOLEAN;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true;
  IF p.id IS NULL THEN RETURN NULL; END IF;

  unlocked := p.delivery_override
    OR p.status = 'delivered'
    OR p.admin_confirmed_paid_at IS NOT NULL
    OR p.delivery_unlock_rule = 'libre';

  IF p.entity_type = 'task' THEN
    SELECT deliverable_files INTO files FROM public.tasks WHERE id = p.entity_id;
  ELSE
    SELECT deliverable_files INTO files FROM public.projects WHERE id = p.entity_id;
  END IF;

  RETURN jsonb_build_object('unlocked', unlocked, 'files', COALESCE(files, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_deliverables_by_token(TEXT) TO anon, authenticated;
