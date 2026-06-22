ALTER TABLE public.bats ADD COLUMN IF NOT EXISTS price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.bats_client_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     NEW.colors           IS DISTINCT FROM OLD.colors           OR
     NEW.price_tiers::text IS DISTINCT FROM OLD.price_tiers::text
  THEN
    RAISE EXCEPTION 'Clients can only update BAT validation fields on bats';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text NOT IN ('valide', 'refuse') THEN
      RAISE EXCEPTION 'Clients can only set BAT status to validated or rejected';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;