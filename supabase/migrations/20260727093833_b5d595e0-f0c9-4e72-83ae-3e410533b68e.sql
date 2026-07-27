DELETE FROM public.finance_transactions
WHERE kind = 'bank'
  AND date >= '2026-07-01'
  AND import_id = '4ff00709-683b-41a4-a071-780490b41ff2';

DELETE FROM public.bank_balances
WHERE as_of_date = '2026-07-22' AND amount = -2909.92;