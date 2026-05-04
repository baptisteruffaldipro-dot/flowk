
REVOKE EXECUTE ON FUNCTION public.print_orders_client_update_guard()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bats_client_update_guard()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.projects_client_update_guard()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.questionnaires_client_update_guard()  FROM PUBLIC, anon, authenticated;
