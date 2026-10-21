ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tiime_invoice_id text,
  ADD COLUMN IF NOT EXISTS tiime_invoice_number text,
  ADD COLUMN IF NOT EXISTS tiime_invoice_status text,
  ADD COLUMN IF NOT EXISTS tiime_sent_at timestamptz;
ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS tiime_invoice_id text,
  ADD COLUMN IF NOT EXISTS tiime_invoice_number text,
  ADD COLUMN IF NOT EXISTS tiime_invoice_status text,
  ADD COLUMN IF NOT EXISTS tiime_sent_at timestamptz;