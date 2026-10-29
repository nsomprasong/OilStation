-- Super-admin-only billing overview for setup and draft/issue review.
CREATE OR REPLACE FUNCTION public.platform_saas_billing_overview(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 RETURN jsonb_build_object(
  'organizations',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',o.id,'name',o.name) ORDER BY o.name)
   FROM(SELECT id,name FROM public.organizations ORDER BY name LIMIT 100) o),'[]'::jsonb),
  'stations',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',s.id,'name',s.name,'organizationId',s.organization_id,
   'moduleCodes',(SELECT coalesce(jsonb_agg(sm.module_code ORDER BY sm.module_code),'[]'::jsonb)
     FROM public.station_modules sm WHERE sm.station_id=s.id AND sm.status='enabled'))
    ORDER BY s.name)
   FROM(SELECT id,name,organization_id FROM public.stations ORDER BY name LIMIT 200) s),'[]'::jsonb),
  'plans',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',p.id,'code',p.code,'name',p.name,'frequency',p.billing_frequency,
   'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('moduleCode',pr.module_code,
      'priceSatang',pr.price_satang) ORDER BY pr.module_code),'[]'::jsonb)
     FROM public.pricing_rules pr WHERE pr.plan_id=p.id)) ORDER BY p.created_at DESC)
   FROM(SELECT * FROM public.pricing_plans ORDER BY created_at DESC LIMIT 100) p),'[]'::jsonb),
  'groups',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',g.id,'name',g.name,'organizationId',g.organization_id,
    'stationIds',(SELECT coalesce(jsonb_agg(bgs.station_id ORDER BY bgs.station_id),'[]'::jsonb)
      FROM public.billing_group_stations bgs WHERE bgs.billing_group_id=g.id))
      ORDER BY g.created_at DESC)
    FROM(SELECT * FROM public.billing_groups ORDER BY created_at DESC LIMIT 100) g),'[]'::jsonb),
  'subscriptions',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'stationId',s.station_id,'planId',s.plan_id,'status',s.status,
    'periodEnd',s.current_period_end) ORDER BY s.created_at DESC)
    FROM(SELECT * FROM public.station_subscriptions ORDER BY created_at DESC LIMIT 200) s),'[]'::jsonb),
  'taxPolicy',(SELECT jsonb_build_object('id',t.id,'vatMode',t.vat_mode,
    'rateBasisPoints',t.rate_basis_points,'effectiveOn',t.effective_on,
    'approvedAt',t.approved_at) FROM public.saas_tax_review_policies t
    ORDER BY t.effective_on DESC,t.approved_at DESC LIMIT 1),
  'invoices',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'invoiceId',i.id,'number',i.invoice_number,'status',i.status,
    'billingGroupId',i.billing_group_id,'amountSatang',i.total_satang,
    'paymentMethod',i.pricing_snapshot->>'paymentMethod',
    'serviceStart',i.pricing_snapshot->>'serviceStart',
    'serviceEnd',i.pricing_snapshot->>'serviceEnd',
    'lines',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'lineId',l.id,'stationId',l.station_id,'moduleCode',l.module_code,
      'amountSatang',l.amount_satang,'discountSatang',l.discount_satang)
       ORDER BY l.id),'[]'::jsonb)
      FROM public.saas_invoice_lines l WHERE l.invoice_id=i.id))
      ORDER BY i.created_at DESC)
    FROM(SELECT * FROM public.saas_invoices ORDER BY created_at DESC LIMIT 60) i),'[]'::jsonb)
 );
END $fn$;
REVOKE ALL ON FUNCTION public.platform_saas_billing_overview(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_saas_billing_overview(uuid) TO service_role;
