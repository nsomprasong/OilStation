-- Plate normalization for Thai OCR: spaces, separators, Thai numerals.
-- Never use fuzzy/substring matching for vehicle identity.
CREATE OR REPLACE FUNCTION public.normalize_oilstation_plate(p_plate text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=''
AS $fn$
 SELECT translate(
   regexp_replace(upper(p_plate),'[[:space:]–—.,/_-]+','','g'),
   '๐๑๒๓๔๕๖๗๘๙','0123456789');
$fn$;
REVOKE ALL ON FUNCTION public.normalize_oilstation_plate(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_oilstation_plate(text) TO service_role;

-- Recreate ONLY start routine to use a consistent Thai-digit/punctuation plate normalization.
-- OilStation: station staff start and finish filling with price locked at start.
-- Trusted API must validate evidence upload, OCR and camera liveness; functions reject
-- plate mismatch and never release an active hold before settlement.
CREATE OR REPLACE FUNCTION public.start_reserved_fuel_session(
  p_actor_id uuid,p_coupon_id uuid,p_verified_plate text,p_plate_photo_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 c public.coupons%ROWTYPE;
 f public.station_fuel_products%ROWTYPE;
 v_account_id uuid;
 v_public numeric(12,4);
 v_net numeric(12,4);
 v_rule record;
 v_started timestamptz:=clock_timestamp();
 v_id uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO c FROM public.coupons WHERE id=p_coupon_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 IF c.status<>'reserved' OR c.expires_at<=v_started THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='COUPON_NOT_AVAILABLE';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.active
    AND ((m.scope_type='station' AND m.station_id=c.station_id AND
      (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
        OR m.extra_permissions->>'start_fueling'='true'))
     OR (m.scope_type='organization' AND m.organization_id=
      (SELECT s.organization_id FROM public.stations s WHERE s.id=c.station_id)
      AND m.role_code IN ('owner','organization_owner')))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN'; END IF;
 IF p_plate_photo_path IS NULL OR char_length(p_plate_photo_path) NOT BETWEEN 8 AND 500 THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_EVIDENCE_REQUIRED';
 END IF;
 IF c.plate_snapshot IS NOT NULL AND
  (p_verified_plate IS NULL OR
   public.normalize_oilstation_plate(p_verified_plate) <>
   public.normalize_oilstation_plate(c.plate_snapshot)) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_MISMATCH';
 END IF;
 -- Never trust the caller's typed plate/photo path as proof. A trusted OCR
 -- or supervisor review must attest the exact private Storage object.
 -- This gate denies fueling unless the private evidence was independently attested.
 IF NOT EXISTS (
  SELECT 1 FROM public.coupon_photo_checks pc
  JOIN storage.objects so
    ON so.bucket_id='oilstation-evidence' AND so.name=pc.photo_path
  WHERE pc.coupon_id=c.id AND pc.station_id=c.station_id
    AND pc.photo_path=p_plate_photo_path
    AND pc.decision IN ('verified_ocr','verified_supervisor')
    AND pc.checked_at IS NOT NULL
    AND (c.plate_snapshot IS NULL OR
       public.normalize_oilstation_plate(pc.observed_plate)=
       public.normalize_oilstation_plate(c.plate_snapshot))
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_VERIFICATION_REQUIRED';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.credit_reservations r
  WHERE r.coupon_id=c.id AND r.account_id=c.account_id
    AND r.status='held' AND r.amount_satang=c.max_amount_satang) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_RESERVATION';
 END IF;
 SELECT * INTO f FROM public.station_fuel_products
  WHERE id=c.station_fuel_id AND station_id=c.station_id AND enabled;
 IF NOT FOUND OR f.current_public_price IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRODUCT_NOT_AVAILABLE';
 END IF;
 SELECT x.price INTO v_public FROM (
  SELECT f.current_public_price AS price, '-infinity'::timestamptz AS effective_at
  UNION ALL SELECT v.public_price,v.effective_at FROM public.fuel_price_versions v
   WHERE v.station_fuel_id=f.id AND v.effective_at<=v_started
  UNION ALL SELECT sch.new_price,sch.effective_at FROM public.fuel_price_schedules sch
   WHERE sch.station_fuel_id=f.id AND sch.status IN ('pending','applied')
     AND sch.effective_at<=v_started
 ) x ORDER BY effective_at DESC LIMIT 1;
 v_net:=v_public;
 SELECT r.rule_type,r.value_per_liter INTO v_rule
   FROM public.corporate_price_rules r WHERE r.account_id=c.account_id
   AND r.station_fuel_id=f.id AND r.effective_from<=v_started
   AND (r.effective_to IS NULL OR r.effective_to>v_started)
 ORDER BY r.effective_from DESC,r.created_at DESC LIMIT 1;
 IF FOUND THEN
   IF v_rule.rule_type='fixed' THEN v_net:=v_rule.value_per_liter;
   ELSE v_net:=greatest(0::numeric,v_public-v_rule.value_per_liter); END IF;
 END IF;
 INSERT INTO public.fuel_sessions(id,coupon_id,station_id,station_fuel_id,
  operator_id,plate_verified_at,plate_verified_by,started_at,
  locked_public_price,locked_net_price)
 VALUES(v_id,c.id,c.station_id,f.id,p_actor_id,v_started,p_actor_id,v_started,
  v_public,v_net);
 INSERT INTO public.fuel_evidence(session_id,kind,storage_path)
  VALUES(v_id,'plate',p_plate_photo_path);
 UPDATE public.coupons SET status='fueling' WHERE id=c.id;
 RETURN jsonb_build_object('id',v_id,'coupon_id',c.id,'status','fueling',
  'started_at',v_started,'public_price',v_public,'corporate_price',v_net);
END
$fn$;


REVOKE ALL ON FUNCTION public.start_reserved_fuel_session(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_reserved_fuel_session(uuid,uuid,text,text)
 TO service_role;
