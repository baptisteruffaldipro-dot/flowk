
INSERT INTO storage.buckets (id, name, public) VALUES ('quick-captures', 'quick-captures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin read quick-captures"
ON storage.objects FOR SELECT
USING (bucket_id = 'quick-captures' AND public.is_admin());

CREATE POLICY "admin insert quick-captures"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'quick-captures' AND public.is_admin());

CREATE POLICY "admin delete quick-captures"
ON storage.objects FOR DELETE
USING (bucket_id = 'quick-captures' AND public.is_admin());
