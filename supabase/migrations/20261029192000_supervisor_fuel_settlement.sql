-- Supervisor must check original private pump/receipt photo; OCR is an advisory only.
-- Settlement is re-expressed as a trusted wrapper of the existing atomic finance RPC.
ALTER TABLE public.fuel_evidence_intake
 ADD COLUMN IF NOT EXISTS reviewed_liters numeric(12,3),
 ADD COLUMN IF NOT EXISTS reviewed_gross_satang bigint,
 ADD CONSTRAINT fuel_evidence_intake_positive_meter CHECK(
  reviewed_liters IS NULL OR reviewed_liters>0),
 ADD CONSTRAINT fuel_evidence_intake_positive_gross CHECK(
  reviewed_gross_satang IS NULL OR reviewed_gross_satang>0);

CREATE OR REPLACE FUNCTION public.fuel_supervisor_authorized(
 p_actor_id uuid,p_station_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.memberships m WHERE
   m.user_id=p_actor_id AND m.active AND m.scope_type='station'
   AND m.station_id=p_station_id
   AND m.role_code IN ('station_owner','owner','manager','cashier'));
$fn$;
REVOKE ALL ON FUNCTION public.fuel_supervisor_authorized(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fuel_supervisor_authorized(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fuel_photo_review_inbox(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT public.fuel_supervisor_authorized(p_actor_id,p_station_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'evidenceId',v.evidence_id,'sessionId',v.session_id,'kind',v.kind,
  'ocrPreview',v.ocr_result,'capturedAt',v.created_at)
  ORDER BY v.created_at DESC),'[]'::jsonb)
 INTO result FROM (
  SELECT i.evidence_id,e.session_id,e.kind,e.ocr_result,i.created_at
  FROM public.fuel_evidence_intake i
  JOIN public.fuel_evidence e ON e.id=i.evidence_id
  JOIN public.fuel_sessions s ON s.id=e.session_id
  WHERE s.station_id=p_station_id AND s.status='fueling'
    AND i.review_status='pending' AND i.captured_by<>p_actor_id
  ORDER BY i.created_at DESC LIMIT 40
 ) v;
 RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.fuel_review_photo_access(
 p_actor_id uuid,p_evidence_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.fuel_evidence%ROWTYPE; s public.fuel_sessions%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.fuel_evidence WHERE id=p_evidence_id;
 IF NOT FOUND OR e.kind NOT IN ('pump_display','receipt')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO s FROM public.fuel_sessions WHERE id=e.session_id;
 IF NOT public.fuel_supervisor_authorized(p_actor_id,s.station_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fuel_evidence_intake WHERE evidence_id=e.id)
  OR NOT EXISTS(SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='oilstation-evidence' AND o.name=e.storage_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN jsonb_build_object('path',e.storage_path,'kind',e.kind);
END $fn$;

CREATE OR REPLACE FUNCTION public.review_fuel_evidence_photo(
 p_actor_id uuid,p_evidence_id uuid,p_approved boolean,
 p_liters text,p_gross_satang text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.fuel_evidence%ROWTYPE;i public.fuel_evidence_intake%ROWTYPE;
 s public.fuel_sessions%ROWTYPE;v_liters numeric;v_gross bigint;
BEGIN
 SELECT * INTO e FROM public.fuel_evidence WHERE id=p_evidence_id FOR UPDATE;
 IF NOT FOUND OR e.kind NOT IN ('pump_display','receipt')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.fuel_evidence_intake WHERE evidence_id=e.id FOR UPDATE;
 SELECT * INTO s FROM public.fuel_sessions WHERE id=e.session_id;
 IF i.evidence_id IS NULL OR i.review_status<>'pending'
  OR s.status<>'fueling' OR p_approved IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF i.captured_by=p_actor_id OR
   NOT public.fuel_supervisor_authorized(p_actor_id,s.station_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o
  WHERE o.bucket_id='oilstation-evidence' AND o.name=e.storage_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF p_approved THEN
  IF p_gross_satang IS NULL OR p_gross_satang !~ '^[1-9][0-9]{0,11}$'
    OR (e.kind='pump_display' AND (p_liters IS NULL
       OR p_liters !~ '^[0-9]{1,7}(\.[0-9]{1,3})?$'))
    OR (e.kind='receipt' AND p_liters IS NOT NULL)
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  v_gross:=p_gross_satang::bigint;
  IF e.kind='pump_display' THEN
   v_liters:=p_liters::numeric;
   IF v_liters<=0 OR v_liters>9999999
    THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  END IF;
 END IF;
 UPDATE public.fuel_evidence_intake SET
  review_status=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
  reviewed_by=p_actor_id,reviewed_at=clock_timestamp(),
  reviewed_liters=v_liters,reviewed_gross_satang=v_gross
 WHERE evidence_id=e.id;
 RETURN jsonb_build_object('evidenceId',e.id,'status',
  CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END);
END $fn$;

CREATE OR REPLACE FUNCTION public.complete_reviewed_fuel_session(
 p_actor_id uuid,p_session_id uuid,p_pump_evidence_id uuid,p_receipt_evidence_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE s public.fuel_sessions%ROWTYPE;
 p record;r record;v_result jsonb;
BEGIN
 IF p_pump_evidence_id IS NULL OR p_receipt_evidence_id IS NULL
    OR p_pump_evidence_id=p_receipt_evidence_id
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO s FROM public.fuel_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- The session owner is not automatically allowed to finalize other stations.
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='station' AND m.station_id=s.station_id
   AND (m.role_code IN ('station_owner','owner','manager','cashier','attendant','pump_staff')
    OR m.extra_permissions->>'finish_fueling'='true'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT e.storage_path,i.reviewed_liters,i.reviewed_gross_satang
 INTO p FROM public.fuel_evidence e JOIN public.fuel_evidence_intake i
  ON i.evidence_id=e.id AND i.review_status='approved'
 WHERE e.id=p_pump_evidence_id AND e.session_id=s.id AND e.kind='pump_display';
 SELECT e.storage_path,i.reviewed_gross_satang
 INTO r FROM public.fuel_evidence e JOIN public.fuel_evidence_intake i
  ON i.evidence_id=e.id AND i.review_status='approved'
 WHERE e.id=p_receipt_evidence_id AND e.session_id=s.id AND e.kind='receipt';
 IF p.storage_path IS NULL OR r.storage_path IS NULL OR
   p.reviewed_liters IS NULL OR p.reviewed_liters<=0 OR
   p.reviewed_gross_satang IS NULL OR r.reviewed_gross_satang IS NULL OR
   p.reviewed_gross_satang<>r.reviewed_gross_satang OR
   NOT EXISTS(SELECT 1 FROM storage.objects o
       WHERE o.bucket_id='oilstation-evidence' AND o.name=p.storage_path) OR
   NOT EXISTS(SELECT 1 FROM storage.objects o
       WHERE o.bucket_id='oilstation-evidence' AND o.name=r.storage_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF s.status='completed' THEN
   RETURN jsonb_build_object('id',s.id,'status','completed','replayed',true,
    'gross_amount_satang',s.pump_gross_satang,'net_amount_satang',s.net_amount_satang);
 END IF;
 IF s.status<>'fueling'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Old financial routine performs ledger+hold settlement once inside this TX.
 -- It will add its own evidence references; originals and reviews are retained.
 v_result:=public.finish_reserved_fuel_session(p_actor_id,s.id,
   p.reviewed_liters,p.reviewed_gross_satang,p.storage_path,r.storage_path);
 RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.fuel_photo_review_inbox(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fuel_review_photo_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_fuel_evidence_photo(uuid,uuid,boolean,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_reviewed_fuel_session(uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fuel_photo_review_inbox(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fuel_review_photo_access(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_fuel_evidence_photo(uuid,uuid,boolean,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_reviewed_fuel_session(uuid,uuid,uuid,uuid) TO service_role;
