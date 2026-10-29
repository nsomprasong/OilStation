-- Metadata-only public schema parity: no live records and no real balances.
DO $$
DECLARE n_tables bigint;missing_rls bigint;unsafe_funcs bigint;missing_critical bigint;
BEGIN
 SELECT count(*) INTO n_tables FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p');
 IF n_tables<65 THEN RAISE EXCEPTION 'snapshot_incomplete:%',n_tables;END IF;
 -- Real read-only Supabase introspection found NO direct browser-table grants.
 -- Security-definer RPCs, not table privileges, mediate all app data access.
 IF EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND
    (has_table_privilege('anon',c.oid,'SELECT') OR
     has_table_privilege('anon',c.oid,'INSERT') OR
     has_table_privilege('anon',c.oid,'UPDATE') OR
     has_table_privilege('anon',c.oid,'DELETE') OR
     has_table_privilege('authenticated',c.oid,'SELECT') OR
     has_table_privilege('authenticated',c.oid,'INSERT') OR
     has_table_privilege('authenticated',c.oid,'UPDATE') OR
     has_table_privilege('authenticated',c.oid,'DELETE'))
 ) THEN RAISE EXCEPTION 'public_tables_accessible_from_browser_roles';END IF;
 SELECT count(*) INTO missing_rls FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
 AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
 IF missing_rls>0 THEN
  RAISE EXCEPTION 'public_tables_without_enforced_rls:%',missing_rls;END IF;
 SELECT count(*) INTO unsafe_funcs FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND (has_function_privilege('anon',p.oid,'EXECUTE')
   OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
 IF unsafe_funcs>0 THEN
  RAISE EXCEPTION 'functions_exposed_to_browser_roles:%',unsafe_funcs;END IF;
 SELECT count(*) INTO missing_critical FROM(
  VALUES('public','start_reserved_fuel_session(uuid,uuid,text,text)'),
   ('public','finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text)'),
   ('public','review_corporate_topup(uuid,uuid,boolean,boolean,text)')
 ) AS expected(schema_name,signature)
 WHERE to_regprocedure(expected.schema_name||'.'||expected.signature) IS NULL
 OR has_function_privilege('service_role',
    to_regprocedure(expected.schema_name||'.'||expected.signature),'EXECUTE');
 IF missing_critical<>0 THEN
  RAISE EXCEPTION 'unverified_finance_rpc_exposed:%',missing_critical;END IF;
 RAISE NOTICE 'public schema parity PASS (tables %, forced RLS, browser RPC grants, private finance)',n_tables;
END $$;
