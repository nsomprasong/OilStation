-- Platform Sales: self-only workspace, administrative owner transfer, and audit trail.
-- Read-only reports from assignments/entitlements/ledger; no commission grants or payouts.
CREATE OR REPLACE FUNCTION public.platform_sales_workspace(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_admin boolean;v_sales boolean;v_people jsonb;v_invitations jsonb;
 v_stations jsonb;v_assignments jsonb;v_commissions jsonb;v_collected jsonb;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.scope_type='platform'
   AND m.role_code='platform_superadmin' AND m.active) INTO v_admin;
 SELECT EXISTS(SELECT 1 FROM public.memberships m
   WHERE m.user_id=p_actor_id AND m.scope_type='platform'
   AND m.role_code='platform_sales' AND m.active) INTO v_sales;
 IF NOT(v_admin OR v_sales) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';
 END IF;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',p.user_id,'name',coalesce(u.display_name,u.email,'Sales'),
  'email',u.email) ORDER BY coalesce(u.display_name,u.email)),'[]'::jsonb)
 INTO v_people
 FROM (SELECT DISTINCT m.user_id FROM public.memberships m
  WHERE m.scope_type='platform' AND m.role_code='platform_sales' AND m.active
    AND (v_admin OR m.user_id=p_actor_id) LIMIT 200) p
 LEFT JOIN public.app_users u ON u.id=p.user_id;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'email',i.email,'createdAt',i.created_at,'expiresAt',i.expires_at)
  ORDER BY i.created_at DESC),'[]'::jsonb)
 INTO v_invitations FROM (
  SELECT email,created_at,expires_at FROM public.invitations
  WHERE v_admin AND scope_type='platform' AND role_code='platform_sales'
  AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>clock_timestamp()
  ORDER BY created_at DESC LIMIT 100
 ) i;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'name',s.name,'organization',o.name,'timezone',s.timezone)
  ORDER BY o.name,s.name),'[]'::jsonb)
 INTO v_stations
 FROM (SELECT id,name,organization_id,timezone FROM public.stations
  WHERE v_admin ORDER BY name LIMIT 300) s
 JOIN public.organizations o ON o.id=s.organization_id;

 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',a.id,'stationId',a.station_id,'stationName',s.name,
  'organization',o.name,'salesId',a.sales_user_id,
  'salesName',coalesce(u.display_name,u.email,'Sales'),
  'effectiveFrom',a.effective_from,'effectiveUntil',a.effective_until,
  'isCurrent',a.effective_from<=clock_timestamp()
    AND (a.effective_until IS NULL OR a.effective_until>clock_timestamp()),
  'isUpcoming',a.effective_from>clock_timestamp())
  ORDER BY a.effective_from DESC),'[]'::jsonb)
 INTO v_assignments
 FROM (SELECT id,station_id,sales_user_id,effective_from,effective_until
  FROM public.sales_assignments
  WHERE v_admin OR sales_user_id=p_actor_id
  ORDER BY effective_from DESC LIMIT 300) a
 JOIN public.stations s ON s.id=a.station_id
 JOIN public.organizations o ON o.id=s.organization_id
 LEFT JOIN public.app_users u ON u.id=a.sales_user_id;

 -- Entitlement is an accrued candidate, NOT money paid to a salesperson.
 -- Ledger totals are recorded entries only (may include reversals).
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'salesId',q.sales_user_id,'stationId',q.station_id,'stationName',q.station_name,
  'entitlementSatang',q.entitlement_satang::text,
  'recordedLedgerSatang',q.ledger_satang::text,
  'entitlementCount',q.entitlement_count) ORDER BY q.station_name),'[]'::jsonb)
 INTO v_commissions FROM (
  SELECT ids.sales_user_id,ids.station_id,s.name AS station_name,
   coalesce((SELECT sum(e.amount_satang) FROM public.commission_entitlements e
    WHERE e.sales_user_id=ids.sales_user_id AND e.station_id=ids.station_id),0) entitlement_satang,
   coalesce((SELECT count(*) FROM public.commission_entitlements e
    WHERE e.sales_user_id=ids.sales_user_id AND e.station_id=ids.station_id),0) entitlement_count,
   coalesce((SELECT sum(l.amount_satang) FROM public.commission_ledger l
    WHERE l.sales_user_id=ids.sales_user_id AND l.station_id=ids.station_id),0) ledger_satang
  FROM (
   SELECT sales_user_id,station_id FROM public.commission_entitlements
   UNION SELECT sales_user_id,station_id FROM public.commission_ledger WHERE station_id IS NOT NULL
  ) ids JOIN public.stations s ON s.id=ids.station_id
  WHERE v_admin OR ids.sales_user_id=p_actor_id
  ORDER BY s.name LIMIT 300
 ) q;

 -- Proven collected customers require a paid invoice AND an attributed entitlement.
 -- A future transfer never changes this historical paid sale attribution.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'salesId',q.sales_user_id,'stationId',q.station_id,'stationName',q.station_name,
  'organization',q.organization_name,'paidInvoices',q.paid_invoices)
  ORDER BY q.organization_name,q.station_name),'[]'::jsonb)
 INTO v_collected FROM (
  SELECT e.sales_user_id,e.station_id,s.name AS station_name,o.name AS organization_name,
   count(DISTINCT i.id) AS paid_invoices
  FROM public.commission_entitlements e
  JOIN public.saas_invoice_lines l ON l.id=e.invoice_line_id AND l.station_id=e.station_id
  JOIN public.saas_invoices i ON i.id=l.invoice_id
   AND i.status='paid' AND i.paid_at IS NOT NULL
  JOIN public.stations s ON s.id=e.station_id
  JOIN public.organizations o ON o.id=s.organization_id
  WHERE v_admin OR e.sales_user_id=p_actor_id
  GROUP BY e.sales_user_id,e.station_id,s.name,o.name
  ORDER BY o.name,s.name LIMIT 300
 ) q;

 RETURN jsonb_build_object('isAdmin',v_admin,'people',v_people,
  'pendingInvitations',v_invitations,'stations',v_stations,
  'assignments',v_assignments,'commissions',v_commissions,
  'collectedCustomers',v_collected,
  'commissionNote','Recorded entitlement/ledger only. Not a payout authorization.');
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_transfer_sales_station(
 p_actor_id uuid,p_station_id uuid,p_sales_user_id uuid,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_station public.stations%ROWTYPE;v_at timestamptz;
 v_old_sales uuid;v_old_id uuid;v_new_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_actor_id AND m.scope_type='platform'
   AND m.role_code='platform_superadmin' AND m.active)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 300
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m
  WHERE m.user_id=p_sales_user_id AND m.scope_type='platform'
  AND m.role_code='platform_sales' AND m.active)
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO v_station FROM public.stations WHERE id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- All transitions happen at next station-local 00:00 for commission prorating.
 v_at:=(((clock_timestamp() AT TIME ZONE v_station.timezone)::date + 1)::timestamp
        AT TIME ZONE v_station.timezone);
 -- Block edits to a future-scheduled transfer until reviewed, never overwrite history.
 IF EXISTS(SELECT 1 FROM public.sales_assignments a
    WHERE a.station_id=p_station_id AND a.effective_from>clock_timestamp())
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='TRANSFER_ALREADY_SCHEDULED';END IF;
 SELECT a.id,a.sales_user_id INTO v_old_id,v_old_sales
 FROM public.sales_assignments a WHERE a.station_id=p_station_id
  AND a.effective_from<=clock_timestamp()
  AND (a.effective_until IS NULL OR a.effective_until>clock_timestamp())
 ORDER BY a.effective_from DESC LIMIT 1 FOR UPDATE;
 IF v_old_sales=p_sales_user_id THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
 END IF;
 IF v_old_id IS NOT NULL THEN
  UPDATE public.sales_assignments
   SET effective_until=v_at WHERE id=v_old_id;
 END IF;
 INSERT INTO public.sales_assignments(station_id,sales_user_id,effective_from,assigned_by)
 VALUES(p_station_id,p_sales_user_id,v_at,p_actor_id) RETURNING id INTO v_new_id;
 INSERT INTO public.audit_events(actor_id,station_id,organization_id,entity_type,
  entity_id,action,before_state,after_state)
 VALUES(p_actor_id,p_station_id,v_station.organization_id,'sales_assignment',
  v_new_id::text,'sales_care_transfer',
  jsonb_build_object('oldSalesId',v_old_sales),
  jsonb_build_object('newSalesId',p_sales_user_id,'effectiveFrom',v_at,
   'reason',btrim(p_reason)));
 RETURN jsonb_build_object('assignmentId',v_new_id,'effectiveFrom',v_at,
  'previousSalesId',v_old_sales,'salesId',p_sales_user_id,'scheduled',true);
END $fn$;

REVOKE ALL ON FUNCTION public.platform_sales_workspace(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_sales_workspace(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.platform_transfer_sales_station(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_transfer_sales_station(uuid,uuid,uuid,text) TO service_role;
