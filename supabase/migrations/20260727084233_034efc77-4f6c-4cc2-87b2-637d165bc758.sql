ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS delivery_locked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.portal_deliverables_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.client_portals;
  files JSONB;
  unlocked BOOLEAN;
  out_files JSONB;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true;
  IF p.id IS NULL THEN RETURN NULL; END IF;

  unlocked := (NOT COALESCE(p.delivery_locked, false)) AND (
       p.delivery_override
    OR p.status = 'delivered'
    OR p.admin_confirmed_paid_at IS NOT NULL
    OR p.delivery_unlock_rule = 'libre');

  IF p.entity_type = 'task' THEN
    SELECT deliverable_files INTO files FROM public.tasks WHERE id = p.entity_id;
  ELSE
    SELECT deliverable_files INTO files FROM public.projects WHERE id = p.entity_id;
  END IF;
  files := COALESCE(files, '[]'::jsonb);

  SELECT COALESCE(jsonb_agg(
    CASE WHEN unlocked THEN
      jsonb_build_object('name', f->>'name', 'url', f->>'url', 'preview_url', f->>'url')
    ELSE
      jsonb_build_object('name', f->>'name', 'preview_url', f->>'url')
    END
  ), '[]'::jsonb) INTO out_files
  FROM jsonb_array_elements(files) f;

  RETURN jsonb_build_object(
    'unlocked', unlocked,
    'files', out_files,
    'reviews', COALESCE(p.deliverable_reviews, '[]'::jsonb)
  );
END;
$function$;