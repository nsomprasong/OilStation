-- Platform/Station QA actor provisioning: validate the four real QA nodes
-- WITHOUT granting direct table SELECT to service_role or client roles.
-- This read-only RPC is only callable from the authenticated Super Admin
-- Worker endpoint; the Worker supplies fixed server-side approved ID lists.
CREATE OR REPLACE FUNCTION public.oilstation_qa_scope_options(
 p_qa_run_id text,
 p_organization_ids uuid[],
 p_station_ids uuid[],
 p_company_ids uuid[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_expected text[]:=ARRAY['QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B'];
 v_idx integer;
 v_company_station_idx integer;
 v_expected_company text;
 v_orgs jsonb;
 v_stations jsonb;
 v_companies jsonb;
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
   OR p_organization_ids IS NULL OR p_station_ids IS NULL
   OR p_company_ids IS NULL
   OR cardinality(p_station_ids)<>4 OR cardinality(p_organization_ids)<>4
   OR cardinality(p_company_ids)>12
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_SCOPE_NOT_APPROVED'; END IF;
 -- Same position always means the same station/org pair: o01 and s01a
 -- must NOT resolve to a different real tenant when the Worker redeploys.
 FOR v_idx IN 1..4 LOOP
   IF NOT EXISTS (
     SELECT 1 FROM public.stations s
     WHERE s.id=p_station_ids[v_idx]
       AND s.organization_id=p_organization_ids[v_idx]
       AND s.name=v_expected[v_idx]
   ) THEN
     RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_SCOPE_NOT_APPROVED';
   END IF;
 END LOOP;
 -- Optional companies may be added one by one later; each cNN must be
 -- attached to its exact QA station with no 13th tenant permitted.
 FOR v_idx IN 1..cardinality(p_company_ids) LOOP
   v_company_station_idx:=((v_idx-1)/3)+1;
   v_expected_company:=v_expected[v_company_station_idx]||
     '-C0'||(((v_idx-1)%3)+1)::text;
   IF NOT EXISTS (
     SELECT 1 FROM public.corporate_companies c
     JOIN public.corporate_station_accounts a ON a.company_id=c.id
     WHERE c.id=p_company_ids[v_idx]
       AND c.name=v_expected_company
       AND a.station_id=p_station_ids[v_company_station_idx]
   ) THEN
     RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='QA_SCOPE_NOT_APPROVED';
   END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)
   ORDER BY x.ord),'[]'::jsonb) INTO v_orgs
 FROM unnest(p_organization_ids) WITH ORDINALITY AS x(id,ord)
 JOIN public.organizations o ON o.id=x.id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)
   ORDER BY x.ord),'[]'::jsonb) INTO v_stations
 FROM unnest(p_station_ids) WITH ORDINALITY AS x(id,ord)
 JOIN public.stations s ON s.id=x.id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)
   ORDER BY x.ord),'[]'::jsonb) INTO v_companies
 FROM unnest(p_company_ids) WITH ORDINALITY AS x(id,ord)
 JOIN public.corporate_companies c ON c.id=x.id;
 RETURN jsonb_build_object(
   'platform',jsonb_build_array(jsonb_build_object('id',NULL,'name','Platform')),
   'organization',v_orgs,'station',v_stations,'corporate_company',v_companies);
END $fn$;
REVOKE ALL ON FUNCTION public.oilstation_qa_scope_options(text,uuid[],uuid[],uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_scope_options(text,uuid[],uuid[],uuid[])
 TO service_role;
