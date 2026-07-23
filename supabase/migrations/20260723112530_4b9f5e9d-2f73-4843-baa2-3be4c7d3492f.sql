
ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS amount_ht_presta numeric,
  ADD COLUMN IF NOT EXISTS amount_ht_achat numeric,
  ADD COLUMN IF NOT EXISTS split_reviewed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.finance_transactions.amount_ht_presta IS 'Part HT en prestation (facture mixte). Si NULL, on retombe sur category.';
COMMENT ON COLUMN public.finance_transactions.amount_ht_achat IS 'Part HT en achat/revente (facture mixte). Si NULL, on retombe sur category.';
COMMENT ON COLUMN public.finance_transactions.split_reviewed IS 'True quand l''utilisateur a validé la répartition presta/achat.';
