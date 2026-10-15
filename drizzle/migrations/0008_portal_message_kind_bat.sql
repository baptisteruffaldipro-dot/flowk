ALTER TABLE public.client_portal_messages
  DROP CONSTRAINT client_portal_messages_kind_check;

ALTER TABLE public.client_portal_messages
  ADD CONSTRAINT client_portal_messages_kind_check
  CHECK (kind IN ('message','correction','approve_file','request_changes'));