DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_client_portal_by_token'::regproc);
  IF position('''price_tiers''' in d) = 0 THEN
    d := replace(d, '''products'', o.products,', '''products'', o.products, ''price_tiers'', o.price_tiers,');
    EXECUTE d;
  END IF;
END $$;