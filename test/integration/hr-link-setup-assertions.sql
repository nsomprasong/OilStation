-- Disposable PostgreSQL only: HR manager setup list, privacy, linking and GPS defaults.
BEGIN;
DO $test$
DECLARE
 owner_a uuid:='11111111-1111-4111-8111-111111111111';
 owner_b uuid:='33333333-3333-4333-8333-333333333333';
 station_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 station_b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 employee_a uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
 staff_a uuid:='55555555-5555-4555-8555-555555555555';
 d jsonb;x jsonb;failed boolean;
BEGIN
 INSERT INTO public.app_users(id,status) VALUES(staff_a,'active');
 INSERT INTO public.memberships(user_id,station_id,scope_type,role_code,active)
 VALUES(staff_a,station_a,'station','attendant',true);
 INSERT INTO public.employees(id,station_id,user_id,display_name,employment_status)
 VALUES(employee_a,station_a,NULL,'Synthetic Worker','active');

 d:=public.hr_station_link_setup(owner_a,station_a);
 IF jsonb_array_length(d->'employees')<>3 OR
  jsonb_array_length(d->'accounts')<>1 OR
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'employees') v
   WHERE (v->>'id')::uuid=employee_a AND v->>'linked'='false') OR
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'accounts') v
   WHERE (v->>'userId')::uuid=staff_a AND v->>'role'='attendant') OR
  d->'geofence'->>'configured'<>'false'
 THEN RAISE EXCEPTION 'bad HR account setup or excessive private data %',d;END IF;
 IF d::text ~ '55555555.*@' OR d::text LIKE '%password%' OR d::text LIKE '%wageSatang%'
 THEN RAISE EXCEPTION 'HR setup leaked private fields';END IF;

 failed:=false;
 BEGIN
  PERFORM public.hr_station_link_setup(owner_b,station_a);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='FORBIDDEN';END;
 IF NOT failed THEN RAISE EXCEPTION 'foreign manager viewed staff identities';END IF;
 failed:=false;
 BEGIN
  PERFORM public.hr_station_link_setup(owner_b,station_b);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='FORBIDDEN';END;
 IF NOT failed THEN RAISE EXCEPTION 'disabled HR station leaked setup';END IF;
 failed:=false;
 BEGIN
  PERFORM public.hr_station_link_setup(staff_a,station_a);
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='FORBIDDEN';END;
 IF NOT failed THEN RAISE EXCEPTION 'attendant viewed employee binding candidates';END IF;

 x:=public.hr_link_existing_station_employee(owner_a,station_a,employee_a,staff_a);
 IF x->>'replayed'<>'false' THEN RAISE EXCEPTION 'valid account binding failed';END IF;
 d:=public.hr_station_link_setup(owner_a,station_a);
 IF jsonb_array_length(d->'accounts')<>0 OR
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'employees') v
   WHERE (v->>'id')::uuid=employee_a AND v->>'linked'='true')
 THEN RAISE EXCEPTION 'bound account still offered for another employee';END IF;
 x:=public.hr_configure_station_geofence_audited(
  owner_a,station_a,13.7563,100.5018,150,100);
 d:=public.hr_station_link_setup(owner_a,station_a);
 IF d->'geofence'->>'configured'<>'true' OR
  (d->'geofence'->>'latitude')::numeric<>13.7563 OR
  (d->'geofence'->>'radiusMeters')::integer<>150
 THEN RAISE EXCEPTION 'HR geofence setup did not reflect committed values %',d;END IF;
 RAISE NOTICE 'HR station link setup SQL PASS';
END $test$;
ROLLBACK;
