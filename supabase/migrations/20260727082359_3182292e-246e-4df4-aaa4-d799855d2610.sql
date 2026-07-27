ALTER TABLE public.client_portals
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT ARRAY['link','transfer']::text[],
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS amount_due_ttc numeric,
  ADD COLUMN IF NOT EXISTS print_order_id uuid REFERENCES public.print_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deliverable_reviews jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.client_portals
  DROP CONSTRAINT IF EXISTS client_portals_payment_terms_check;
ALTER TABLE public.client_portals
  ADD CONSTRAINT client_portals_payment_terms_check CHECK (payment_terms IN ('deposit_50','full','libre'));

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
  invoices_json JSONB;
  subtasks_json JSONB;
  pay JSONB;
  invoice_doc JSONB;
  ent_invoice_url TEXT;
  ent_invoice_path TEXT;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true LIMIT 1;
  IF p.id IS NULL THEN RETURN NULL; END IF;

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
  END IF;

  IF p.client_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)
      INTO client_row FROM public.clients c WHERE c.id = p.client_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'author', m.author, 'body', m.body, 'created_at', m.created_at
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

  -- Commande d'impression liée explicitement au portail
  IF p.print_order_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', o.id, 'reference', o.reference, 'description', o.description,
      'status', o.status, 'amount', o.amount, 'quantity', o.quantity,
      'format', o.format, 'grammage', o.grammage, 'support', o.support,
      'colors', o.colors, 'finitions', o.finitions, 'observations', o.observations,
      'estimated_delivery_date', o.estimated_delivery_date,
      'payment_status', o.payment_status,
      'bat_validated_at', o.bat_validated_at,
      'products', o.products,
      'invoice_url', o.invoice_url
    ) INTO linked_po
    FROM public.print_orders o WHERE o.id = p.print_order_id;
  END IF;

  -- Facture (lien externe ou PDF stocké)
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
    'print_order', linked_po,
    'invoice_doc', invoice_doc,
    'invoices', invoices_json,
    'payment_settings', pay
  );
END;
$function$;

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

  unlocked := p.delivery_override
    OR p.status = 'delivered'
    OR p.admin_confirmed_paid_at IS NOT NULL
    OR p.delivery_unlock_rule = 'libre';

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

CREATE OR REPLACE FUNCTION public.portal_action_by_token(_token text, _action text, _payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.client_portals;
  reason TEXT;
  body TEXT;
  fname TEXT;
  note TEXT;
  reviews JSONB;
BEGIN
  SELECT * INTO p FROM public.client_portals
    WHERE share_token = _token AND is_published = true FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Portail introuvable'; END IF;

  IF _action = 'validate' THEN
    IF p.status NOT IN ('draft','awaiting_validation') THEN
      RAISE EXCEPTION 'Portail déjà traité';
    END IF;
    UPDATE public.client_portals
      SET status = 'validated', client_validated_at = now()
      WHERE id = p.id;

  ELSIF _action = 'refuse' THEN
    reason := NULLIF(_payload->>'reason', '');
    UPDATE public.client_portals
      SET status = 'refused', client_refused_at = now(), refusal_reason = reason
      WHERE id = p.id;

  ELSIF _action = 'request_payment_link' THEN
    IF p.status NOT IN ('validated','payment_pending','payment_link_requested') THEN
      RAISE EXCEPTION 'Validation requise avant paiement';
    END IF;
    UPDATE public.client_portals
      SET status = 'payment_link_requested', payment_method_requested = 'link'
      WHERE id = p.id;

  ELSIF _action = 'choose_transfer' THEN
    IF p.status NOT IN ('validated','payment_pending','payment_link_requested') THEN
      RAISE EXCEPTION 'Validation requise avant paiement';
    END IF;
    UPDATE public.client_portals
      SET status = 'payment_pending', payment_method_requested = 'transfer'
      WHERE id = p.id;

  ELSIF _action = 'declare_paid' THEN
    UPDATE public.client_portals
      SET client_declared_paid_at = now(),
          client_declared_paid_note = NULLIF(_payload->>'note',''),
          status = CASE WHEN status IN ('validated','payment_pending','payment_link_requested')
                        THEN 'payment_pending'::public.client_portal_status
                        ELSE status END
      WHERE id = p.id;

  ELSIF _action IN ('approve_file','request_changes') THEN
    fname := NULLIF(_payload->>'file','');
    IF fname IS NULL THEN RAISE EXCEPTION 'Fichier manquant'; END IF;
    note := NULLIF(_payload->>'note','');
    IF _action = 'request_changes' AND note IS NULL THEN
      RAISE EXCEPTION 'Observation requise';
    END IF;
    IF note IS NOT NULL AND length(note) > 4000 THEN RAISE EXCEPTION 'Observation trop longue'; END IF;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO reviews
      FROM jsonb_array_elements(COALESCE(p.deliverable_reviews, '[]'::jsonb)) r
     WHERE r->>'file' IS DISTINCT FROM fname;

    reviews := reviews || jsonb_build_object(
      'file', fname,
      'status', CASE WHEN _action = 'approve_file' THEN 'approved' ELSE 'changes_requested' END,
      'note', note,
      'at', now()
    );

    UPDATE public.client_portals SET deliverable_reviews = reviews WHERE id = p.id;

    INSERT INTO public.client_portal_messages(portal_id, author, body)
    VALUES (p.id, 'client',
      CASE WHEN _action = 'approve_file'
        THEN 'Document validé : ' || fname
        ELSE 'Modification demandée sur « ' || fname || ' » : ' || note END);

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
$function$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_portal_file_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_id UUID;
BEGIN
  IF NEW.kind NOT IN ('approve_file','request_changes') THEN RETURN NEW; END IF;
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (
      admin_id,
      NEW.kind,
      CASE WHEN NEW.kind = 'approve_file' THEN 'Document validé par le client' ELSE 'Modification demandée par le client' END,
      COALESCE(NEW.payload->>'file','Document') || COALESCE(' — ' || (NEW.payload->>'note'), ''),
      '/portails/' || NEW.portal_id,
      'client_portal',
      NEW.portal_id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_portal_file_review ON public.client_portal_events;
CREATE TRIGGER trg_notify_portal_file_review
AFTER INSERT ON public.client_portal_events
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_portal_file_review();