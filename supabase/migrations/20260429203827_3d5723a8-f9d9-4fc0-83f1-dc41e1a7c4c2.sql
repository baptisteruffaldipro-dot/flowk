ALTER TABLE public.print_orders
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS grammage text,
  ADD COLUMN IF NOT EXISTS support text,
  ADD COLUMN IF NOT EXISTS colors text,
  ADD COLUMN IF NOT EXISTS finitions text,
  ADD COLUMN IF NOT EXISTS observations text;