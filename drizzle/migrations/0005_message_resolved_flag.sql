ALTER TABLE public.client_portal_messages ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_client_portal_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    'kind', m.kind, 'resolved', m.resolved
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
      'amount', o.amount, 'estimated_delivery_date', o.estimated_delivery_date
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
    'estimated_delivery_date', o.estimated_delivery_date,
    'payment_status', o.payment_status,
    'bat_validated_at', o.bat_validated_at,
    'products', o.products,
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