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
 -- Validate core query indexes are present after a complete upgrade.
 IF (SELECT count(*) FROM pg_indexes WHERE schemaname='public'
   AND indexname=ANY(ARRAY[
    'oilstation_ar_account_due_idx','oilstation_ar_fuel_session_idx',
    'oilstation_wallet_company_station_idx','oilstation_coupon_account_status_idx',
    'oilstation_coupon_fuel_station_idx','oilstation_fuel_evidence_session_kind_idx',
    'oilstation_fuel_sessions_station_created_idx','oilstation_topup_account_review_idx',
    'oilstation_billing_attempt_invoice_created_idx','oilstation_memberships_station_active_idx',
    'oilstation_memberships_company_active_idx','oilstation_attendance_shift_idx',
    'oilstation_shift_template_date_idx']))<>13
 THEN RAISE EXCEPTION 'core_financial_and_hr_indexes_missing';END IF;
 RAISE NOTICE 'public schema parity PASS (tables %, forced RLS, browser RPC grants, private finance)',n_tables;
END $$;

-- Readiness probe synthetic Storage rows on a disposable database.
-- Real Supabase already has private evidence/slip buckets; the metadata-only
-- schema fixture deliberately contains no customer or storage data.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES ('oilstation-evidence','oilstation-evidence',false,5242880),
       ('oilstation-slips','oilstation-slips',false,5242880);
DO $$
DECLARE s jsonb;
BEGIN
 IF pg_catalog.has_function_privilege('anon',
   'public.oilstation_release_status()','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
   'public.oilstation_release_status()','EXECUTE')
 THEN RAISE EXCEPTION 'release_status_publicly_accessible';END IF;
 s:=public.oilstation_release_status();
 IF s->>'ready'<>'true' OR s->>'schemaVersion'<>'20261029215000'
 THEN RAISE EXCEPTION 'release_status_not_ready_after_migrations:%',s;END IF;
 UPDATE storage.buckets SET public=true WHERE id='oilstation-slips';
 s:=public.oilstation_release_status();
 IF s->>'ready'<>'false' THEN RAISE EXCEPTION 'public_slip_bucket_did_not_block_release';END IF;
END $$;
ROLLBACK;
