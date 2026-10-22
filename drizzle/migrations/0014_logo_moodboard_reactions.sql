ALTER TABLE public.logo_presentations ADD COLUMN client_selections jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.logo_presentations.client_selections IS 'Réactions client sur les images du moodboard : { url: "like" | "dislike" }.';

CREATE OR REPLACE FUNCTION public.get_logo_presentation_by_token(_token text)
RETURNS public.logo_presentations LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT * FROM public.logo_presentations WHERE share_token = _token AND is_published = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.logo_moodboard_react_by_token(_token text, _image_url text, _reaction text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _p public.logo_presentations; _sel jsonb;
BEGIN
  IF _image_url IS NULL OR length(_image_url) = 0 OR length(_image_url) > 2000 THEN RAISE EXCEPTION 'invalid image'; END IF;
  IF _reaction IS NOT NULL AND _reaction NOT IN ('like','dislike') THEN RAISE EXCEPTION 'invalid reaction'; END IF;
  SELECT * INTO _p FROM public.logo_presentations WHERE share_token = _token AND is_published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _reaction IS NULL THEN _sel := _p.client_selections - _image_url;
  ELSE _sel := _p.client_selections || jsonb_build_object(_image_url, _reaction); END IF;
  UPDATE public.logo_presentations SET client_selections = _sel WHERE id = _p.id;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'logo_moodboard_reaction' AND entity_id = _p.id AND created_at > now() - interval '10 minutes') THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    SELECT ur.user_id, 'logo_moodboard_reaction', 'Moodboard : réactions du client',
      _p.client_name || ' a réagi aux références de « ' || _p.project_name || ' »',
      '/logo/' || _p.id, 'logo_presentation', _p.id
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN _sel;
END; $$;
GRANT EXECUTE ON FUNCTION public.logo_moodboard_react_by_token(text, text, text) TO anon, authenticated;