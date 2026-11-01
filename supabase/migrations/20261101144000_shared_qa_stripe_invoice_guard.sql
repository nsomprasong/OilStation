-- Shared OilStation Project: allow one frozen fictional QA station to back Stripe TEST
-- without enabling any production API. This function is a SERVICE-ROLE-ONLY
-- read-only scope attestation. It does not create invoices, credits or payments.
CREATE OR REPLACE FUNCTION public.qa_authorize_saas_test_invoice(
  p_actor_id uuid, p_invoice_id uuid, p_station_id uuid, p_qa_run_id text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $qa$
BEGIN
 IF p_qa_run_id IS NULL OR p_qa_run_id !~ '^QA-[0-9]{8}-[A-Z0-9-]{3,40}$'
   OR p_station_id IS NULL OR p_invoice_id IS NULL
 THEN RETURN false; END IF;
 -- Only QA identities issued for this exact run may create/retrieve intents.
 -- Stripe webhook (no human actor) supplies NULL and is separately verified by HMAC.
 IF p_actor_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM auth.users u WHERE u.id=p_actor_id
    AND u.raw_app_meta_data->>'oilstation_qa'='true'
    AND u.raw_app_meta_data->>'oilstation_qa_run_id'=p_qa_run_id
 ) THEN RETURN false; END IF;
 RETURN EXISTS(
   SELECT 1 FROM public.saas_invoices i
   JOIN public.billing_groups g ON g.id=i.billing_group_id
   JOIN public.billing_group_stations gs ON gs.billing_group_id=g.id
   JOIN public.stations s ON s.id=gs.station_id
   JOIN public.organizations o ON o.id=s.organization_id
   WHERE i.id=p_invoice_id AND gs.station_id=p_station_id
     AND s.name='QA-S01-A' AND o.name='QA-ORG-S01-A'
     AND g.organization_id=o.id
     AND i.status IN ('issued','pending','overdue','paid')
     AND i.pricing_snapshot->>'qaOnly'='true'
     AND i.pricing_snapshot->>'qaRunId'=p_qa_run_id
     AND i.pricing_snapshot->>'currency'='thb'
     AND i.total_satang BETWEEN 1000 AND 99999999
     AND (SELECT count(*) FROM public.billing_group_stations b
          WHERE b.billing_group_id=g.id)=1
     AND EXISTS(SELECT 1 FROM public.saas_invoice_lines l
                WHERE l.invoice_id=i.id AND l.station_id=p_station_id)
     AND NOT EXISTS(SELECT 1 FROM public.saas_invoice_lines l
                WHERE l.invoice_id=i.id AND l.station_id<>p_station_id)
 );
END;
$qa$;
REVOKE ALL ON FUNCTION public.qa_authorize_saas_test_invoice(uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qa_authorize_saas_test_invoice(uuid,uuid,uuid,text)
  TO service_role;
