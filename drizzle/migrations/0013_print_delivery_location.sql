ALTER TABLE public.print_orders ADD COLUMN delivery_location text;
COMMENT ON COLUMN public.print_orders.delivery_location IS 'Lieu de livraison saisi par l’administrateur et affiché au client.';
DO $migration$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.get_client_portal_by_token(text)'::regprocedure);
  definition := replace(definition, '''estimated_delivery_date'', o.estimated_delivery_date', '''estimated_delivery_date'', o.estimated_delivery_date, ''delivery_location'', o.delivery_location');
  EXECUTE definition;
  definition := pg_get_functiondef('public.print_orders_client_update_guard()'::regprocedure);
  definition := replace(definition, 'NEW.estimated_delivery_date IS DISTINCT FROM OLD.estimated_delivery_date OR', 'NEW.estimated_delivery_date IS DISTINCT FROM OLD.estimated_delivery_date OR NEW.delivery_location IS DISTINCT FROM OLD.delivery_location OR');
  EXECUTE definition;
END;
$migration$;