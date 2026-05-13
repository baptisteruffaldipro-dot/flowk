ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tiime_invoice_id text,
  ADD COLUMN IF NOT EXISTS tiime_synced_at timestamptz;