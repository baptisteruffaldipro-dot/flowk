CREATE TABLE public.portal_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  page INT NOT NULL DEFAULT 1,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  comment TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'client',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_annotations TO authenticated;
GRANT ALL ON public.portal_annotations TO service_role;
ALTER TABLE public.portal_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all portal annotations" ON public.portal_annotations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.portal_annotations_by_token(_token TEXT)
RETURNS SETOF public.portal_annotations LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.* FROM public.portal_annotations a JOIN public.client_portals p ON p.id = a.portal_id
  WHERE p.share_token = _token AND p.is_published = true ORDER BY a.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.portal_annotations_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_add_annotation_by_token(_token TEXT, _file TEXT, _page INT, _x NUMERIC, _y NUMERIC, _comment TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.client_portals; new_id UUID; admin_id UUID;
BEGIN
  SELECT * INTO p FROM public.client_portals WHERE share_token = _token AND is_published = true;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Portail introuvable'; END IF;
  IF length(trim(coalesce(_comment,''))) = 0 OR length(_comment) > 2000 THEN RAISE EXCEPTION 'Commentaire invalide'; END IF;
  IF _x < 0 OR _x > 100 OR _y < 0 OR _y > 100 THEN RAISE EXCEPTION 'Position invalide'; END IF;
  INSERT INTO public.portal_annotations (portal_id, file_name, page, x, y, comment, author)
  VALUES (p.id, left(_file, 300), greatest(1, coalesce(_page,1)), _x, _y, trim(_comment), 'client') RETURNING id INTO new_id;
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, link, entity_type, entity_id)
    VALUES (admin_id, 'annotation', 'Annotation client sur un document', _file || ' — ' || left(trim(_comment), 140), '/portails/' || p.id, 'client_portal', p.id);
  END LOOP;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.portal_add_annotation_by_token(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_delete_annotation_by_token(_token TEXT, _id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.portal_annotations a USING public.client_portals p
  WHERE a.id = _id AND a.portal_id = p.id AND p.share_token = _token AND p.is_published = true
    AND a.author = 'client' AND a.resolved = false;
END; $$;
GRANT EXECUTE ON FUNCTION public.portal_delete_annotation_by_token(TEXT, UUID) TO anon, authenticated;