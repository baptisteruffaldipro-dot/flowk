-- Add portal_token column to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_token text;

-- Backfill existing clients
UPDATE public.clients
SET portal_token = encode(gen_random_bytes(24), 'hex')
WHERE portal_token IS NULL;

-- Enforce NOT NULL + default for new rows
ALTER TABLE public.clients
  ALTER COLUMN portal_token SET DEFAULT encode(gen_random_bytes(24), 'hex'),
  ALTER COLUMN portal_token SET NOT NULL;

-- Unique index
CREATE UNIQUE INDEX IF NOT EXISTS clients_portal_token_key
  ON public.clients (portal_token);