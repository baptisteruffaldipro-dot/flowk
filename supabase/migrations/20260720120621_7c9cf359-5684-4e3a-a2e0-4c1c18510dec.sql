
DROP POLICY IF EXISTS "Clients can upload bat files for own bats" ON storage.objects;
DROP POLICY IF EXISTS "Clients can update own bat files" ON storage.objects;

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
