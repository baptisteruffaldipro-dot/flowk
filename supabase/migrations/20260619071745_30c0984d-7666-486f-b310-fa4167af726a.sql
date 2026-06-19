
-- Type d'une demande client
DO $$ BEGIN
  CREATE TYPE public.client_request_kind AS ENUM ('projet','tache','commande','rdv','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_request_status AS ENUM ('nouveau','en_attente_client','validee','refusee','convertie','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_request_billing AS ENUM ('forfait','horaire','a_definir');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_request_channel AS ENUM ('mail','message','appel','rdv','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name_snapshot TEXT,
  channel public.client_request_channel NOT NULL DEFAULT 'autre',
  kind public.client_request_kind NOT NULL DEFAULT 'autre',
  title TEXT NOT NULL,
  description TEXT,
  -- Estimations
  billing_type public.client_request_billing NOT NULL DEFAULT 'a_definir',
  estimated_amount NUMERIC(10,2),
  estimated_minutes INT,
  hourly_rate NUMERIC(10,2),
  deadline DATE,
  -- Suivi & statut
  status public.client_request_status NOT NULL DEFAULT 'nouveau',
  client_validated_at TIMESTAMPTZ,
  client_refused_at TIMESTAMPTZ,
  client_refusal_reason TEXT,
  -- Lien public
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_published BOOLEAN NOT NULL DEFAULT true,
  -- Conversions
  converted_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  converted_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  converted_print_order_id UUID REFERENCES public.print_orders(id) ON DELETE SET NULL,
  converted_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  -- Méta
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_requests TO authenticated;
GRANT ALL ON public.client_requests TO service_role;

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client_requests"
  ON public.client_requests FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Messages échangés sur la demande (visibles côté public)
CREATE TABLE public.client_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('admin','client')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_request_messages TO authenticated;
GRANT ALL ON public.client_request_messages TO service_role;

ALTER TABLE public.client_request_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client_request_messages"
  ON public.client_request_messages FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Accès public par token : RPC sécurisée
CREATE OR REPLACE FUNCTION public.get_client_request_by_token(_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_client_request_by_token(TEXT) TO anon, authenticated;

-- Validation/refus client par token
CREATE OR REPLACE FUNCTION public.client_request_decide_by_token(_token TEXT, _decision TEXT, _reason TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.client_requests;
BEGIN
  SELECT * INTO r FROM public.client_requests WHERE share_token = _token AND is_published = true LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF r.status NOT IN ('nouveau','en_attente_client') THEN
    RAISE EXCEPTION 'Demande déjà traitée';
  END IF;
  IF _decision = 'valider' THEN
    UPDATE public.client_requests SET status='validee', client_validated_at=now() WHERE id=r.id;
  ELSIF _decision = 'refuser' THEN
    UPDATE public.client_requests SET status='refusee', client_refused_at=now(), client_refusal_reason=_reason WHERE id=r.id;
  ELSE
    RAISE EXCEPTION 'Décision invalide';
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.client_request_decide_by_token(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Message client par token
CREATE OR REPLACE FUNCTION public.client_request_add_message_by_token(_token TEXT, _body TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.client_requests;
BEGIN
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'Message vide'; END IF;
  IF length(_body) > 4000 THEN RAISE EXCEPTION 'Message trop long'; END IF;
  SELECT * INTO r FROM public.client_requests WHERE share_token = _token AND is_published = true LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  INSERT INTO public.client_request_messages(request_id, author, body) VALUES (r.id, 'client', _body);
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.client_request_add_message_by_token(TEXT, TEXT) TO anon, authenticated;
