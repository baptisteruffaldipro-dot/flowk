CREATE TYPE public.print_payment_status AS ENUM ('non_regle', 'acompte_50', 'regle');

ALTER TABLE public.print_orders
  ADD COLUMN payment_status public.print_payment_status NOT NULL DEFAULT 'non_regle';

-- Migrer les commandes déjà marquées "livre_paye" vers payment_status='regle'
UPDATE public.print_orders SET payment_status = 'regle' WHERE status = 'livre_paye';