
ALTER TABLE public.bats
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS bats_share_token_key ON public.bats(share_token);

CREATE OR REPLACE FUNCTION public.bats_client_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title OR
     NEW.reference IS DISTINCT FROM OLD.reference OR
     NEW.client_id IS DISTINCT FROM OLD.client_id OR
     NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.quantity IS DISTINCT FROM OLD.quantity OR
     NEW.models_count IS DISTINCT FROM OLD.models_count OR
     NEW.format IS DISTINCT FROM OLD.format OR
     NEW.support IS DISTINCT FROM OLD.support OR
     NEW.finitions IS DISTINCT FROM OLD.finitions OR
     NEW.colors IS DISTINCT FROM OLD.colors OR
     NEW.observations IS DISTINCT FROM OLD.observations OR
     NEW.printed_face IS DISTINCT FROM OLD.printed_face OR
     NEW.corners IS DISTINCT FROM OLD.corners OR
     NEW.lamination IS DISTINCT FROM OLD.lamination OR
     NEW.hot_foil IS DISTINCT FROM OLD.hot_foil OR
     NEW.foil_color IS DISTINCT FROM OLD.foil_color OR
     NEW.file_path IS DISTINCT FROM OLD.file_path OR
     NEW.price_tiers::text IS DISTINCT FROM OLD.price_tiers::text OR
     NEW.pricing_text IS DISTINCT FROM OLD.pricing_text OR
     NEW.share_token IS DISTINCT FROM OLD.share_token OR
     NEW.is_published IS DISTINCT FROM OLD.is_published
  THEN
    RAISE EXCEPTION 'Clients cannot modify BAT details';
  END IF;
  RETURN NEW;
END;
$function$;
