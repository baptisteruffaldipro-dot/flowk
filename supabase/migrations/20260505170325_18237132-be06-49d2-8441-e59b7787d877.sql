
CREATE TABLE public.invoice_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text,
  amount numeric NOT NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_installments_invoice ON public.invoice_installments(invoice_id);
CREATE INDEX idx_invoice_installments_due ON public.invoice_installments(due_date) WHERE paid_at IS NULL;

ALTER TABLE public.invoice_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all installments"
ON public.invoice_installments
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "client reads own installments"
ON public.invoice_installments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.invoices i
  JOIN public.clients c ON c.id = i.client_id
  WHERE i.id = invoice_installments.invoice_id
    AND c.portal_user_id = auth.uid()
));

CREATE TRIGGER touch_invoice_installments
BEFORE UPDATE ON public.invoice_installments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
