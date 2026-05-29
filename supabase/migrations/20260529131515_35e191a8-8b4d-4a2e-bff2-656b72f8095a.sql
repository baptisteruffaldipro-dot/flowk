
-- 1) Fix broken logo-deliverables client read policy
DROP POLICY IF EXISTS "client read own logo-deliverables" ON storage.objects;
CREATE POLICY "client read own logo-deliverables"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'logo-deliverables'
  AND EXISTS (
    SELECT 1 FROM public.logo_presentations lp
    JOIN public.clients c ON c.id = lp.client_id
    WHERE c.portal_user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = (lp.id)::text
      AND public.can_download('logo_presentation', lp.id)
  )
);

-- 2) Fix broken social-media client read policy
DROP POLICY IF EXISTS "client reads own social-media" ON storage.objects;
CREATE POLICY "client reads own social-media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'social-media'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.portal_user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = (c.id)::text
  )
);

-- 3) Allow clients to read subtasks of their own tasks
CREATE POLICY "clients read own subtasks"
ON public.subtasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.clients c ON c.id = t.client_id
    WHERE t.id = subtasks.task_id
      AND c.portal_user_id = auth.uid()
  )
);

-- 4) Restrict realtime channel subscriptions to admins only
DROP POLICY IF EXISTS "admins only realtime" ON realtime.messages;
CREATE POLICY "admins only realtime"
ON realtime.messages FOR SELECT
TO authenticated
USING (public.is_admin());

-- 5) Lock down SECURITY DEFINER functions that should not be directly callable by clients
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bats_client_update_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.questionnaires_client_update_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.print_orders_client_update_guard() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.projects_client_update_guard() FROM anon, authenticated;
