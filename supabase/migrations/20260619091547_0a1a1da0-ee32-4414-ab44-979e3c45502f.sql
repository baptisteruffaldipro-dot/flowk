ALTER PUBLICATION supabase_realtime ADD TABLE public.client_requests;
ALTER TABLE public.client_requests REPLICA IDENTITY FULL;