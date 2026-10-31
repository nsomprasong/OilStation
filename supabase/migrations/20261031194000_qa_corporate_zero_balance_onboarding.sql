-- Corporate QA fixture bootstrap: zero balances, 12 fixed synthetic company names,
-- 4 fixed stations, owner QA users only, no financial API opening.
-- PostgREST permissions remain service_role-only.
CREATE OR REPLACE FUNCTION public.oilstation_qa_station_create_company(
 p_actor_id uuid,p_qa_run_id text,p_station_id uuid,
 p_name text,p_contact_email text,p_station_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_station_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_station_idx integer;
 v_slot integer;
 v_alias text;
 v_expected_name text;
 v_email text;
 v_id uuid;
 v_account uuid;
 v_result jsonb;
 v_existing integer;
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR cardinality(p_station_ids) IS DISTINCT FROM 4
 OR p_actor_id IS NULL OR p_station_id IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;

 -- All four station IDs must still resolve to their originally approved
 -- business names; there is no possibility of passing the protected original.
 FOR v_station_idx IN 1..4 LOOP
   IF NOT EXISTS (SELECT 1 FROM public.stations s
     WHERE s.id=p_station_ids[v_station_idx]
       AND s.name=v_station_names[v_station_idx])
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 END LOOP;
 v_station_idx:=array_position(p_station_ids,p_station_id);
 IF v_station_idx IS NULL OR NOT EXISTS(
   SELECT 1 FROM auth.users u JOIN public.memberships m ON m.user_id=u.id
   WHERE u.id=p_actor_id AND u.raw_app_meta_data->>'oilstation_qa'='true'
    AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id
    AND m.active AND m.scope_type='station' AND m.station_id=p_station_id
    AND m.role_code IN ('station_owner','owner')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;

 v_slot:=NULL;
 FOR v_existing IN 1..3 LOOP
   v_expected_name:=v_station_names[v_station_idx]||'-C0'||v_existing::text;
   IF p_name IS NOT DISTINCT FROM v_expected_name THEN
     v_slot:=v_existing;
     EXIT;
   END IF;
 END LOOP;
 IF v_slot IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 v_alias:='c'||lpad((((v_station_idx-1)*3)+v_slot)::text,2,'0');
 v_email:='qa-'||v_alias||'-admin@qa.oilstation.invalid';
 IF p_contact_email IS DISTINCT FROM v_email THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;

 -- Serial admission by station protects the max-3 fixture invariant and
 -- idempotence on crash/retry without touching any real corporate tenant.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('qa_station_company:'||p_station_id::text,0));
 SELECT c.id,a.id INTO v_id,v_account
 FROM public.corporate_companies c
 JOIN public.corporate_station_accounts a ON a.company_id=c.id
 WHERE a.station_id=p_station_id AND c.name=p_name
 LIMIT 1;
 IF FOUND THEN
   IF EXISTS (SELECT 1 FROM public.corporate_station_accounts a
     WHERE a.id=v_account AND (
      a.prepaid_balance_satang<>0 OR a.credit_limit_satang<>0
      OR a.debt_outstanding_satang<>0 OR a.reserved_satang<>0))
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
   RETURN pg_catalog.jsonb_build_object(
    'companyId',v_id,'accountId',v_account,'stationId',p_station_id,
    'name',p_name,'replayed',true);
 END IF;
 IF (SELECT count(*) FROM public.corporate_station_accounts a
   WHERE a.station_id=p_station_id)>=3 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_COMPANY_LIMIT_REACHED';
 END IF;

 -- Existing business function independently requires valid Station Owner role
 -- and an enabled QR module; creates zero-balance company/account + audit.
 SELECT public.station_create_corporate_customer(
   p_actor_id,p_station_id,p_name,NULL,v_email,0,'per_fill',NULL)
 INTO v_result;
 RETURN v_result||pg_catalog.jsonb_build_object('replayed',false);
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_station_create_company(uuid,text,uuid,text,text,uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_station_create_company(uuid,text,uuid,text,text,uuid[])
 TO service_role;

-- Narrow idempotence + financial-zero evidence, not direct table REST grants.
CREATE OR REPLACE FUNCTION public.oilstation_qa_company_evidence(
 p_qa_run_id text,p_station_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_names text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_i integer;
 v_result jsonb;
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR cardinality(p_station_ids) IS DISTINCT FROM 4
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 FOR v_i IN 1..4 LOOP
  IF NOT EXISTS (SELECT 1 FROM public.stations s
   WHERE s.id=p_station_ids[v_i] AND s.name=v_names[v_i])
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 END LOOP;
 SELECT pg_catalog.jsonb_build_object(
  'companyCount',(SELECT count(*) FROM public.corporate_station_accounts a
    WHERE a.station_id=ANY(p_station_ids)),
  'companies',coalesce(pg_catalog.jsonb_agg(
     pg_catalog.jsonb_build_object(
      'companyId',c.id,'accountId',a.id,'stationId',a.station_id,
      'name',c.name,'email',c.contact_email,
      'prepaid',a.prepaid_balance_satang::text,
      'credit',a.credit_limit_satang::text,
      'debt',a.debt_outstanding_satang::text,
      'reserved',a.reserved_satang::text,
      'terms',a.payment_terms_days)
     ORDER BY c.name),'[]'::jsonb)
 ) INTO v_result
 FROM public.corporate_station_accounts a
 JOIN public.corporate_companies c ON c.id=a.company_id
 WHERE a.station_id=ANY(p_station_ids);
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_company_evidence(text,uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_company_evidence(text,uuid[])
 TO service_role;
