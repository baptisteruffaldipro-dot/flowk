DO $$ BEGIN
  CREATE TYPE invoice_billing_type AS ENUM ('forfait', 'horaire');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_type invoice_billing_type NOT NULL DEFAULT 'forfait',
  ADD COLUMN IF NOT EXISTS hours numeric,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid;

CREATE INDEX IF NOT EXISTS idx_invoices_questionnaire_id ON public.invoices(questionnaire_id);