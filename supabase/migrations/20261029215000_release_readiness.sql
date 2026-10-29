-- Server-only deployment readiness probe. Returns no tenant details or secrets.
-- This DOES NOT replace external OAuth, payment, legal or real-device UAT.
CREATE OR REPLACE FUNCTION public.oilstation_release_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_ok boolean; v_tables integer; v_missing integer;
BEGIN
 SELECT count(*) INTO v_tables
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p');
 SELECT count(*) INTO v_missing
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
   AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
     OR pg_catalog.has_table_privilege('anon',c.oid,'SELECT')
     OR pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')
     OR pg_catalog.has_table_privilege('anon',c.oid,'INSERT')
     OR pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT')
     OR pg_catalog.has_table_privilege('anon',c.oid,'UPDATE')
     OR pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE')
     OR pg_catalog.has_table_privilege('anon',c.oid,'DELETE')
     OR pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE'));
 v_ok:=v_tables>=66 AND v_missing=0
  AND pg_catalog.to_regprocedure('public.complete_reviewed_fuel_session(uuid,uuid,uuid,uuid)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.corporate_wallet_integrity_snapshot(uuid,uuid)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.confirm_invited_email_otp(uuid,text,text)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.reconcile_saas_test_paid_event(text,text,uuid,uuid,bigint,bigint,text,text,boolean)') IS NOT NULL
  AND pg_catalog.to_regprocedure('public.hr_reviewed_attendance_punches_local(uuid,uuid,date,date)') IS NOT NULL
  AND NOT pg_catalog.has_function_privilege('service_role',
    'public.review_corporate_topup(uuid,uuid,boolean,boolean,text)','EXECUTE')
  AND NOT pg_catalog.has_function_privilege('service_role',
    'public.finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text)','EXECUTE')
  AND EXISTS(SELECT 1 FROM storage.buckets b WHERE b.id='oilstation-evidence'
    AND b.public IS FALSE AND b.file_size_limit<=5242880)
  AND EXISTS(SELECT 1 FROM storage.buckets b WHERE b.id='oilstation-slips'
    AND b.public IS FALSE AND b.file_size_limit<=5242880);
 RETURN pg_catalog.jsonb_build_object('ready',v_ok,
   'schemaVersion','20261029215000');
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_release_status()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_release_status() TO service_role;
