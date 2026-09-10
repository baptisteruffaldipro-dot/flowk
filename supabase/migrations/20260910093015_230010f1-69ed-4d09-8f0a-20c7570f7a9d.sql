CREATE OR REPLACE FUNCTION public.notify_admins_on_portal_client_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  label TEXT;
BEGIN
  IF NEW.author IS DISTINCT FROM 'client' THEN RETURN NEW; END IF;

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
$$;

DROP TRIGGER IF EXISTS trg_notify_portal_client_message ON public.client_portal_messages;
CREATE TRIGGER trg_notify_portal_client_message
AFTER INSERT ON public.client_portal_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_portal_client_message();