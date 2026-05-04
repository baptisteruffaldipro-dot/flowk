
-- ============================================================
-- 1) print_orders: restrict client UPDATE to BAT-validation columns only
-- ============================================================
DROP POLICY IF EXISTS "client updates bat on own orders" ON public.print_orders;

-- Trigger ensuring clients can only modify BAT validation fields
CREATE OR REPLACE FUNCTION public.print_orders_client_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass all restrictions
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Block changes to any column other than the allowed BAT validation set
  IF NEW.client_id          IS DISTINCT FROM OLD.client_id          OR
     NEW.project_id         IS DISTINCT FROM OLD.project_id         OR
     NEW.description        IS DISTINCT FROM OLD.description        OR
     NEW.status             IS DISTINCT FROM OLD.status             OR
     NEW.amount             IS DISTINCT FROM OLD.amount             OR
     NEW.total_minutes      IS DISTINCT FROM OLD.total_minutes      OR
     NEW.bat_file_path      IS DISTINCT FROM OLD.bat_file_path      OR
     NEW.bat_uploaded_at    IS DISTINCT FROM OLD.bat_uploaded_at    OR
     NEW.deliverables::text IS DISTINCT FROM OLD.deliverables::text OR
     NEW.reference          IS DISTINCT FROM OLD.reference          OR
     NEW.quantity           IS DISTINCT FROM OLD.quantity           OR
     NEW.format             IS DISTINCT FROM OLD.format             OR
     NEW.grammage           IS DISTINCT FROM OLD.grammage           OR
     NEW.support            IS DISTINCT FROM OLD.support            OR
     NEW.colors             IS DISTINCT FROM OLD.colors             OR
     NEW.finitions          IS DISTINCT FROM OLD.finitions          OR
     NEW.observations       IS DISTINCT FROM OLD.observations       OR
     NEW.estimated_delivery_date IS DISTINCT FROM OLD.estimated_delivery_date OR
     NEW.payment_status     IS DISTINCT FROM OLD.payment_status     OR
     NEW.products::text     IS DISTINCT FROM OLD.products::text
  THEN
    RAISE EXCEPTION 'Clients can only update BAT validation fields on print_orders';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS print_orders_client_update_guard ON public.print_orders;
CREATE TRIGGER print_orders_client_update_guard
BEFORE UPDATE ON public.print_orders
FOR EACH ROW EXECUTE FUNCTION public.print_orders_client_update_guard();

CREATE POLICY "client updates bat on own orders"
ON public.print_orders
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = print_orders.client_id AND c.portal_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = print_orders.client_id AND c.portal_user_id = auth.uid()));

-- ============================================================
-- 2) bats: restrict client UPDATE to validation/signature workflow only
-- ============================================================
DROP POLICY IF EXISTS "client validates own bats" ON public.bats;

CREATE OR REPLACE FUNCTION public.bats_client_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id        IS DISTINCT FROM OLD.client_id        OR
     NEW.project_id       IS DISTINCT FROM OLD.project_id       OR
     NEW.title            IS DISTINCT FROM OLD.title            OR
     NEW.description      IS DISTINCT FROM OLD.description      OR
     NEW.reference        IS DISTINCT FROM OLD.reference        OR
     NEW.file_path        IS DISTINCT FROM OLD.file_path        OR
     NEW.file_uploaded_at IS DISTINCT FROM OLD.file_uploaded_at OR
     NEW.sent_at          IS DISTINCT FROM OLD.sent_at          OR
     NEW.print_status     IS DISTINCT FROM OLD.print_status     OR
     NEW.quantity         IS DISTINCT FROM OLD.quantity         OR
     NEW.format           IS DISTINCT FROM OLD.format           OR
     NEW.support          IS DISTINCT FROM OLD.support          OR
     NEW.finitions        IS DISTINCT FROM OLD.finitions        OR
     NEW.colors           IS DISTINCT FROM OLD.colors
  THEN
    RAISE EXCEPTION 'Clients can only update BAT validation fields on bats';
  END IF;

  -- status can only transition to validated/rejected
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text NOT IN ('valide', 'refuse') THEN
      RAISE EXCEPTION 'Clients can only set BAT status to validated or rejected';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bats_client_update_guard ON public.bats;
CREATE TRIGGER bats_client_update_guard
BEFORE UPDATE ON public.bats
FOR EACH ROW EXECUTE FUNCTION public.bats_client_update_guard();

CREATE POLICY "client validates own bats"
ON public.bats
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = bats.client_id AND c.portal_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = bats.client_id AND c.portal_user_id = auth.uid()));

-- ============================================================
-- 3) projects: restrict client UPDATE to brief field only
-- ============================================================
DROP POLICY IF EXISTS "client updates own brief" ON public.projects;

