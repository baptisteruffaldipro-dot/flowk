-- Migrate print_status enum to: a_commander, en_impression, livre
ALTER TYPE print_status RENAME TO print_status_old;

CREATE TYPE print_status AS ENUM ('a_commander', 'en_impression', 'livre');

-- Drop default temporarily
ALTER TABLE public.print_orders ALTER COLUMN status DROP DEFAULT;

-- Convert column with mapping
ALTER TABLE public.print_orders
  ALTER COLUMN status TYPE print_status
  USING (
    CASE status::text
      WHEN 'bat_en_attente' THEN 'a_commander'
      WHEN 'bat_valide' THEN 'a_commander'
      WHEN 'en_impression' THEN 'en_impression'
      WHEN 'expedie' THEN 'en_impression'
      WHEN 'livre' THEN 'livre'
      ELSE 'a_commander'
    END
  )::print_status;

ALTER TABLE public.print_orders ALTER COLUMN status SET DEFAULT 'a_commander'::print_status;

DROP TYPE print_status_old;