-- Read-only tenant scoped invoice inbox; no direct table permission.
CREATE OR REPLACE FUNCTION public.list_issued_saas_invoices(
 p_actor_id uuid,p_organization_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_records jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND
  ((m.scope_type='organization' AND m.organization_id=p_organization_id
    AND m.role_code IN ('organization_owner','owner','manager','billing_manager'))
   OR (m.scope_type='platform' AND m.role_code='platform_superadmin')))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
    'invoiceId',i.id,'invoiceNumber',i.invoice_number,
    'billingGroupId',i.billing_group_id,'billingGroupName',g.name,
    'status',i.status,'amountSatang',i.total_satang,
    'discountSatang',i.discount_satang,'taxSatang',i.tax_satang,
    'paymentMethod',i.pricing_snapshot->>'paymentMethod',
    'issuedAt',i.issued_at,'dueAt',i.due_at,'paidAt',i.paid_at)
    ORDER BY i.created_at DESC),'[]'::jsonb) INTO v_records
 FROM (SELECT * FROM public.saas_invoices si
    WHERE si.billing_group_id IN
      (SELECT id FROM public.billing_groups WHERE organization_id=p_organization_id)
      AND si.status IN ('issued','pending','overdue','paid')
    ORDER BY si.created_at DESC LIMIT 40) i
 JOIN public.billing_groups g ON g.id=i.billing_group_id
 WHERE g.organization_id=p_organization_id;
 RETURN v_records;
END $fn$;
REVOKE ALL ON FUNCTION public.list_issued_saas_invoices(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_issued_saas_invoices(uuid,uuid) TO service_role;
