
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('bat', 'bat', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('livrables', 'livrables', false) ON CONFLICT (id) DO NOTHING;

-- BAT bucket: admin full access, client read access for own orders
CREATE POLICY "admin manage bat"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'bat' AND public.is_admin())
WITH CHECK (bucket_id = 'bat' AND public.is_admin());

CREATE POLICY "client reads own bat files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bat' AND EXISTS (
    SELECT 1 FROM public.print_orders po
    JOIN public.clients c ON c.id = po.client_id
    WHERE c.portal_user_id = auth.uid()
      AND po.bat_file_path = name
  )
);

-- Livrables bucket
CREATE POLICY "admin manage livrables"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'livrables' AND public.is_admin())
WITH CHECK (bucket_id = 'livrables' AND public.is_admin());

CREATE POLICY "client reads own livrables"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'livrables' AND (storage.foldername(name))[1] IN (
    SELECT c.id::text FROM public.clients c WHERE c.portal_user_id = auth.uid()
  )
);

-- Add deliverables to tasks (jsonb array of {path, name})
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Add brief_submitted_at on projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS brief_submitted_at timestamptz;

-- Add deliverables to print_orders (jsonb array)
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb;

-- BAT decision tracking
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS bat_uploaded_at timestamptz;
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS bat_rejected_at timestamptz;
ALTER TABLE public.print_orders ADD COLUMN IF NOT EXISTS bat_rejection_reason text;

-- Allow client to validate or reject BAT on own print orders
CREATE POLICY "client updates bat on own orders"
ON public.print_orders FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = print_orders.client_id AND c.portal_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = print_orders.client_id AND c.portal_user_id = auth.uid()));

-- Allow client to update own annotations (resolve/edit)
CREATE POLICY "client updates own annotations"
ON public.bat_annotations FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "client deletes own annotations"
ON public.bat_annotations FOR DELETE TO authenticated
USING (author_id = auth.uid() AND NOT resolved);
