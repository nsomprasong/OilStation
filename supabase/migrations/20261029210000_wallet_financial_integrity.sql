-- Snapshot-only wallet invariants for troubleshooting, never mutation.
-- This does NOT prove the bank ledger or historical opening balance.
CREATE OR REPLACE FUNCTION public.corporate_wallet_integrity_snapshot(
 p_actor_id uuid,p_account_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a public.corporate_station_accounts%ROWTYPE;
 v_held bigint;v_receivable bigint;v_invalid bigint;v_unheld bigint;
 v_healthy boolean;
BEGIN
 IF p_actor_id IS NULL OR p_account_id IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO a FROM public.corporate_station_accounts WHERE id=p_account_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active AND (
   (m.scope_type='corporate_company' AND m.corporate_company_id=a.company_id
    AND m.role_code IN ('corporate_admin','accountant','finance_manager'))
   OR (m.scope_type='station' AND m.station_id=a.station_id
    AND m.role_code IN ('station_owner','owner','manager','finance_manager'))
   OR (m.scope_type='platform' AND m.role_code='platform_superadmin')))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;

 SELECT coalesce(sum(r.amount_satang),0)::bigint,
  count(*) FILTER(WHERE c.id IS NULL OR c.account_id<>a.id
   OR c.station_id<>a.station_id
   OR (r.status='held' AND (
      c.status NOT IN ('reserved','verified','fueling')
      OR r.consumed_satang<>0 OR r.released_satang<>0
      OR r.amount_satang<>c.max_amount_satang))
   OR (r.status='settled' AND (
      c.status<>'completed' OR r.consumed_satang+r.released_satang<>r.amount_satang))
   OR (r.status='released' AND (
      c.status NOT IN ('cancelled','expired')
      OR r.consumed_satang+r.released_satang<>r.amount_satang)))
 INTO v_held,v_invalid
 FROM public.credit_reservations r LEFT JOIN public.coupons c ON c.id=r.coupon_id
 WHERE r.account_id=a.id AND r.status IN ('held','settled','released');
 -- v_held must count HELD reservations only: the validity scan includes
 -- settled/released records but they are no longer a hold against credit.
 SELECT coalesce(sum(r.amount_satang),0)::bigint INTO v_held
 FROM public.credit_reservations r WHERE r.account_id=a.id AND r.status='held';

 SELECT count(*) INTO v_unheld FROM public.coupons c
 WHERE c.account_id=a.id AND c.status IN ('reserved','verified','fueling')
   AND NOT EXISTS(SELECT 1 FROM public.credit_reservations r
     WHERE r.coupon_id=c.id AND r.account_id=a.id AND r.status='held');

 SELECT coalesce(sum(ar.outstanding_satang),0)::bigint INTO v_receivable
 FROM public.accounts_receivable ar WHERE ar.account_id=a.id;
 v_healthy:=(a.prepaid_balance_satang>=0 AND a.reserved_satang>=0
    AND a.debt_outstanding_satang>=0
    AND v_held=a.reserved_satang AND v_receivable=a.debt_outstanding_satang
    AND v_invalid=0 AND v_unheld=0);
 RETURN jsonb_build_object(
  'accountId',a.id,'stationId',a.station_id,
  'status',CASE WHEN v_healthy THEN 'balanced' ELSE 'attention_required' END,
  'healthy',v_healthy,
  'reservedSatang',a.reserved_satang::text,'heldCouponSatang',v_held::text,
  'debtSatang',a.debt_outstanding_satang::text,
  'receivableSatang',v_receivable::text,
  'invalidReservationCount',v_invalid,'unheldActiveCouponCount',v_unheld,
  'readOnly',true,'bankReconciled',false,'openingLedgerAudited',false);
END $fn$;
REVOKE ALL ON FUNCTION public.corporate_wallet_integrity_snapshot(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.corporate_wallet_integrity_snapshot(uuid,uuid)
 TO service_role;
