
CREATE TABLE public.mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  imap_host text NOT NULL,
  imap_port int NOT NULL DEFAULT 993,
  imap_tls boolean NOT NULL DEFAULT true,
  smtp_host text NOT NULL,
  smtp_port int NOT NULL DEFAULT 465,
  smtp_tls boolean NOT NULL DEFAULT true,
  from_name text,
  signature text,
  last_uid_seen bigint NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_accounts TO authenticated;
GRANT ALL ON public.mail_accounts TO service_role;
ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage mail_accounts" ON public.mail_accounts FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER mail_accounts_touch BEFORE UPDATE ON public.mail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.mails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  uid bigint NOT NULL,
  message_id text,
  in_reply_to text,
  thread_key text,
  from_email text NOT NULL,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text,
  snippet text,
  body_text text,
  body_html text,
  received_at timestamptz NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  raw_headers jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, uid)
);
CREATE INDEX mails_received_idx ON public.mails (received_at DESC);
CREATE INDEX mails_unread_idx ON public.mails (is_read) WHERE is_read = false;
CREATE INDEX mails_archived_idx ON public.mails (is_archived);
CREATE INDEX mails_client_idx ON public.mails (client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mails TO authenticated;
GRANT ALL ON public.mails TO service_role;
ALTER TABLE public.mails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage mails" ON public.mails FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER mails_touch BEFORE UPDATE ON public.mails
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.mail_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_id uuid NOT NULL REFERENCES public.mails(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime text,
  size bigint,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_attachments_mail_idx ON public.mail_attachments (mail_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_attachments TO authenticated;
GRANT ALL ON public.mail_attachments TO service_role;
ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage mail_attachments" ON public.mail_attachments FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
