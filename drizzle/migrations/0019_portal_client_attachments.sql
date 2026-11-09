ALTER TABLE public.client_portal_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Admins read client uploads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-uploads' AND public.is_admin());
CREATE POLICY "Admins delete client uploads" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-uploads' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.portal_clean_attachments(_portal_id uuid, _att jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE out_arr jsonb := '[]'::jsonb; a jsonb; pth text; nm text;
BEGIN
  IF _att IS NULL OR jsonb_typeof(_att) <> 'array' THEN RETURN '[]'::jsonb; END IF;
  IF jsonb_array_length(_att) > 10 THEN RAISE EXCEPTION 'Trop de fichiers (10 maximum)'; END IF;
  FOR a IN SELECT * FROM jsonb_array_elements(_att) LOOP
    pth := a->>'path'; nm := left(COALESCE(NULLIF(a->>'name',''), 'fichier'), 200);
    IF pth IS NULL OR position(_portal_id::text || '/' in pth) <> 1 OR pth LIKE '%..%' THEN
      RAISE EXCEPTION 'Fichier invalide';
    END IF;
    out_arr := out_arr || jsonb_build_array(jsonb_build_object('path', pth, 'name', nm, 'size', COALESCE((a->>'size')::bigint, 0)));
  END LOOP;
  RETURN out_arr;
END; $$;

