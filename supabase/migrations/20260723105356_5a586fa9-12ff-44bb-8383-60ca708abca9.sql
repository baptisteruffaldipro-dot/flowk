ALTER TABLE public.client_receivables
ADD COLUMN IF NOT EXISTS expected_payment_date date;