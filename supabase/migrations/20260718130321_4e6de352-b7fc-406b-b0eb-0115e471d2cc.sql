
-- Allow portal clients to upload files to the 'bat' bucket, scoped to their own client folder (path: {client_id}/{bat_id}/...)
CREATE POLICY "Clients can upload bat files for own bats"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bat'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.portal_user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Clients can update own bat files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bat'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.portal_user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'bat'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.portal_user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

-- Allow portal clients to SELECT their own client_requests (needed for Realtime and direct reads)
CREATE POLICY "Clients can read own requests"
ON public.client_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_requests.client_id
      AND c.portal_user_id = auth.uid()
  )
);
