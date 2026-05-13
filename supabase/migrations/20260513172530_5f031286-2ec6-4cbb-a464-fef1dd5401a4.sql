
-- 1. Enum for delivery unlock rule
CREATE TYPE public.delivery_unlock_rule AS ENUM ('acompte', 'total', 'libre');

-- 2. Tasks: add delivery gating fields
ALTER TABLE public.tasks
  ADD COLUMN delivery_unlock_rule public.delivery_unlock_rule NOT NULL DEFAULT 'acompte',
  ADD COLUMN delivery_override boolean NOT NULL DEFAULT false,
  ADD COLUMN delivery_override_at timestamptz,
  ADD COLUMN delivery_override_by uuid,
  ADD COLUMN invoice_url text;

-- 3. Print orders
ALTER TABLE public.print_orders
  ADD COLUMN delivery_unlock_rule public.delivery_unlock_rule NOT NULL DEFAULT 'acompte',
  ADD COLUMN delivery_override boolean NOT NULL DEFAULT false,
  ADD COLUMN delivery_override_at timestamptz,
  ADD COLUMN delivery_override_by uuid,
  ADD COLUMN invoice_url text;

-- 4. Logo presentations: add deliverables + gating
ALTER TABLE public.logo_presentations
  ADD COLUMN deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN delivery_unlock_rule public.delivery_unlock_rule NOT NULL DEFAULT 'acompte',
  ADD COLUMN delivery_override boolean NOT NULL DEFAULT false,
  ADD COLUMN delivery_override_at timestamptz,
  ADD COLUMN delivery_override_by uuid,
  ADD COLUMN invoice_url text;

-- 5. Function: can_download
-- entity_type: 'task' | 'print_order' | 'logo_presentation'
CREATE OR REPLACE FUNCTION public.can_download(_entity_type text, _entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule public.delivery_unlock_rule;
  override_flag boolean;
  bat_ok boolean := true;
  total_due numeric := 0;
  total_paid numeric := 0;
  any_installment_paid boolean := false;
BEGIN
  IF _entity_type = 'task' THEN
    SELECT delivery_unlock_rule, delivery_override
      INTO rule, override_flag
      FROM public.tasks WHERE id = _entity_id;
  ELSIF _entity_type = 'print_order' THEN
    SELECT delivery_unlock_rule, delivery_override, (bat_validated_at IS NOT NULL)
      INTO rule, override_flag, bat_ok
      FROM public.print_orders WHERE id = _entity_id;
  ELSIF _entity_type = 'logo_presentation' THEN
    SELECT delivery_unlock_rule, delivery_override
      INTO rule, override_flag
      FROM public.logo_presentations WHERE id = _entity_id;
  ELSE
    RETURN false;
  END IF;

  IF override_flag THEN RETURN true; END IF;
  IF _entity_type = 'print_order' AND NOT bat_ok THEN RETURN false; END IF;
  IF rule = 'libre' THEN RETURN true; END IF;

  -- aggregate installments across invoices linked to this entity
  IF _entity_type = 'task' THEN
    SELECT COALESCE(SUM(ii.amount),0), COALESCE(SUM(ii.paid_amount),0),
           bool_or(ii.paid_amount >= ii.amount AND ii.amount > 0)
      INTO total_due, total_paid, any_installment_paid
      FROM public.invoices i
      JOIN public.invoice_installments ii ON ii.invoice_id = i.id
      WHERE i.task_id = _entity_id;
  ELSIF _entity_type = 'print_order' THEN
    SELECT COALESCE(SUM(ii.amount),0), COALESCE(SUM(ii.paid_amount),0),
           bool_or(ii.paid_amount >= ii.amount AND ii.amount > 0)
      INTO total_due, total_paid, any_installment_paid
      FROM public.invoices i
      JOIN public.invoice_installments ii ON ii.invoice_id = i.id
      WHERE i.print_order_id = _entity_id;
  ELSE
    -- logo: link via client + matching invoice label? For now we fall back to override-only
    RETURN false;
  END IF;

  IF rule = 'acompte' THEN
    RETURN COALESCE(any_installment_paid, false);
  ELSIF rule = 'total' THEN
    RETURN total_due > 0 AND total_paid >= total_due;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_download(text, uuid) TO authenticated, anon;

-- 6. Logo deliverables bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logo-deliverables', 'logo-deliverables', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: admin full access
CREATE POLICY "admin manage logo-deliverables"
ON storage.objects FOR ALL
USING (bucket_id = 'logo-deliverables' AND public.is_admin())
WITH CHECK (bucket_id = 'logo-deliverables' AND public.is_admin());

-- Clients read their own logo deliverables (folder = logo_presentation_id)
CREATE POLICY "client read own logo-deliverables"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'logo-deliverables'
  AND EXISTS (
    SELECT 1 FROM public.logo_presentations lp
    JOIN public.clients c ON c.id = lp.client_id
    WHERE c.portal_user_id = auth.uid()
      AND lp.id::text = (storage.foldername(name))[1]
      AND public.can_download('logo_presentation', lp.id)
  )
);

-- 7. Update guards: prevent clients from changing delivery gating fields on tasks/print_orders
-- (existing guards on print_orders already block these new fields since they fail the column-equality check)
-- For print_orders, augment guard to include new columns
CREATE OR REPLACE FUNCTION public.print_orders_client_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

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
     NEW.products::text     IS DISTINCT FROM OLD.products::text     OR
     NEW.delivery_unlock_rule IS DISTINCT FROM OLD.delivery_unlock_rule OR
     NEW.delivery_override   IS DISTINCT FROM OLD.delivery_override   OR
     NEW.delivery_override_at IS DISTINCT FROM OLD.delivery_override_at OR
     NEW.delivery_override_by IS DISTINCT FROM OLD.delivery_override_by OR
     NEW.invoice_url         IS DISTINCT FROM OLD.invoice_url
  THEN
    RAISE EXCEPTION 'Clients can only update BAT validation fields on print_orders';
  END IF;

  RETURN NEW;
END;
$function$;
