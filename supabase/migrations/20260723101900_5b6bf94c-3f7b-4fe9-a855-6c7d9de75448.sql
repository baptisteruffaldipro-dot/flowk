
-- Aligner les soldes bancaires sur ceux du logiciel comptable (Tiime)
DELETE FROM bank_balances WHERE as_of_date >= '2025-12-31';

INSERT INTO bank_balances (as_of_date, amount, source, note) VALUES
  ('2025-12-31',  315.34, 'tiime', 'Solde initial 01/2026 (Tiime)'),
  ('2026-01-31',  589.49, 'tiime', 'Solde final 01/2026 (Tiime)'),
  ('2026-02-28',  776.00, 'tiime', 'Solde final 02/2026 (Tiime)'),
  ('2026-03-31', 1972.68, 'tiime', 'Solde final 03/2026 (Tiime)'),
  ('2026-04-30', 1836.60, 'tiime', 'Solde final 04/2026 (Tiime)'),
  ('2026-05-31', 2248.52, 'tiime', 'Solde final 05/2026 (Tiime)'),
  ('2026-06-30', 3724.80, 'tiime', 'Solde final 06/2026 (Tiime)'),
  ('2026-07-31', 1270.44, 'tiime', 'Solde final 07/2026 (Tiime)');
