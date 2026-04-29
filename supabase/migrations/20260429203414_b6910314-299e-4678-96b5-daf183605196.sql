DO $$ BEGIN
  CREATE TYPE bat_print_status AS ENUM ('a_imprimer', 'en_impression', 'expedie', 'livre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bats ADD COLUMN IF NOT EXISTS print_status bat_print_status;