CREATE OR REPLACE FUNCTION public.portal_action_by_token(_token text, _action text, _payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p public.client_portals; reason TEXT; body TEXT; fname TEXT; note TEXT; reviews JSONB;
  signer TEXT; cert TEXT; att JSONB;
BEGIN
  SELECT * INTO p FROM public.client_portals WHERE share_token = _token AND is_published = true FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Portail introuvable'; END IF;
  att := public.portal_clean_attachments(p.id, _payload->'attachments');

  IF _action = 'validate' THEN
    IF p.status NOT IN ('draft','awaiting_validation') THEN RAISE EXCEPTION 'Portail déjà traité'; END IF;
    UPDATE public.client_portals SET status = 'validated', client_validated_at = now() WHERE id = p.id;
  ELSIF _action = 'refuse' THEN
    reason := NULLIF(_payload->>'reason', '');
    UPDATE public.client_portals SET status = 'refused', client_refused_at = now(), refusal_reason = reason WHERE id = p.id;
  ELSIF _action = 'request_payment_link' THEN
    IF p.status NOT IN ('validated','payment_pending','payment_link_requested') THEN RAISE EXCEPTION 'Validation requise avant paiement'; END IF;
    UPDATE public.client_portals SET status = 'payment_link_requested', payment_method_requested = 'link' WHERE id = p.id;
  ELSIF _action = 'choose_transfer' THEN
    IF p.status NOT IN ('validated','payment_pending','payment_link_requested') THEN RAISE EXCEPTION 'Validation requise avant paiement'; END IF;
    UPDATE public.client_portals SET status = 'payment_pending', payment_method_requested = 'transfer' WHERE id = p.id;
  ELSIF _action = 'declare_paid' THEN
    UPDATE public.client_portals SET client_declared_paid_at = now(), client_declared_paid_note = NULLIF(_payload->>'note',''),
      status = CASE WHEN status IN ('validated','payment_pending','payment_link_requested') THEN 'payment_pending'::public.client_portal_status ELSE status END
      WHERE id = p.id;
  ELSIF _action IN ('approve_file','request_changes') THEN
    fname := NULLIF(_payload->>'file','');
    IF fname IS NULL THEN RAISE EXCEPTION 'Fichier manquant'; END IF;
    note := NULLIF(_payload->>'note','');
    IF _action = 'request_changes' AND note IS NULL THEN RAISE EXCEPTION 'Observation requise'; END IF;
    IF note IS NOT NULL AND length(note) > 4000 THEN RAISE EXCEPTION 'Observation trop longue'; END IF;
    IF _action = 'approve_file' THEN
      signer := left(trim(COALESCE(_payload->>'signed_by','')), 100);
      IF signer = '' THEN RAISE EXCEPTION 'Signature requise'; END IF;
      IF COALESCE((_payload->>'checks')::int, 0) < 3 THEN RAISE EXCEPTION 'Tous les points de contrôle doivent être cochés'; END IF;
      cert := 'BAT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(p.id::text || fname || now()::text),1,8));
      att := '[]'::jsonb;
    END IF;
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO reviews
      FROM jsonb_array_elements(COALESCE(p.deliverable_reviews, '[]'::jsonb)) r WHERE r->>'file' IS DISTINCT FROM fname;
    reviews := reviews || jsonb_strip_nulls(jsonb_build_object(
      'file', fname,
      'status', CASE WHEN _action = 'approve_file' THEN 'approved' ELSE 'changes_requested' END,
      'note', note, 'at', now(), 'signed_by', signer, 'certificate_id', cert,
      'user_agent', left(NULLIF(_payload->>'user_agent',''), 300)));
    UPDATE public.client_portals SET deliverable_reviews = reviews WHERE id = p.id;
    INSERT INTO public.client_portal_messages(portal_id, author, body, kind, attachments)
    VALUES (p.id, 'client', CASE WHEN _action = 'approve_file'
        THEN 'BAT signé par ' || signer || ' : ' || fname || ' (certificat ' || cert || ')'
        ELSE 'Modification demandée sur « ' || fname || ' » : ' || note END, _action, att);
  ELSIF _action = 'add_message' THEN
    body := NULLIF(trim(COALESCE(_payload->>'body','')),'');
    IF body IS NULL AND jsonb_array_length(att) = 0 THEN RAISE EXCEPTION 'Message vide'; END IF;
    IF body IS NOT NULL AND length(body) > 4000 THEN RAISE EXCEPTION 'Message trop long'; END IF;
    IF body IS NULL THEN
      body := jsonb_array_length(att)::text || CASE WHEN jsonb_array_length(att) > 1 THEN ' fichiers joints' ELSE ' fichier joint' END;
    END IF;
    INSERT INTO public.client_portal_messages(portal_id, author, body, attachments) VALUES (p.id, 'client', body, att);
  ELSE
    RAISE EXCEPTION 'Action invalide';
  END IF;
  INSERT INTO public.client_portal_events(portal_id, kind, payload) VALUES (p.id, _action, COALESCE(_payload, '{}'::jsonb));
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_client_portal_by_token(_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p public.client_portals;
  entity JSONB;
  client_row JSONB;
  msgs JSONB;
  bats_json JSONB;
  po_json JSONB;
  linked_po JSONB;
  linked_pos JSONB := '[]'::jsonb;
  invoices_json JSONB;
  subtasks_json JSONB;
  tasks_json JSONB;
  tasks_total NUMERIC;
  pay JSONB;
  invoice_doc JSONB;
  ent_invoice_url TEXT;
  ent_invoice_path TEXT;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true LIMIT 1;
  IF p.id IS NULL THEN RETURN NULL; END IF;

  tasks_json := '[]'::jsonb;
  tasks_total := 0;

  IF p.entity_type = 'task' THEN
    SELECT to_jsonb(t), t.invoice_url, t.invoice_file_path
      INTO entity, ent_invoice_url, ent_invoice_path
      FROM public.tasks t WHERE t.id = p.entity_id;
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

    WITH t AS (
      SELECT
        tk.id, tk.title, tk.status, tk.prestation, tk.billing_type, tk.deadline,
        tk.flat_amount, tk.hourly_rate, tk.estimated_minutes, tk.total_minutes,
        tk.client_revisions_count, tk.free_revisions, tk.extra_revision_rate,
        tk.position, tk.created_at,
        GREATEST(0, COALESCE(tk.client_revisions_count,0) - COALESCE(tk.free_revisions,0)) AS extra_revisions,
        CASE
          WHEN tk.billing_type = 'horaire'
            THEN ROUND(COALESCE(tk.total_minutes,0)::numeric / 60 * COALESCE(tk.hourly_rate,0), 2)
          ELSE COALESCE(tk.flat_amount,0)
        END
        + GREATEST(0, COALESCE(tk.client_revisions_count,0) - COALESCE(tk.free_revisions,0))
          * COALESCE(tk.extra_revision_rate,0) AS amount_ht
      FROM public.tasks tk
      WHERE tk.project_id = p.entity_id
        AND tk.status <> 'archive'
    )
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'status', t.status, 'prestation', t.prestation,
        'billing_type', t.billing_type, 'deadline', t.deadline,
        'flat_amount', t.flat_amount, 'hourly_rate', t.hourly_rate,
        'estimated_minutes', t.estimated_minutes, 'total_minutes', t.total_minutes,
        'client_revisions_count', t.client_revisions_count,
        'free_revisions', t.free_revisions,
        'extra_revision_rate', t.extra_revision_rate,
        'extra_revisions', t.extra_revisions,
        'amount_ht', t.amount_ht
      ) ORDER BY t.position, t.created_at), '[]'::jsonb),
      COALESCE(SUM(t.amount_ht), 0)
    INTO tasks_json, tasks_total
    FROM t;
  END IF;

  IF p.client_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)
      INTO client_row FROM public.clients c WHERE c.id = p.client_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'author', m.author, 'body', m.body, 'created_at', m.created_at,
    'kind', m.kind, 'resolved', m.resolved, 'attachments', m.attachments
  ) ORDER BY m.created_at), '[]'::jsonb) INTO msgs
  FROM public.client_portal_messages m WHERE m.portal_id = p.id;

  IF p.entity_type = 'project' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', b.id, 'title', b.title, 'status', b.status,
      'share_token', b.share_token, 'is_published', b.is_published
    )), '[]'::jsonb) INTO bats_json
    FROM public.bats b WHERE b.project_id = p.entity_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', o.id, 'description', o.description, 'status', o.status,
      'amount', o.amount, 'estimated_delivery_date', o.estimated_delivery_date, 'delivery_location', o.delivery_location
    )), '[]'::jsonb) INTO po_json
    FROM public.print_orders o WHERE o.project_id = p.entity_id;
  ELSE
    bats_json := '[]'::jsonb;
    po_json := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id, 'reference', o.reference, 'description', o.description,
    'status', o.status, 'amount', o.amount, 'quantity', o.quantity,
    'format', o.format, 'grammage', o.grammage, 'support', o.support,
    'colors', o.colors, 'finitions', o.finitions, 'observations', o.observations,
    'estimated_delivery_date', o.estimated_delivery_date, 'delivery_location', o.delivery_location,
    'payment_status', o.payment_status,
    'bat_validated_at', o.bat_validated_at,
    'products', o.products, 'price_tiers', o.price_tiers,
    'invoice_url', o.invoice_url
  ) ORDER BY o.created_at), '[]'::jsonb) INTO linked_pos
  FROM public.print_orders o
  WHERE o.id = ANY (
    CASE WHEN COALESCE(array_length(p.print_order_ids, 1), 0) > 0
      THEN p.print_order_ids
      ELSE ARRAY[p.print_order_id]::uuid[] END
  );
  IF jsonb_array_length(linked_pos) > 0 THEN linked_po := linked_pos->0; END IF;

  IF p.entity_type = 'task' THEN
    invoice_doc := jsonb_build_object(
      'url', ent_invoice_url,
      'has_file', ent_invoice_path IS NOT NULL,
      'file_path', ent_invoice_path
    );
  ELSE
    invoice_doc := jsonb_build_object('url', NULL, 'has_file', false, 'file_path', NULL);
  END IF;
  IF (invoice_doc->>'url') IS NULL AND (invoice_doc->>'file_path') IS NULL AND linked_po IS NOT NULL THEN
    invoice_doc := jsonb_build_object('url', linked_po->>'invoice_url', 'has_file', false, 'file_path', NULL);
  END IF;

  SELECT jsonb_build_object(
    'iban', ps.iban, 'bic', ps.bic, 'account_holder', ps.account_holder,
    'bank_name', ps.bank_name, 'transfer_note', ps.transfer_note
  ) INTO pay FROM public.payment_settings ps WHERE ps.id = 1;
  pay := COALESCE(pay, '{}'::jsonb);

  RETURN jsonb_build_object(
    'portal', to_jsonb(p),
    'entity', entity,
    'client', client_row,
    'messages', msgs,
    'subtasks', subtasks_json,
    'tasks', tasks_json,
    'tasks_total_ht', tasks_total,
    'bats', bats_json,
    'print_orders', po_json,
    'print_order', linked_po,
    'linked_print_orders', linked_pos,
    'invoice_doc', invoice_doc,
    'invoices', invoices_json,
    'payment_settings', pay
  );
END;
$function$;