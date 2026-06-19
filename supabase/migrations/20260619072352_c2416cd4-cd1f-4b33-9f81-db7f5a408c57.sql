-- Ajouter la colonne prestation_type
ALTER TABLE public.client_requests ADD COLUMN prestation_type text;

-- Supprimer la colonne channel
ALTER TABLE public.client_requests DROP COLUMN IF EXISTS channel;

-- Mettre à jour la fonction get_client_request_by_token
CREATE OR REPLACE FUNCTION public.get_client_request_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  r public.client_requests;
  msgs jsonb;
  proj jsonb;
  task jsonb;
  ord jsonb;
  invs jsonb;
BEGIN
  SELECT * INTO r FROM public.client_requests
   WHERE share_token = _token AND is_published = true LIMIT 1;
  IF r.id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'author',m.author,'body',m.body,'created_at',m.created_at) ORDER BY m.created_at), '[]'::jsonb)
    INTO msgs FROM public.client_request_messages m WHERE m.request_id = r.id;

  IF r.converted_project_id IS NOT NULL THEN
    SELECT to_jsonb(p) INTO proj FROM public.projects p WHERE p.id = r.converted_project_id;
  END IF;
  IF r.converted_task_id IS NOT NULL THEN
    SELECT to_jsonb(t) INTO task FROM public.tasks t WHERE t.id = r.converted_task_id;
  END IF;
  IF r.converted_print_order_id IS NOT NULL THEN
    SELECT to_jsonb(o) INTO ord FROM public.print_orders o WHERE o.id = r.converted_print_order_id;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO invs
    FROM public.invoices i
   WHERE (r.converted_task_id IS NOT NULL AND i.task_id = r.converted_task_id)
      OR (r.converted_print_order_id IS NOT NULL AND i.print_order_id = r.converted_print_order_id);

  RETURN jsonb_build_object(
    'request', to_jsonb(r),
    'messages', msgs,
    'project', proj,
    'task', task,
    'print_order', ord,
    'invoices', invs
  );
END;
$function$;