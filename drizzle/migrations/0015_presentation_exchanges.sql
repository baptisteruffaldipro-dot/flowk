CREATE TABLE public.presentation_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 brand_strategy_id uuid REFERENCES public.brand_strategies(id) ON DELETE CASCADE,
 logo_presentation_id uuid REFERENCES public.logo_presentations(id) ON DELETE CASCADE,
 author text NOT NULL CHECK (author IN ('client','studio')),
 body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT one_presentation CHECK (num_nonnulls(brand_strategy_id, logo_presentation_id) = 1)
);
GRANT SELECT, INSERT ON public.presentation_messages TO authenticated;
GRANT ALL ON public.presentation_messages TO service_role;
ALTER TABLE public.presentation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_messages ON public.presentation_messages FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY admin_send_messages ON public.presentation_messages FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND author = 'studio');
CREATE INDEX presentation_messages_brand_idx ON public.presentation_messages(brand_strategy_id, created_at);
CREATE INDEX presentation_messages_logo_idx ON public.presentation_messages(logo_presentation_id, created_at);
CREATE FUNCTION public.presentation_exchange_by_token(_kind text, _token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; msgs jsonb; reactions jsonb := '{}'::jsonb;
BEGIN
 IF _kind = 'brand_strategy' THEN
  SELECT id INTO pid FROM public.brand_strategies WHERE share_token = _token AND is_published = true;
 ELSIF _kind = 'logo_presentation' THEN
  SELECT id, client_selections INTO pid, reactions FROM public.logo_presentations WHERE share_token = _token AND is_published = true;
 ELSE RAISE EXCEPTION 'Présentation invalide'; END IF;
 IF pid IS NULL THEN RAISE EXCEPTION 'Présentation introuvable ou non publiée'; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',m.id,'author',m.author,'body',m.body,'created_at',m.created_at) ORDER BY m.created_at, m.id),'[]'::jsonb) INTO msgs
 FROM public.presentation_messages m WHERE (_kind = 'brand_strategy' AND m.brand_strategy_id = pid) OR (_kind = 'logo_presentation' AND m.logo_presentation_id = pid);
 RETURN jsonb_build_object('messages',msgs,'reactions',COALESCE(reactions,'{}'::jsonb));
END; $$;
CREATE FUNCTION public.presentation_add_message_by_token(_kind text, _token text, _body text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
 IF _body IS NULL OR length(trim(_body)) = 0 OR length(_body) > 4000 THEN RAISE EXCEPTION 'Message invalide'; END IF;
 IF _kind = 'brand_strategy' THEN
  SELECT id INTO pid FROM public.brand_strategies WHERE share_token = _token AND is_published = true;
 ELSIF _kind = 'logo_presentation' THEN
  SELECT id INTO pid FROM public.logo_presentations WHERE share_token = _token AND is_published = true;
 ELSE RAISE EXCEPTION 'Présentation invalide'; END IF;
 IF pid IS NULL THEN RAISE EXCEPTION 'Présentation introuvable ou non publiée'; END IF;
 INSERT INTO public.presentation_messages(brand_strategy_id, logo_presentation_id, author, body)
 VALUES (CASE WHEN _kind = 'brand_strategy' THEN pid END, CASE WHEN _kind = 'logo_presentation' THEN pid END, 'client', trim(_body));
 RETURN jsonb_build_object('ok',true);
END; $$;
REVOKE ALL ON FUNCTION public.presentation_exchange_by_token(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presentation_add_message_by_token(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.presentation_exchange_by_token(text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.presentation_add_message_by_token(text,text,text) TO anon, authenticated, service_role;
CREATE FUNCTION public.notify_presentation_client_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text; dest text; kind text; pid uuid;
BEGIN
 IF NEW.author <> 'client' THEN RETURN NEW; END IF;
 IF NEW.brand_strategy_id IS NOT NULL THEN
  pid := NEW.brand_strategy_id; kind := 'brand_strategy'; dest := '/strategie/' || pid;
  SELECT client_name INTO label FROM public.brand_strategies WHERE id = pid;
 ELSE
  pid := NEW.logo_presentation_id; kind := 'logo_presentation'; dest := '/logo/' || pid;
  SELECT client_name INTO label FROM public.logo_presentations WHERE id = pid;
 END IF;
 INSERT INTO public.notifications(user_id,kind,title,body,link,entity_type,entity_id)
 SELECT user_id,'presentation_client_message','Nouveau message client',COALESCE(label,'Client') || ' : ' || left(NEW.body,180),dest,kind,pid
 FROM public.user_roles WHERE role = 'admin';
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_presentation_client_message() FROM PUBLIC;
CREATE TRIGGER notify_presentation_message AFTER INSERT ON public.presentation_messages FOR EACH ROW EXECUTE FUNCTION public.notify_presentation_client_message();