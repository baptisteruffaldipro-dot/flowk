ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS has_unread_client_activity boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS has_unread_client_activity boolean NOT NULL DEFAULT false;
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS has_unread_client_activity boolean NOT NULL DEFAULT false;
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS selected_tier jsonb;
ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS print_selections jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.mark_portal_unread(_portal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.client_portals;
BEGIN
  SELECT * INTO p FROM public.client_portals WHERE id = _portal_id;
  IF p.id IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.portal_action', '1', true);
  IF p.entity_type = 'task' THEN
    UPDATE public.tasks SET has_unread_client_activity = true WHERE id = p.entity_id;
  ELSE
    UPDATE public.projects SET has_unread_client_activity = true WHERE id = p.entity_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_portal_msg_unread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.author = 'client' THEN PERFORM public.mark_portal_unread(NEW.portal_id); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_portal_msg_unread ON public.client_portal_messages;
CREATE TRIGGER trg_portal_msg_unread AFTER INSERT ON public.client_portal_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_portal_msg_unread();

CREATE OR REPLACE FUNCTION public.trg_portal_event_unread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.mark_portal_unread(NEW.portal_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_portal_event_unread ON public.client_portal_events;
CREATE TRIGGER trg_portal_event_unread AFTER INSERT ON public.client_portal_events
FOR EACH ROW EXECUTE FUNCTION public.trg_portal_event_unread();

CREATE OR REPLACE FUNCTION public.print_orders_client_update_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin() OR current_setting('app.portal_action', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.description IS DISTINCT FROM OLD.description OR NEW.status IS DISTINCT FROM OLD.status OR
     NEW.amount IS DISTINCT FROM OLD.amount OR NEW.total_minutes IS DISTINCT FROM OLD.total_minutes OR
     NEW.bat_file_path IS DISTINCT FROM OLD.bat_file_path OR NEW.bat_uploaded_at IS DISTINCT FROM OLD.bat_uploaded_at OR
     NEW.deliverables::text IS DISTINCT FROM OLD.deliverables::text OR NEW.reference IS DISTINCT FROM OLD.reference OR
     NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.format IS DISTINCT FROM OLD.format OR
     NEW.grammage IS DISTINCT FROM OLD.grammage OR NEW.support IS DISTINCT FROM OLD.support OR
     NEW.colors IS DISTINCT FROM OLD.colors OR NEW.finitions IS DISTINCT FROM OLD.finitions OR
     NEW.observations IS DISTINCT FROM OLD.observations OR NEW.estimated_delivery_date IS DISTINCT FROM OLD.estimated_delivery_date OR
     NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.products::text IS DISTINCT FROM OLD.products::text OR
     NEW.delivery_unlock_rule IS DISTINCT FROM OLD.delivery_unlock_rule OR NEW.delivery_override IS DISTINCT FROM OLD.delivery_override OR
     NEW.delivery_override_at IS DISTINCT FROM OLD.delivery_override_at OR NEW.delivery_override_by IS DISTINCT FROM OLD.delivery_override_by OR
     NEW.invoice_url IS DISTINCT FROM OLD.invoice_url OR NEW.invoice_file_path IS DISTINCT FROM OLD.invoice_file_path OR
     NEW.selected_tier::text IS DISTINCT FROM OLD.selected_tier::text
  THEN
    RAISE EXCEPTION 'Clients can only update BAT validation fields on print_orders';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_choose_quantity_by_token(_token text, _print_order_id uuid, _quantity numeric, _price numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  p public.client_portals;
  o public.print_orders;
  tier_ok boolean;
  admin_id uuid;
BEGIN
  SELECT * INTO p FROM public.client_portals WHERE share_token = _token AND is_published = true FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Portail introuvable'; END IF;
  IF NOT (_print_order_id = ANY (COALESCE(p.print_order_ids, '{}'::uuid[])) OR _print_order_id = p.print_order_id) THEN
    RAISE EXCEPTION 'Commande non liée à ce portail';
  END IF;
  SELECT * INTO o FROM public.print_orders WHERE id = _print_order_id;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(o.price_tiers,'[]'::jsonb)) t
    WHERE (t->>'quantity')::numeric = _quantity AND (t->>'price')::numeric = _price) INTO tier_ok;
  IF NOT tier_ok THEN RAISE EXCEPTION 'Tarif invalide'; END IF;

  PERFORM set_config('app.portal_action', '1', true);
  UPDATE public.print_orders
     SET selected_tier = jsonb_build_object('quantity', _quantity, 'price', _price, 'at', now()),
         quantity = _quantity::int, amount = _price, has_unread_client_activity = true
   WHERE id = _print_order_id;
  UPDATE public.client_portals
     SET print_selections = COALESCE(print_selections,'{}'::jsonb) || jsonb_build_object(_print_order_id::text, jsonb_build_object('quantity', _quantity, 'price', _price))
   WHERE id = p.id;
  INSERT INTO public.client_portal_events(portal_id, kind, payload)
  VALUES (p.id, 'choose_quantity', jsonb_build_object('print_order_id', _print_order_id, 'quantity', _quantity, 'price', _price));

  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (admin_id, 'print_quantity_chosen', 'Quantité choisie par le client',
      COALESCE(o.description,'Commande') || ' — ' || _quantity::int || ' ex. à ' || _price || ' € HT',
      '/impressions/' || _print_order_id, 'print_order', _print_order_id);
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.portal_choose_quantity_by_token(text, uuid, numeric, numeric) TO anon, authenticated;