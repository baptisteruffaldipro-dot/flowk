DELETE FROM public.bank_balances WHERE as_of_date IN ('2026-08-12','2026-08-17') AND source = 'tiime_import';
INSERT INTO public.bank_balances (as_of_date, amount, source, note)
VALUES (CURRENT_DATE, 501.00, 'manual', 'Solde réel constaté (saisie manuelle)');
-- Les factures de vente déjà marquées "Payée" dans Tiime reçoivent une date de paiement
UPDATE public.finance_transactions
SET paid_date = date
WHERE kind = 'sale' AND paid_date IS NULL AND raw->>'statut de la facture' ILIKE 'pay%';