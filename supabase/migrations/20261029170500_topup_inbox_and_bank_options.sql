-- Read-only finance workspaces: only the corporate account or an authorized
-- station manager may see their own bank options and unverified top-up queue.
-- Never return encrypted bank credentials to browsers.
CREATE OR REPLACE FUNCTION public.corporate_topup_bank_options(
  p_actor_id uuid,p_account_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_station uuid; v_company uuid; result jsonb;
BEGIN
  SELECT a.station_id,a.company_id INTO v_station,v_company
  FROM public.corporate_station_accounts a WHERE a.id=p_account_id;
  IF v_station IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.user_id=p_actor_id AND m.active AND m.scope_type='corporate_company'
      AND m.corporate_company_id=v_company
      AND (m.role_code IN ('corporate_admin','accountant','finance_manager')
       OR m.extra_permissions->>'request_topup'='true')
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'bankCode',b.bank_code,'accountName',b.account_name,
    'accountNumberMasked',coalesce(b.account_number_masked,''),
    'isPrimary',b.is_primary
  ) ORDER BY b.is_primary DESC,b.created_at ASC),'[]'::jsonb) INTO result
  FROM public.station_bank_accounts b
  WHERE b.station_id=v_station AND b.active;
  RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.station_pending_topup_inbox(
  p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
      AND m.scope_type='station' AND m.station_id=p_station_id
      AND (m.role_code IN ('station_owner','owner','manager','cashier','finance_manager')
        OR m.extra_permissions->>'approve_topup'='true')
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'requestId',t.id,'accountId',t.account_id,'companyName',c.name,
    'bankCode',b.bank_code,'amountSatang',t.amount_satang::text,
    'status',t.status,'requestedAt',t.created_at,
    'evidencePath',t.slip_storage_path
  ) ORDER BY t.created_at ASC,t.id),'[]'::jsonb) INTO result
  FROM public.topup_requests t
  JOIN public.corporate_station_accounts a ON a.id=t.account_id
  JOIN public.corporate_companies c ON c.id=a.company_id
  JOIN public.station_bank_accounts b ON b.id=t.station_bank_id
  WHERE a.station_id=p_station_id AND t.status='pending';
  RETURN result;
END $fn$;

REVOKE ALL ON FUNCTION public.corporate_topup_bank_options(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.station_pending_topup_inbox(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.corporate_topup_bank_options(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.station_pending_topup_inbox(uuid,uuid) TO service_role;
