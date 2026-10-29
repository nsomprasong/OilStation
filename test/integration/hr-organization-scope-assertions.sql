-- Run only on the isolated 65-table Supabase-shaped PostgreSQL fixture.
-- No real staff data, wages or shifts; all modifications ROLLBACK.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.app_users(id,email)
 VALUES('11111111-1111-4111-8111-111111111111','org-owner@example.invalid'),
       ('22222222-2222-4222-8222-222222222222','foreign-owner@example.invalid');
INSERT INTO public.organizations(id,name) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fictional Organization A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fictional Organization B');
INSERT INTO public.stations(id,organization_id,name) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fictional Station A'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Fictional Station B');
INSERT INTO public.station_modules(station_id,module_code,status) VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','hr_payroll','enabled'),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','hr_payroll','enabled');
INSERT INTO public.memberships(user_id,scope_type,role_code,organization_id) VALUES
 ('11111111-1111-4111-8111-111111111111','organization','organization_owner',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','organization','organization_owner',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.employees(id,station_id,employee_code,display_name) VALUES
 ('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','EMP-A1','Synthetic Employee A'),
 ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','EMP-B1','Synthetic Employee B');
DO $test$
DECLARE
 owner_a uuid:='11111111-1111-4111-8111-111111111111';
 owner_b uuid:='22222222-2222-4222-8222-222222222222';
 station_a uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 station_b uuid:='bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
 employee_a uuid:='aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
 employee_b uuid:='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
 template_a uuid;template_b uuid;bad boolean;answer jsonb;
BEGIN
 answer:=public.hr_seed_shift_templates(owner_a,station_a);
 IF answer->>'created'<>'3' THEN RAISE EXCEPTION 'organization_owner_cannot_seed_own_station %',answer;END IF;
 answer:=public.hr_seed_shift_templates(owner_a,station_a);
 IF answer->>'created'<>'0' THEN RAISE EXCEPTION 'seed_shift_templates_not_idempotent';END IF;
 SELECT id INTO template_a FROM public.shift_templates
  WHERE station_id=station_a AND name='กะเช้า';
 IF template_a IS NULL THEN RAISE EXCEPTION 'own_station_shift_templates_missing';END IF;
 answer:=public.hr_assign_shift(owner_a,employee_a,template_a,current_date+1);
 IF answer->>'employeeId'<>employee_a::text THEN
  RAISE EXCEPTION 'organization_owner_cannot_assign_own_staff %',answer;END IF;
 IF (SELECT count(*) FROM public.shift_assignments
  WHERE employee_id=employee_a AND shift_template_id=template_a)<>1
 THEN RAISE EXCEPTION 'own_station_shift_not_recorded_once';END IF;
 answer:=public.hr_assign_shift(owner_a,employee_a,template_a,current_date+1);
 IF (SELECT count(*) FROM public.shift_assignments WHERE employee_id=employee_a)<>1
 THEN RAISE EXCEPTION 'duplicate_shift_scheduled';END IF;
 bad:=false;
 BEGIN PERFORM public.hr_seed_shift_templates(owner_a,station_b);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'cross_organization_shift_seed_allowed';END IF;
 PERFORM public.hr_seed_shift_templates(owner_b,station_b);
 SELECT id INTO template_b FROM public.shift_templates
  WHERE station_id=station_b AND name='กะเช้า';
 bad:=false;
 BEGIN PERFORM public.hr_assign_shift(owner_a,employee_b,template_b,current_date+1);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'cross_organization_shift_assignment_allowed';END IF;
 bad:=false;
 BEGIN PERFORM public.hr_assign_shift(owner_a,employee_a,template_b,current_date+1);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='INVALID_SHIFT';END;
 IF NOT bad THEN RAISE EXCEPTION 'cross_station_employee_template_join_allowed';END IF;
 IF EXISTS(SELECT 1 FROM public.shift_assignments WHERE employee_id=employee_b)
 THEN RAISE EXCEPTION 'cross_organization_shift_was_written';END IF;
 IF (SELECT count(*) FROM public.shift_templates WHERE station_id=station_b)<>3
 THEN RAISE EXCEPTION 'foreign_shift_templates_mutated';END IF;
END $test$;
ROLLBACK;
