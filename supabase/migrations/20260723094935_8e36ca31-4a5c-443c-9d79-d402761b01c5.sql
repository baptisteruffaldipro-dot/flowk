
DO $$ BEGIN
  CREATE TYPE public.financing_kind AS ENUM ('credit','shareholder_loan','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.finance_financings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.financing_kind NOT NULL DEFAULT 'credit',
  label TEXT NOT NULL,
  principal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  monthly_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_installments INTEGER NOT NULL DEFAULT 0,
  first_payment_date DATE,
  interest_rate NUMERIC(6,3),
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_financings TO authenticated;
GRANT ALL ON public.finance_financings TO service_role;

ALTER TABLE public.finance_financings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage financings" ON public.finance_financings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER touch_finance_financings_updated_at
  BEFORE UPDATE ON public.finance_financings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
