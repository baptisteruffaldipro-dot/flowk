
-- Enums
DO $$ BEGIN
  CREATE TYPE public.finance_kind AS ENUM ('sale','expense','bank');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_category AS ENUM ('prestation','achat_revente','expense','bank','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tiime_import_status AS ENUM ('pending','completed','rolled_back','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tiime_imports
CREATE TABLE IF NOT EXISTS public.tiime_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_hash text,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  row_count int NOT NULL DEFAULT 0,
  inserted_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  status public.tiime_import_status NOT NULL DEFAULT 'pending',
  notes text,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiime_imports TO authenticated;
GRANT ALL ON public.tiime_imports TO service_role;
ALTER TABLE public.tiime_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all tiime_imports" ON public.tiime_imports FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_tiime_imports_updated BEFORE UPDATE ON public.tiime_imports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- tiime_column_mappings
CREATE TABLE IF NOT EXISTS public.tiime_column_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL DEFAULT 'default',
  kind public.finance_kind,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_name, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiime_column_mappings TO authenticated;
GRANT ALL ON public.tiime_column_mappings TO service_role;
ALTER TABLE public.tiime_column_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all tiime_column_mappings" ON public.tiime_column_mappings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_tiime_col_mappings_updated BEFORE UPDATE ON public.tiime_column_mappings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- finance_transactions
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.tiime_imports(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'tiime_import',
  kind public.finance_kind NOT NULL,
  category public.finance_category NOT NULL DEFAULT 'other',
  category_source text DEFAULT 'auto',
  doc_number text,
  date date NOT NULL,
  due_date date,
  paid_date date,
  label text,
  counterparty text,
  counterparty_normalized text,
  amount_ht numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_ttc numeric(12,2) NOT NULL DEFAULT 0,
  vat_rate numeric(6,2),
  account_code text,
  supplier_cost_ht numeric(12,2),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  raw jsonb,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_tx_dedupe ON public.finance_transactions(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_tx_date ON public.finance_transactions(date);
CREATE INDEX IF NOT EXISTS idx_finance_tx_kind_cat ON public.finance_transactions(kind, category);
CREATE INDEX IF NOT EXISTS idx_finance_tx_client ON public.finance_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_project ON public.finance_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_finance_tx_task ON public.finance_transactions(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO authenticated;
GRANT ALL ON public.finance_transactions TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all finance_tx" ON public.finance_transactions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_finance_tx_updated BEFORE UPDATE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- finance_category_rules
CREATE TABLE IF NOT EXISTS public.finance_category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  field text NOT NULL DEFAULT 'label',
  match_kind public.finance_kind,
  category public.finance_category NOT NULL,
  priority int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_category_rules TO authenticated;
GRANT ALL ON public.finance_category_rules TO service_role;
ALTER TABLE public.finance_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all finance_cat_rules" ON public.finance_category_rules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_finance_cat_rules_updated BEFORE UPDATE ON public.finance_category_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- finance_link_rules
CREATE TABLE IF NOT EXISTS public.finance_link_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_normalized text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(counterparty_normalized)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_link_rules TO authenticated;
GRANT ALL ON public.finance_link_rules TO service_role;
ALTER TABLE public.finance_link_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all finance_link_rules" ON public.finance_link_rules FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_finance_link_rules_updated BEFORE UPDATE ON public.finance_link_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- bank_balances
CREATE TABLE IF NOT EXISTS public.bank_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  import_id uuid REFERENCES public.tiime_imports(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_balances_date ON public.bank_balances(as_of_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_balances TO authenticated;
GRANT ALL ON public.bank_balances TO service_role;
ALTER TABLE public.bank_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all bank_balances" ON public.bank_balances FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_bank_balances_updated BEFORE UPDATE ON public.bank_balances FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- vat_adjustments
CREATE TABLE IF NOT EXISTS public.vat_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  adjustment numeric(12,2) NOT NULL DEFAULT 0,
  reserve_pct numeric(5,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vat_adjustments TO authenticated;
GRANT ALL ON public.vat_adjustments TO service_role;
ALTER TABLE public.vat_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all vat_adjustments" ON public.vat_adjustments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_vat_adjustments_updated BEFORE UPDATE ON public.vat_adjustments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- finance_forecasts
CREATE TABLE IF NOT EXISTS public.finance_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  amount_ttc numeric(12,2) NOT NULL,
  vat_rate numeric(6,2) DEFAULT 20,
  planned_date date NOT NULL,
  kind text NOT NULL DEFAULT 'expense',
  recurrence text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_forecasts TO authenticated;
GRANT ALL ON public.finance_forecasts TO service_role;
ALTER TABLE public.finance_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all finance_forecasts" ON public.finance_forecasts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_finance_forecasts_updated BEFORE UPDATE ON public.finance_forecasts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default category rules
INSERT INTO public.finance_category_rules (pattern, field, match_kind, category, priority)
VALUES
  ('impression', 'label', 'sale', 'achat_revente', 100),
  ('imprim', 'label', 'sale', 'achat_revente', 100),
  ('signal', 'label', 'sale', 'achat_revente', 100),
  ('goodies', 'label', 'sale', 'achat_revente', 100),
  ('flyer', 'label', 'sale', 'achat_revente', 90),
  ('carte de visite', 'label', 'sale', 'achat_revente', 90),
  ('affiche', 'label', 'sale', 'achat_revente', 90),
  ('sticker', 'label', 'sale', 'achat_revente', 90),
  ('kakemono', 'label', 'sale', 'achat_revente', 90),
  ('roll', 'label', 'sale', 'achat_revente', 90),
  ('graphisme', 'label', 'sale', 'prestation', 80),
  ('logo', 'label', 'sale', 'prestation', 80),
  ('identit', 'label', 'sale', 'prestation', 80),
  ('site', 'label', 'sale', 'prestation', 80),
  ('web', 'label', 'sale', 'prestation', 80),
  ('social', 'label', 'sale', 'prestation', 80),
  ('707', 'account_code', 'sale', 'achat_revente', 200),
  ('706', 'account_code', 'sale', 'prestation', 200),
  ('704', 'account_code', 'sale', 'prestation', 200)
ON CONFLICT DO NOTHING;
