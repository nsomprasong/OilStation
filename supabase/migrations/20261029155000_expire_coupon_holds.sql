-- Release stale coupon holds in small, lock-safe batches. Does not touch
-- fueling/completed coupons. Intended for a reviewed scheduler (e.g. Worker
-- Cron) and safe to run repeatedly. A transaction either releases exactly
-- once, or rolls back coupon state, wallet and journal together.
CREATE OR REPLACE FUNCTION public.expire_reserved_coupons(
 p_limit integer DEFAULT 200
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_coupon public.coupons%ROWTYPE;
 v_hold public.credit_reservations%ROWTYPE;
 v_count integer:=0;
 v_total bigint:=0;
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 FOR v_coupon IN
  SELECT * FROM public.coupons
  WHERE status IN ('reserved','verified') AND expires_at<=v_now
  ORDER BY expires_at,id
  LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  SELECT * INTO v_hold FROM public.credit_reservations
  WHERE coupon_id=v_coupon.id FOR UPDATE;
  IF NOT FOUND OR v_hold.status<>'held'
   OR v_hold.amount_satang<>v_coupon.max_amount_satang THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
  END IF;
  UPDATE public.corporate_station_accounts
   SET reserved_satang=reserved_satang-v_hold.amount_satang
   WHERE id=v_coupon.account_id AND reserved_satang>=v_hold.amount_satang;
  IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
  END IF;
  UPDATE public.credit_reservations
   SET released_satang=amount_satang,status='released',closed_at=v_now
   WHERE id=v_hold.id;
  UPDATE public.coupons SET status='expired' WHERE id=v_coupon.id;
  UPDATE public.coupon_versions SET revoked_at=v_now
   WHERE coupon_id=v_coupon.id AND revoked_at IS NULL;
  INSERT INTO public.wallet_ledger(account_id,entry_type,delta_reserved_satang,
   reference_type,reference_id)
  VALUES(v_coupon.account_id,'coupon_expired_release',-v_hold.amount_satang,
   'coupon',v_coupon.id);
  v_count:=v_count+1;
  v_total:=v_total+v_hold.amount_satang;
 END LOOP;
 RETURN jsonb_build_object('expired',v_count,'releasedSatang',v_total::text);
END $fn$;
REVOKE ALL ON FUNCTION public.expire_reserved_coupons(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_reserved_coupons(integer) TO service_role;
