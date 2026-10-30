-- Trusted-only OCR and dual-control supervisor review for private plate evidence.
-- Keep unapplied until isolated integration database checks and release approval.
CREATE OR REPLACE FUNCTION public.station_plate_ocr_context(
 p_actor_id uuid,p_photo_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.coupon_photo_checks%ROWTYPE; c public.coupons%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.coupon_photo_checks WHERE id=p_photo_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 PERFORM public.authorize_station_plate_upload(p_actor_id,p.station_id,p.coupon_id);
 SELECT * INTO c FROM public.coupons WHERE id=p.coupon_id AND station_id=p.station_id;
 IF p.decision<>'pending' OR c.status NOT IN ('reserved','verified')
   OR c.expires_at<=clock_timestamp()
   OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='oilstation-evidence' AND o.name=p.photo_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN jsonb_build_object('path',p.photo_path,'expectedPlate',c.plate_snapshot);
END $fn$;

CREATE OR REPLACE FUNCTION public.complete_station_plate_ocr(
 p_actor_id uuid,p_photo_id uuid,p_observed_plate text,p_accepted boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.coupon_photo_checks%ROWTYPE; c public.coupons%ROWTYPE;
 v_observed text;v_expected text;v_ok boolean;
BEGIN
 SELECT pc.coupon_id INTO c.id FROM public.coupon_photo_checks pc WHERE pc.id=p_photo_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO c FROM public.coupons WHERE id=c.id FOR UPDATE;
 SELECT * INTO p FROM public.coupon_photo_checks WHERE id=p_photo_id FOR UPDATE;
 PERFORM public.authorize_station_plate_upload(p_actor_id,p.station_id,p.coupon_id);
 IF p.decision<>'pending' OR c.status NOT IN ('reserved','verified')
    OR c.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_observed:=translate(regexp_replace(upper(coalesce(p_observed_plate,'')),
      '[[:space:]–—./_-]+','','g'),'๐๑๒๓๔๕๖๗๘๙','0123456789');
 v_expected:=translate(regexp_replace(upper(coalesce(c.plate_snapshot,'')),
      '[[:space:]–—./_-]+','','g'),'๐๑๒๓๔๕๖๗๘๙','0123456789');
 v_ok:=coalesce(p_accepted,false) AND char_length(v_observed) BETWEEN 2 AND 16
    AND (c.plate_snapshot IS NULL OR v_observed=v_expected);
 UPDATE public.coupon_photo_checks SET observed_plate=nullif(v_observed,''),
  decision=CASE WHEN v_ok THEN 'verified_ocr' ELSE 'pending' END,
  checked_at=CASE WHEN v_ok THEN clock_timestamp() ELSE NULL END,
  checked_by=NULL WHERE id=p_photo_id;
 RETURN jsonb_build_object('photoId',p.id,'status',CASE WHEN v_ok THEN 'verified_ocr' ELSE 'pending_review' END,'verified',v_ok);
END $fn$;

CREATE OR REPLACE FUNCTION public.review_station_plate_photo(
 p_actor_id uuid,p_photo_id uuid,p_observed_plate text,p_approved boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.coupon_photo_checks%ROWTYPE; c public.coupons%ROWTYPE;
 v_observed text; v_expected text;
BEGIN
 SELECT coupon_id INTO c.id FROM public.coupon_photo_checks WHERE id=p_photo_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO c FROM public.coupons WHERE id=c.id FOR UPDATE;
 SELECT * INTO p FROM public.coupon_photo_checks WHERE id=p_photo_id FOR UPDATE;
 IF p.decision<>'pending' OR c.status NOT IN ('reserved','verified')
    OR c.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p.captured_by=p_actor_id OR NOT EXISTS(
    SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
    AND m.scope_type='station' AND m.station_id=p.station_id
    AND m.role_code IN ('station_owner','owner','manager','cashier')
 ) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='oilstation-evidence' AND o.name=p.photo_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST'; END IF;
 v_observed:=translate(regexp_replace(upper(coalesce(p_observed_plate,'')),
      '[[:space:]–—./_-]+','','g'),'๐๑๒๓๔๕๖๗๘๙','0123456789');
 v_expected:=translate(regexp_replace(upper(coalesce(c.plate_snapshot,'')),
      '[[:space:]–—./_-]+','','g'),'๐๑๒๓๔๕๖๗๘๙','0123456789');
 IF p_approved AND (char_length(v_observed) NOT BETWEEN 2 AND 16
   OR (c.plate_snapshot IS NOT NULL AND v_observed<>v_expected))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PLATE_MISMATCH';END IF;
 UPDATE public.coupon_photo_checks SET observed_plate=nullif(v_observed,''),
  decision=CASE WHEN p_approved THEN 'verified_supervisor' ELSE 'rejected' END,
  checked_by=p_actor_id,checked_at=clock_timestamp() WHERE id=p_photo_id;
 RETURN jsonb_build_object('photoId',p.id,'status',
   CASE WHEN p_approved THEN 'verified_supervisor' ELSE 'rejected' END,
   'verified',p_approved);
END $fn$;
REVOKE ALL ON FUNCTION public.station_plate_ocr_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_station_plate_ocr(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_station_plate_photo(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.station_plate_ocr_context(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_station_plate_ocr(uuid,uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_station_plate_photo(uuid,uuid,text,boolean) TO service_role;
