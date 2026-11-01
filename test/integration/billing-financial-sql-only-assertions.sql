-- Shared OilStation production-backed QA: financial test RPCs must remain
-- unavailable to service_role and browser users unless a separately reviewed
-- isolated UAT release explicitly grants them. Runs on disposable PostgreSQL.
DO $sql_only$
DECLARE tables integer;
BEGIN
 IF pg_catalog.has_function_privilege('service_role',
  'public.reconcile_saas_test_succeeded_refund(text,text,text,text,bigint,text,text,boolean)',
  'EXECUTE') OR
    pg_catalog.has_function_privilege('service_role',
  'public.record_saas_test_dispute_review(text,text,text,text,bigint,text,text,text,bigint,boolean)',
  'EXECUTE') OR
    pg_catalog.has_function_privilege('authenticated',
  'public.reconcile_saas_test_succeeded_refund(text,text,text,text,bigint,text,text,boolean)',
  'EXECUTE') OR
    pg_catalog.has_function_privilege('anon',
  'public.record_saas_test_dispute_review(text,text,text,text,bigint,text,text,text,bigint,boolean)',
  'EXECUTE')
 THEN RAISE EXCEPTION 'financial_test_rpc_exposed';END IF;
 SELECT count(*) INTO tables FROM pg_catalog.pg_class c
 WHERE c.relnamespace='public'::regnamespace
  AND c.relname IN ('saas_test_refund_journal','saas_test_dispute_review_events')
  AND c.relrowsecurity=true AND c.relforcerowsecurity=true;
 IF tables<>2 THEN RAISE EXCEPTION 'financial_test_journal_rls_missing';END IF;
 RAISE NOTICE 'PASS QA financial audit tables RLS forced and both RPCs denied to service/anon/authenticated';
END $sql_only$;
