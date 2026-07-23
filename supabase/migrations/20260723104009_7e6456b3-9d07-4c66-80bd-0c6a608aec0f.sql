
CREATE TABLE IF NOT EXISTS public.client_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  invoiced_ttc numeric(12,2) NOT NULL DEFAULT 0,
  paid_ttc numeric(12,2) NOT NULL DEFAULT 0,
  outstanding_ttc numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en_retard',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, snapshot_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_receivables TO authenticated;
GRANT ALL ON public.client_receivables TO service_role;

ALTER TABLE public.client_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all client_receivables"
  ON public.client_receivables FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_client_receivables_updated
  BEFORE UPDATE ON public.client_receivables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.client_receivables (client_id, snapshot_date, invoiced_ttc, paid_ttc, outstanding_ttc, status) VALUES
  ('5c5aae57-fd7d-4318-8256-8446622222ab', CURRENT_DATE, 1776.00,  288.00, 1488.00, 'en_retard'),
  ('2e43dd6d-679d-4e59-816e-fcb2431c9748', CURRENT_DATE, 1648.80,  448.80, 1200.00, 'en_retard'),
  ('09b6022e-515a-407d-b78a-b0502914b77d', CURRENT_DATE, 1899.60, 1129.80,  769.80, 'en_retard'),
  ('bee1eb7e-2d41-4b25-a671-754cf2005116', CURRENT_DATE,  144.00,    0.00,  144.00, 'en_retard'),
  ('35dccd77-a3ae-44b9-b019-4c7bc14fb618', CURRENT_DATE,   55.20,    0.00,   55.20, 'en_retard')
ON CONFLICT (client_id, snapshot_date) DO UPDATE SET
  invoiced_ttc = EXCLUDED.invoiced_ttc,
  paid_ttc = EXCLUDED.paid_ttc,
  outstanding_ttc = EXCLUDED.outstanding_ttc,
  status = EXCLUDED.status;
