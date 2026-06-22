
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: notify all admins when client validates/refuses a request
CREATE OR REPLACE FUNCTION public.notify_admins_on_client_request_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id UUID;
  notif_kind TEXT;
  notif_title TEXT;
  notif_body TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'validee' THEN
    notif_kind := 'client_request_validated';
    notif_title := 'Demande validée par le client';
    notif_body := COALESCE(NEW.title, NEW.client_name_snapshot, 'Demande client');
  ELSIF NEW.status = 'refusee' THEN
    notif_kind := 'client_request_refused';
    notif_title := 'Demande refusée par le client';
    notif_body := COALESCE(NEW.title, NEW.client_name_snapshot, 'Demande client')
      || CASE WHEN NEW.client_refusal_reason IS NOT NULL THEN ' — ' || NEW.client_refusal_reason ELSE '' END;
  ELSE
    RETURN NEW;
  END IF;

  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (admin_id, notif_kind, notif_title, notif_body, '/demandes', 'client_request', NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_client_request_decision
  AFTER UPDATE OF status ON public.client_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_client_request_decision();
