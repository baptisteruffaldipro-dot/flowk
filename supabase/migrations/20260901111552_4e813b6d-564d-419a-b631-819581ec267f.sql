-- 1. Business units
CREATE TABLE public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage business_units" ON public.business_units FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_business_units_updated BEFORE UPDATE ON public.business_units FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.business_units (code, name, color, position) VALUES
  ('graphisme', 'Graphisme', '#6366f1', 1),
  ('platorama', 'Platorama', '#f59e0b', 2),
  ('cote_souvenir', 'Côté Souvenir', '#10b981', 3),
  ('royan_impression', 'Royan Impression', '#ef4444', 4);

-- 2. Internal hourly rates per BU
CREATE TABLE public.bu_hourly_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  activity text NOT NULL,
  hourly_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_unit_id, activity)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bu_hourly_rates TO authenticated;
GRANT ALL ON public.bu_hourly_rates TO service_role;
ALTER TABLE public.bu_hourly_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bu_hourly_rates" ON public.bu_hourly_rates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_bu_hourly_rates_updated BEFORE UPDATE ON public.bu_hourly_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.bu_hourly_rates (business_unit_id, activity, hourly_rate)
SELECT id, a.activity, a.rate FROM public.business_units bu,
  (VALUES ('production', 25), ('prospection', 20), ('creation_graphique', 60)) AS a(activity, rate)
WHERE bu.code = 'platorama';

INSERT INTO public.bu_hourly_rates (business_unit_id, activity, hourly_rate)
SELECT id, a.activity, a.rate FROM public.business_units bu,
  (VALUES ('production', 60), ('prospection', 20), ('creation_graphique', 60)) AS a(activity, rate)
WHERE bu.code IN ('graphisme', 'cote_souvenir', 'royan_impression');

-- 3. Goals
CREATE TABLE public.bu_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE CASCADE,
  period_type text NOT NULL DEFAULT 'month',
  period_start date NOT NULL,
  revenue_goal numeric NOT NULL DEFAULT 0,
  expense_goal numeric NOT NULL DEFAULT 0,
  profit_goal numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_unit_id, period_type, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bu_goals TO authenticated;
GRANT ALL ON public.bu_goals TO service_role;
ALTER TABLE public.bu_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bu_goals" ON public.bu_goals FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_bu_goals_updated BEFORE UPDATE ON public.bu_goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Allocation rules for shared costs
CREATE TABLE public.bu_allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  share_pct numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_unit_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bu_allocation_rules TO authenticated;
GRANT ALL ON public.bu_allocation_rules TO service_role;
ALTER TABLE public.bu_allocation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bu_allocation_rules" ON public.bu_allocation_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_bu_allocation_rules_updated BEFORE UPDATE ON public.bu_allocation_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Recurring expenses
CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  label text NOT NULL,
  supplier text,
  amount_ht numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  periodicity text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  day_of_month integer NOT NULL DEFAULT 1,
  category public.finance_category NOT NULL DEFAULT 'frais_fixe',
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recurring_expenses" ON public.recurring_expenses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_recurring_expenses_updated BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Client subscriptions (recurring revenue)
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  plan text NOT NULL DEFAULT 'classic',
  setup_fee_ht numeric NOT NULL DEFAULT 0,
  monthly_ht numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  extra_dishes integer NOT NULL DEFAULT 0,
  qr_stands integer NOT NULL DEFAULT 0,
  card_changes_per_year numeric NOT NULL DEFAULT 2,
  support_minutes_per_month integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Catalog items
CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'one_shot',
  price_ht numeric NOT NULL DEFAULT 0,
  monthly_ht numeric NOT NULL DEFAULT 0,
  cost_ht numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage catalog_items" ON public.catalog_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_catalog_items_updated BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.catalog_items (business_unit_id, label, kind, price_ht, monthly_ht, note)
SELECT bu.id, c.label, c.kind, c.price, c.monthly, c.note FROM public.business_units bu,
  (VALUES
    ('Classic', 'subscription', 450, 49, NULL),
    ('Business', 'subscription', 850, 69, NULL),
    ('Premium', 'subscription', 0, 99, 'Mise en service sur devis'),
    ('Plat supplémentaire', 'one_shot', 30, 0, NULL),
    ('Chevalet QR', 'one_shot', 70, 0, 'Tarif normal'),
    ('Chevalet QR (lancement)', 'one_shot', 50, 0, 'Tarif lancement')
  ) AS c(label, kind, price, monthly, note)
WHERE bu.code = 'platorama';

INSERT INTO public.recurring_expenses (business_unit_id, label, amount_ht, vat_rate, category, note)
SELECT bu.id, r.label, r.amount, 20, 'frais_fixe'::public.finance_category, r.note FROM public.business_units bu,
  (VALUES
    ('Lovable', 25, 'Transitoire — sera remplacé par un hébergement propre'),
    ('Logiciel de rendu', 10, NULL),
    ('App iPhone', 5, NULL),
    ('Crédit iPhone', 50, NULL),
    ('Emails', 3, NULL),
    ('Hébergement complémentaire', 4.17, NULL),
    ('Publicité', 100, NULL)
  ) AS r(label, amount, note)
WHERE bu.code = 'platorama';

-- 8. Attach business unit to existing entities
ALTER TABLE public.finance_transactions ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
ALTER TABLE public.finance_forecasts ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
ALTER TABLE public.print_orders ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;

CREATE INDEX idx_finance_transactions_bu ON public.finance_transactions(business_unit_id);
CREATE INDEX idx_finance_forecasts_bu ON public.finance_forecasts(business_unit_id);
CREATE INDEX idx_projects_bu ON public.projects(business_unit_id);
CREATE INDEX idx_tasks_bu ON public.tasks(business_unit_id);
CREATE INDEX idx_print_orders_bu ON public.print_orders(business_unit_id);