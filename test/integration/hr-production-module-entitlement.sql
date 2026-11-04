-- Disposable PostgreSQL 16 only; live-shaped public schema, fake roles,
-- no customer rows. Entire test transaction is rolled back.
BEGIN;
INSERT INTO public.organizations(id,name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','HR module authorization QA ONLY');
INSERT INTO public.stations(id,organization_id,name)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','HR entitled QA station'),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QR-only QA station');
INSERT INTO public.station_modules(station_id,module_code,status)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','hr_payroll','enabled'),
       ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','hr_payroll','disabled');
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.app_users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('44444444-4444-4444-8444-444444444444');
INSERT INTO public.memberships(user_id,role_code,scope_type,station_id,active)
VALUES
 ('11111111-1111-4111-8111-111111111111','hr_manager','station',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true),
 ('22222222-2222-4222-8222-222222222222','cashier','station',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true),
 ('33333333-3333-4333-8333-333333333333','station_owner','station',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',true),
 ('44444444-4444-4444-8444-444444444444','corporate_admin','station',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);

DO $assert$
DECLARE
 a uuid:='11111111-1111-4111-8111-111111111111';
 staff uuid:='22222222-2222-4222-8222-222222222222';
 outsider uuid:='33333333-3333-4333-8333-333333333333';
 wrong_role uuid:='44444444-4444-4444-8444-444444444444';
 station uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 qr_only uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
BEGIN
 IF has_function_privilege('anon','public.hr_station_module_access(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.hr_station_module_access(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.hr_station_module_access(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'UNSAFE_HR_MODULE_RPC_GRANTS';END IF;
 IF has_table_privilege('service_role','public.station_modules','SELECT')
 THEN RAISE EXCEPTION 'HR_MODULE_DIRECT_SELECT_ACCIDENTALLY_GRANTED';END IF;
 IF NOT public.hr_station_module_access(a,station)
 OR NOT public.hr_station_module_access(staff,station)
 THEN RAISE EXCEPTION 'ELIGIBLE_STAFF_DENIED';END IF;
 IF public.hr_station_module_access(outsider,station)
 OR public.hr_station_module_access(a,qr_only)
 OR public.hr_station_module_access(outsider,qr_only)
 OR public.hr_station_module_access(wrong_role,station)
 OR public.hr_station_module_access(NULL,station)
 OR public.hr_station_module_access(a,NULL)
 THEN RAISE EXCEPTION 'CROSS_STATION_OR_MODULE_GRANTED';END IF;
 UPDATE public.memberships SET active=false WHERE user_id=staff;
 IF public.hr_station_module_access(staff,station)
 THEN RAISE EXCEPTION 'REVOKED_STAFF_STILL_ENTITLED';END IF;
 RAISE NOTICE 'PASS: HR module RPC roles, cross-station, subscription and revocation';
END $assert$;
-- Test execute grants from actual Worker database role, while table SELECT
-- remains forbidden to that same role. Security definer is required here.
SET LOCAL ROLE service_role;
DO $assert$
BEGIN
 IF NOT public.hr_station_module_access(
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
 THEN RAISE EXCEPTION 'SERVICE_ROLE_CANNOT_CHECK_HR_ENTITLEMENT';END IF;
 IF public.hr_station_module_access(
   '11111111-1111-4111-8111-111111111111',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
 THEN RAISE EXCEPTION 'SERVICE_ROLE_BYPASSED_STATION_SCOPE';END IF;
 RAISE NOTICE 'PASS: private service-role HR entitlement works under revoked table grants';
END $assert$;
RESET ROLE;
ROLLBACK;
