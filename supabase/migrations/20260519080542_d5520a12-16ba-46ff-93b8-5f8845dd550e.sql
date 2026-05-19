CREATE POLICY "client reads own bat table files" ON storage.objects FOR SELECT USING (
  bucket_id = 'bat' AND EXISTS (
    SELECT 1 FROM public.bats b
    JOIN public.clients c ON c.id = b.client_id
    WHERE c.portal_user_id = auth.uid() AND b.file_path = storage.objects.name
  )
);