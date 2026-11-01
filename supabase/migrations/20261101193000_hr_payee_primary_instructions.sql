-- Only latest independently approved primary account can receive transfer instructions.
CREATE OR REPLACE FUNCTION public.hr_reveal_approved_payee(
 p_actor_id uuid,p_method_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE p public.employee_payment_methods%ROWTYPE;e public.employees%ROWTYPE;
 v_value text;
BEGIN
 SELECT * INTO p FROM public.employee_payment_methods WHERE id=p_method_id
  AND status='approved' AND is_primary=true AND vault_secret_id IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYEE_NOT_APPROVED';END IF;
 SELECT * INTO e FROM public.employees WHERE id=p.employee_id;
 IF p_actor_id=e.user_id OR NOT EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
  AND m.scope_type='station' AND m.station_id=e.station_id
  AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT decrypted_secret INTO v_value FROM vault.decrypted_secrets WHERE id=p.vault_secret_id;
 IF v_value IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PAYEE_UNAVAILABLE';END IF;
 INSERT INTO public.audit_events(actor_id,station_id,entity_type,entity_id,action)
 VALUES(p_actor_id,e.station_id,'employee_payment_method',p.id::text,'payee_transfer_instruction_opened');
 RETURN jsonb_build_object('id',p.id,'employeeId',e.id,'employeeName',e.display_name,
 'type',p.payment_type,'reference',v_value,'bankCode',p.bank_code,
 'verifiedName',p.verified_name,'masked',p.masked_reference,'status','instruction_only');
END $f$;


REVOKE ALL ON FUNCTION public.hr_reveal_approved_payee(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_reveal_approved_payee(uuid,uuid) TO service_role;
