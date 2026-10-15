-- Les validations BAT et les observations de fichier envoient déjà une notification dédiée
-- ("Document validé par le client" / "Modification demandée par le client") via client_portal_events.
-- On marque donc ces messages système avec un kind spécifique et on ne duplique plus
-- la notification "Nouveau message client".

CREATE OR REPLACE FUNCTION public.portal_action_by_token(_token text, _action text, _payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.client_portals; reason TEXT; body TEXT; fname TEXT; note TEXT; reviews JSONB;
  signer TEXT; cert TEXT;
BEGIN
  SELECT * INTO p FROM public.client_portals WHERE share_token = _token AND is_published = true FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Portail introuvable'; END IF;

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
    END IF;
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO reviews
      FROM jsonb_array_elements(COALESCE(p.deliverable_reviews, '[]'::jsonb)) r WHERE r->>'file' IS DISTINCT FROM fname;
    reviews := reviews || jsonb_strip_nulls(jsonb_build_object(
      'file', fname,
      'status', CASE WHEN _action = 'approve_file' THEN 'approved' ELSE 'changes_requested' END,
      'note', note, 'at', now(), 'signed_by', signer, 'certificate_id', cert,
      'user_agent', left(NULLIF(_payload->>'user_agent',''), 300)));
    UPDATE public.client_portals SET deliverable_reviews = reviews WHERE id = p.id;
    INSERT INTO public.client_portal_messages(portal_id, author, body, kind)
    VALUES (p.id, 'client', CASE WHEN _action = 'approve_file'
        THEN 'BAT signé par ' || signer || ' : ' || fname || ' (certificat ' || cert || ')'
        ELSE 'Modification demandée sur « ' || fname || ' » : ' || note END, _action);
  ELSIF _action = 'add_message' THEN
    body := NULLIF(_payload->>'body','');
    IF body IS NULL THEN RAISE EXCEPTION 'Message vide'; END IF;
    IF length(body) > 4000 THEN RAISE EXCEPTION 'Message trop long'; END IF;
    INSERT INTO public.client_portal_messages(portal_id, author, body) VALUES (p.id, 'client', body);
  ELSE
    RAISE EXCEPTION 'Action invalide';
  END IF;
  INSERT INTO public.client_portal_events(portal_id, kind, payload) VALUES (p.id, _action, COALESCE(_payload, '{}'::jsonb));
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admins_on_portal_client_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_id UUID;
  label TEXT;
BEGIN
  IF NEW.author IS DISTINCT FROM 'client' THEN RETURN NEW; END IF;

  -- Messages système générés par une validation BAT ou une observation de fichier :
  -- une notification dédiée existe déjà ("Document validé par le client" /
  -- "Modification demandée par le client"), on n'envoie pas de doublon.
  IF NEW.kind IN ('approve_file','request_changes') THEN RETURN NEW; END IF;

  SELECT COALESCE(c.name, 'Un client') INTO label
    FROM public.client_portals p
    LEFT JOIN public.clients c ON c.id = p.client_id
   WHERE p.id = NEW.portal_id;

  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (
      admin_id,
      'portal_client_message',
      'Nouveau message client',
      COALESCE(label, 'Un client') || ' : ' || left(NEW.body, 180),
      '/portails/' || NEW.portal_id,
      'client_portal',
      NEW.portal_id
    );
  END LOOP;
  RETURN NEW;
END;
$function$;