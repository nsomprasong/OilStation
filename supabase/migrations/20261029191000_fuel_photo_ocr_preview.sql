-- OCR result is a non-authoritative preview. No approval or financial posting.
CREATE OR REPLACE FUNCTION public.fuel_photo_ocr_context(
 p_actor_id uuid,p_evidence_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.fuel_evidence%ROWTYPE;i public.fuel_evidence_intake%ROWTYPE;
 s public.fuel_sessions%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.fuel_evidence WHERE id=p_evidence_id;
 IF NOT FOUND OR e.kind NOT IN ('pump_display','receipt')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.fuel_evidence_intake WHERE evidence_id=e.id;
 SELECT * INTO s FROM public.fuel_sessions WHERE id=e.session_id;
 IF i.evidence_id IS NULL OR s.id IS NULL OR i.review_status<>'pending' OR s.status<>'fueling'
  OR NOT EXISTS(SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='oilstation-evidence' AND o.name=e.storage_path)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 PERFORM public.authorize_fuel_photo_upload(p_actor_id,e.session_id,e.kind);
 RETURN jsonb_build_object('path',e.storage_path,'kind',e.kind);
END $fn$;
CREATE OR REPLACE FUNCTION public.record_fuel_photo_ocr_preview(
 p_actor_id uuid,p_evidence_id uuid,p_liters text,p_gross_satang text,
 p_confidence numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.fuel_evidence%ROWTYPE;i public.fuel_evidence_intake%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.fuel_evidence WHERE id=p_evidence_id FOR UPDATE;
 IF NOT FOUND OR e.kind NOT IN ('pump_display','receipt')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.fuel_evidence_intake
  WHERE evidence_id=e.id FOR UPDATE;
 PERFORM public.authorize_fuel_photo_upload(p_actor_id,e.session_id,e.kind);
 IF i.evidence_id IS NULL OR i.review_status<>'pending'
  OR (p_liters IS NOT NULL AND (e.kind<>'pump_display'
       OR p_liters !~ '^[0-9]{1,7}\.[0-9]{3}$'))
  OR (p_gross_satang IS NOT NULL AND p_gross_satang !~ '^[0-9]{1,12}$')
  OR (p_confidence IS NOT NULL AND p_confidence NOT BETWEEN 0 AND 1)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.fuel_evidence SET ocr_result=jsonb_build_object(
  'status','needs_human_review','liters',p_liters,
  'grossSatang',p_gross_satang,'confidence',p_confidence)
 WHERE id=e.id;
 RETURN jsonb_build_object('evidenceId',e.id,'verified',false,
   'status','needs_human_review');
END $fn$;
REVOKE ALL ON FUNCTION public.fuel_photo_ocr_context(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_fuel_photo_ocr_preview(uuid,uuid,text,text,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fuel_photo_ocr_context(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_fuel_photo_ocr_preview(uuid,uuid,text,text,numeric)
 TO service_role;
