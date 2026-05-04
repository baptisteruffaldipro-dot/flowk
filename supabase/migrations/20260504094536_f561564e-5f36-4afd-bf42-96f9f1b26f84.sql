ALTER TABLE public.projects DISABLE TRIGGER USER;
UPDATE public.projects SET type = 'identite_visuelle' WHERE type = 'identite_graphique';
ALTER TABLE public.projects ENABLE TRIGGER USER;