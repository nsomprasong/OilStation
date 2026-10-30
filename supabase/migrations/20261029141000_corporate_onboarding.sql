-- Corporate onboarding is station-scoped. All new wallets begin at zero.
-- Existing companies must be linked through a separate mutual-approval workflow.
CREATE UNIQUE INDEX IF NOT EXISTS corporate_tax_id_verified_unique
ON public.corporate_companies (regexp_replace(tax_id,'[^0-9]','','g'))
WHERE tax_id IS NOT NULL AND btrim(tax_id) <> '';

CREATE OR REPLACE FUNCTION public.station_create_corporate_customer(
 p_actor_id uuid, p_station_id uuid,p_name text,p_tax_id text,
 p_contact_email text,p_payment_terms_days integer,p_due_mode text,
 p_statement_close_day integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
 v_org_id uuid; v_company_id uuid:=gen_random_uuid();
 v_account_id uuid:=gen_random_uuid();
 v_clean_tax text:=nullif(regexp_replace(coalesce(p_tax_id,''),'[^0-9]','','g'),'');
BEGIN
 SELECT organization_id INTO v_org_id FROM public.stations WHERE id=p_station_id;
 IF NOT FOUND OR NOT EXISTS(
   SELECT 1 FROM public.station_modules sm WHERE sm.station_id=p_station_id
   AND sm.module_code='qr_coupon' AND sm.status='enabled'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='STATION_NOT_AVAILABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active AND m.user_id=p_actor_id
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='organization' AND m.organization_id=v_org_id
     AND m.role_code IN ('organization_owner','owner'))
   OR (m.scope_type='station' AND m.station_id=p_station_id
     AND (m.role_code IN ('station_owner','owner','manager')
       OR m.extra_permissions->>'manage_corporate_customers'='true')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 200
  OR (p_tax_id IS NOT NULL AND (char_length(p_tax_id)>32 OR (v_clean_tax IS NOT NULL AND char_length(v_clean_tax)<>13)))
  OR (p_contact_email IS NOT NULL AND (length(p_contact_email)>320
    OR p_contact_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'))
  OR p_payment_terms_days NOT BETWEEN 0 AND 365
  OR p_due_mode NOT IN ('per_fill','statement')
  OR (p_due_mode='statement' AND p_statement_close_day IS NULL)
  OR (p_statement_close_day IS NOT NULL AND p_statement_close_day NOT BETWEEN 1 AND 31)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 IF v_clean_tax IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.corporate_companies c WHERE c.tax_id=v_clean_tax) THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='COMPANY_ALREADY_EXISTS';
 END IF;
 INSERT INTO public.corporate_companies(id,name,tax_id,contact_email)
 VALUES(v_company_id,btrim(p_name),v_clean_tax,nullif(lower(btrim(p_contact_email)),''));
 INSERT INTO public.corporate_station_accounts(id,station_id,company_id,
  due_mode,payment_terms_days,statement_close_day)
 VALUES(v_account_id,p_station_id,v_company_id,p_due_mode,p_payment_terms_days,p_statement_close_day);
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action,after_state)
 VALUES(p_actor_id,p_station_id,'corporate_company',v_company_id::text,
  'corporate_customer_created',jsonb_build_object('account_id',v_account_id));
 RETURN jsonb_build_object('companyId',v_company_id,'accountId',v_account_id,
  'stationId',p_station_id,'name',btrim(p_name));
END $f$;
REVOKE ALL ON FUNCTION public.station_create_corporate_customer(
 uuid,uuid,text,text,text,integer,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_create_corporate_customer(
 uuid,uuid,text,text,text,integer,text,integer) TO service_role;

-- Two-party authorization: station operator requests an existing corporate link,
-- corporation administrator must approve before account materializes.
CREATE TABLE public.corporate_station_link_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 company_id uuid NOT NULL REFERENCES public.corporate_companies(id),
 requested_by uuid NOT NULL REFERENCES public.app_users(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 reviewed_by uuid REFERENCES public.app_users(id),
 reviewed_at timestamptz,
 requested_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(station_id,company_id)
);
ALTER TABLE public.corporate_station_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_station_link_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_station_link_requests FROM PUBLIC,anon,authenticated;
CREATE INDEX corporate_link_requests_company_pending
 ON public.corporate_station_link_requests(company_id,status);

CREATE OR REPLACE FUNCTION public.request_corporate_station_link(
 p_actor_id uuid,p_station_id uuid,p_company_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_org_id uuid; v_id uuid;
BEGIN
 SELECT organization_id INTO v_org_id FROM public.stations WHERE id=p_station_id;
 IF v_org_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.corporate_companies WHERE id=p_company_id AND status='active'
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND ((m.scope_type='platform' AND m.role_code='platform_superadmin')
   OR (m.scope_type='organization' AND m.organization_id=v_org_id
    AND m.role_code IN ('organization_owner','owner'))
   OR (m.scope_type='station' AND m.station_id=p_station_id
    AND m.role_code IN ('station_owner','owner','manager')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF EXISTS(SELECT 1 FROM public.corporate_station_accounts WHERE station_id=p_station_id AND company_id=p_company_id) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='ALREADY_LINKED'; END IF;
 INSERT INTO public.corporate_station_link_requests(station_id,company_id,requested_by)
 VALUES(p_station_id,p_company_id,p_actor_id)
 ON CONFLICT(station_id,company_id) DO UPDATE SET
  status='pending',requested_by=excluded.requested_by,requested_at=clock_timestamp(),
  reviewed_by=NULL,reviewed_at=NULL
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('requestId',v_id,'status','pending');
END $f$;
REVOKE ALL ON FUNCTION public.request_corporate_station_link(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_corporate_station_link(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.approve_corporate_station_link(
 p_actor_id uuid,p_request_id uuid,p_approved boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_request public.corporate_station_link_requests%ROWTYPE; v_account uuid;
BEGIN
 SELECT * INTO v_request FROM public.corporate_station_link_requests
 WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='corporate_company' AND m.corporate_company_id=v_request.company_id
  AND m.role_code='corporate_admin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF v_request.status<>'pending' THEN
  RETURN jsonb_build_object('status',v_request.status,'replayed',true);
 END IF;
 IF p_approved IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p_approved THEN
  INSERT INTO public.corporate_station_accounts(station_id,company_id)
  VALUES(v_request.station_id,v_request.company_id)
  ON CONFLICT(station_id,company_id) DO UPDATE SET station_id=excluded.station_id
  RETURNING id INTO v_account;
 END IF;
 UPDATE public.corporate_station_link_requests SET
  status=case when p_approved then 'approved' else 'rejected' end,
  reviewed_by=p_actor_id,reviewed_at=clock_timestamp()
 WHERE id=p_request_id;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,v_request.station_id,'corporate_station_link',p_request_id::text,
  case when p_approved then 'approved' else 'rejected' end);
 RETURN jsonb_build_object('status',case when p_approved then 'approved' else 'rejected' end,
  'accountId',v_account,'replayed',false);
END $f$;
REVOKE ALL ON FUNCTION public.approve_corporate_station_link(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_corporate_station_link(uuid,uuid,boolean) TO service_role;
