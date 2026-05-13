ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS invoice_file_path text;
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS invoice_file_path text;
ALTER TABLE public.logo_presentations ADD COLUMN IF NOT EXISTS invoice_file_path text;

-- update client guard for print_orders to allow new column to be admin-only
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
     NEW.invoice_url         IS DISTINCT FROM OLD.invoice_url        OR
     NEW.invoice_file_path   IS DISTINCT FROM OLD.invoice_file_path
  THEN
    RAISE EXCEPTION 'Clients can only update BAT validation fields on print_orders';
  END IF;

  RETURN NEW;
END;
$function$;