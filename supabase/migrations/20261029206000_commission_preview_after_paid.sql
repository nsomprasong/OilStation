-- Privileged read-only provenance for commission previews from SaaS receipts.
-- Does NOT insert commission_entitlements or commission_ledger, never pays Sales.
CREATE OR REPLACE FUNCTION public.platform_paid_saas_commission_context(
 p_actor_id uuid,p_invoice_line_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE l public.saas_invoice_lines%ROWTYPE;
 i public.saas_invoices%ROWTYPE;
 s public.stations%ROWTYPE;
 start_day date;end_day date;base_satang bigint;
 v_assignments jsonb;v_rules jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO l FROM public.saas_invoice_lines WHERE id=p_invoice_line_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO i FROM public.saas_invoices WHERE id=l.invoice_id;
 IF NOT FOUND OR i.status<>'paid' OR i.paid_at IS NULL
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO s FROM public.stations WHERE id=l.station_id;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.billing_group_stations bgs
    WHERE bgs.station_id=l.station_id AND bgs.billing_group_id=i.billing_group_id)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF l.price_snapshot->>'serviceStart' IS NULL OR
    l.price_snapshot->>'serviceEnd' IS NULL OR
    l.price_snapshot->>'commissionBaseSatang' IS NULL OR
    l.price_snapshot->>'serviceStart' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR
    l.price_snapshot->>'serviceEnd' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR
    l.price_snapshot->>'commissionBaseSatang' !~ '^[0-9]{1,12}$'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 start_day:=(l.price_snapshot->>'serviceStart')::date;
 end_day:=(l.price_snapshot->>'serviceEnd')::date;
 base_satang:=(l.price_snapshot->>'commissionBaseSatang')::bigint;
 IF end_day<=start_day OR end_day>start_day+35 OR
   base_satang<0 OR base_satang>l.amount_satang-l.discount_satang
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- All boundary changes must occur at 00:00 station-local time. Do not guess
 -- whether a mid-day Sales transfer has a full day's commission.
 IF EXISTS(SELECT 1 FROM public.sales_assignments a WHERE a.station_id=s.id
   AND (a.effective_from AT TIME ZONE s.timezone)::date<end_day
   AND coalesce((a.effective_until AT TIME ZONE s.timezone)::date,end_day)>start_day
   AND ((a.effective_from AT TIME ZONE s.timezone)::time<>'00:00'::time OR
      (a.effective_until IS NOT NULL AND
       (a.effective_until AT TIME ZONE s.timezone)::time<>'00:00'::time)))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'salesId',a.sales_user_id,
    'from',greatest((a.effective_from AT TIME ZONE s.timezone)::date,start_day)::text,
    'until',least(coalesce((a.effective_until AT TIME ZONE s.timezone)::date,end_day),end_day)::text)
    ORDER BY a.effective_from),'[]'::jsonb)
 INTO v_assignments FROM public.sales_assignments a
 WHERE a.station_id=s.id
   AND (a.effective_from AT TIME ZONE s.timezone)::date<end_day
   AND coalesce((a.effective_until AT TIME ZONE s.timezone)::date,end_day)>start_day;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'salesId',r.sales_user_id,'mode',r.mode,
   'amount',r.amount::text,'payoutPolicy',r.payout_policy,
   'from',(r.effective_from AT TIME ZONE s.timezone)::date::text,
   'until',(r.effective_until AT TIME ZONE s.timezone)::date::text)
  ORDER BY r.effective_from),'[]'::jsonb)
 INTO v_rules FROM public.commission_rules r
 WHERE r.station_id=s.id AND (r.effective_from AT TIME ZONE s.timezone)::date<end_day
   AND coalesce((r.effective_until AT TIME ZONE s.timezone)::date,end_day)>start_day;
 RETURN jsonb_build_object('invoiceId',i.id,'invoiceLineId',l.id,
   'stationId',s.id,'invoicePaid',true,'netRevenueSatang',base_satang::text,
   'serviceStart',start_day,'serviceEnd',end_day,
   'assignments',v_assignments,'rules',v_rules);
END $fn$;
REVOKE ALL ON FUNCTION public.platform_paid_saas_commission_context(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_paid_saas_commission_context(uuid,uuid)
 TO service_role;
