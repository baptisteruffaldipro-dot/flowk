CREATE TABLE public.finance_tx_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.finance_transactions(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  share_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, business_unit_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tx_splits TO authenticated;
GRANT ALL ON public.finance_tx_splits TO service_role;

ALTER TABLE public.finance_tx_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tx splits" ON public.finance_tx_splits
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_finance_tx_splits_tx ON public.finance_tx_splits(transaction_id);