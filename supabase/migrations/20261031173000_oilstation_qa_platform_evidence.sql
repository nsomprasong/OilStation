-- Read-only evidence endpoint for the frozen 2026-10-31 OilStation Platform UAT.
-- Intentionally keep SELECT on business tables REVOKED from service_role.
-- Does not expose production customer data, private finance, or raw auth metadata.
CREATE OR REPLACE FUNCTION public.oilstation_qa_platform_evidence(p_qa_run_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF p_qa_run_id IS DISTINCT FROM 'QA-20261031-PLATFORM-001'
 OR (SELECT count(*) FROM auth.users u
     WHERE u.email IN ('qa-sales01@qa.oilstation.invalid',
                       'qa-sales02@qa.oilstation.invalid')
       AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id
       AND u.raw_app_meta_data->>'oilstation_qa'='true') <> 2
 THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='QA_EVIDENCE_RUN_NOT_APPROVED';
 END IF;

 RETURN pg_catalog.jsonb_build_object(
   'allStationsCount',(SELECT count(*) FROM public.stations),
   'protectedStationCount',(SELECT count(*) FROM public.stations s
      WHERE s.id='bde8e062-8ec5-44bd-91c1-9a4711ed25e5'::uuid),
   'unapprovedQaCount',(SELECT count(*) FROM public.stations s
      WHERE s.name LIKE 'QA-%' AND s.name NOT IN
        ('QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B')),
   'companiesCount',(SELECT count(*) FROM public.corporate_companies),
   'stations', (SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('id',s.id,'name',s.name,
        'organization_id',s.organization_id) ORDER BY s.name),'[]'::jsonb)
      FROM public.stations s WHERE s.name IN
        ('QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B')),
   'users', (SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('id',a.id,'email',a.email) ORDER BY a.email),'[]'::jsonb)
      FROM public.app_users a JOIN auth.users u ON u.id=a.id
      WHERE a.email IN ('qa-sales01@qa.oilstation.invalid',
                        'qa-sales02@qa.oilstation.invalid')
        AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id),
   'assignments', (SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('station_id',sa.station_id,
        'sales_user_id',sa.sales_user_id,
        'effective_until',sa.effective_until)),'[]'::jsonb)
      FROM public.sales_assignments sa JOIN public.stations s ON s.id=sa.station_id
      WHERE s.name IN ('QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B')),
   'audit', (SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('station_id',e.station_id,
        'action',e.action,'actor_id',e.actor_id)),'[]'::jsonb)
      FROM public.audit_events e JOIN public.stations s ON s.id=e.station_id
      WHERE e.action='sales_station_created'
        AND s.name IN ('QA-S01-A','QA-S01-B','QA-S02-A','QA-S02-B')),
   'requests', (SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('station_id',r.station_id,
        'actor_id',r.actor_id,'request_id',r.request_id)),'[]'::jsonb)
      FROM public.sales_station_creation_requests r
      WHERE r.actor_id IN (SELECT u.id FROM auth.users u
        WHERE u.email IN ('qa-sales01@qa.oilstation.invalid',
                          'qa-sales02@qa.oilstation.invalid')
          AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id))
 );
END $fn$;

REVOKE ALL ON FUNCTION public.oilstation_qa_platform_evidence(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oilstation_qa_platform_evidence(text)
  TO service_role;