CREATE OR REPLACE FUNCTION public.projects_client_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id   IS DISTINCT FROM OLD.client_id   OR
     NEW.name        IS DISTINCT FROM OLD.name        OR
     NEW.type        IS DISTINCT FROM OLD.type        OR
     NEW.description IS DISTINCT FROM OLD.description OR
     NEW.deadline    IS DISTINCT FROM OLD.deadline    OR
     NEW.archived    IS DISTINCT FROM OLD.archived    OR
     NEW.notes       IS DISTINCT FROM OLD.notes
  THEN
    RAISE EXCEPTION 'Clients can only update brief and brief_submitted_at on projects';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_client_update_guard ON public.projects;
CREATE TRIGGER projects_client_update_guard
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.projects_client_update_guard();

CREATE POLICY "client updates own brief"
ON public.projects
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = projects.client_id AND c.portal_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = projects.client_id AND c.portal_user_id = auth.uid()));

-- ============================================================
-- 4) questionnaires: restrict client UPDATE to answers/submission only
-- ============================================================
DROP POLICY IF EXISTS "client updates own questionnaires" ON public.questionnaires;

CREATE OR REPLACE FUNCTION public.questionnaires_client_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id    IS DISTINCT FROM OLD.client_id    OR
     NEW.project_id   IS DISTINCT FROM OLD.project_id   OR
     NEW.title        IS DISTINCT FROM OLD.title        OR
     NEW.template     IS DISTINCT FROM OLD.template     OR
     NEW.created_by   IS DISTINCT FROM OLD.created_by   OR
     NEW.share_token  IS DISTINCT FROM OLD.share_token  OR
     NEW.ai_summary   IS DISTINCT FROM OLD.ai_summary   OR
     NEW.ai_summary_generated_at IS DISTINCT FROM OLD.ai_summary_generated_at
  THEN
    RAISE EXCEPTION 'Clients can only update answers and submission status on questionnaires';
  END IF;

  -- status restricted to allowed transitions for clients
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text NOT IN ('en_cours', 'soumis') THEN
      RAISE EXCEPTION 'Clients cannot set questionnaire status to %', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS questionnaires_client_update_guard ON public.questionnaires;
CREATE TRIGGER questionnaires_client_update_guard
BEFORE UPDATE ON public.questionnaires
FOR EACH ROW EXECUTE FUNCTION public.questionnaires_client_update_guard();

CREATE POLICY "client updates own questionnaires"
ON public.questionnaires
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = questionnaires.client_id AND c.portal_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = questionnaires.client_id AND c.portal_user_id = auth.uid()));

-- ============================================================
-- 5) bat_annotations: tighten UPDATE policy to require ownership
-- ============================================================
DROP POLICY IF EXISTS "client updates own annotations" ON public.bat_annotations;

CREATE POLICY "client updates own annotations"
ON public.bat_annotations
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.bats b JOIN public.clients c ON c.id = b.client_id WHERE b.id = bat_annotations.bat_id AND c.portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.print_orders po JOIN public.clients c ON c.id = po.client_id WHERE po.id = bat_annotations.print_order_id AND c.portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tasks t JOIN public.clients c ON c.id = t.client_id WHERE t.id = bat_annotations.task_id AND c.portal_user_id = auth.uid())
  )
)
WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.bats b JOIN public.clients c ON c.id = b.client_id WHERE b.id = bat_annotations.bat_id AND c.portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.print_orders po JOIN public.clients c ON c.id = po.client_id WHERE po.id = bat_annotations.print_order_id AND c.portal_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.tasks t JOIN public.clients c ON c.id = t.client_id WHERE t.id = bat_annotations.task_id AND c.portal_user_id = auth.uid())
  )
);

-- ============================================================
-- 6) Storage: fix broken 'client reads own bat files' policy
-- ============================================================
DROP POLICY IF EXISTS "client reads own bat files" ON storage.objects;

CREATE POLICY "client reads own bat files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bat'
  AND EXISTS (
    SELECT 1 FROM public.print_orders po
    JOIN public.clients c ON c.id = po.client_id
    WHERE c.portal_user_id = auth.uid()
      AND po.bat_file_path = storage.objects.name
  )
);

-- ============================================================
-- 7) Lock down internal SECURITY DEFINER functions
-- (queue wrappers + brand strategy share-token lookup)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_brand_strategy_by_token(text)  FROM authenticated;
-- anon keeps EXECUTE on get_brand_strategy_by_token because the public share page
-- (no auth) calls it via the get-public-questionnaire / public RPC pattern.
-- Actually it's only used server-side from edge functions in this project.
REVOKE EXECUTE ON FUNCTION public.get_brand_strategy_by_token(text)  FROM anon;

-- ============================================================
-- 8) Set immutable search_path on internal functions
-- ============================================================
ALTER FUNCTION public.enqueue_email(text, jsonb)         SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint)         SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
