-- Isolated transactional regression: nothing is persisted to Production.
BEGIN;
DO $test$
DECLARE
 manager_a uuid:='11111111-1111-4111-8111-111111111111';
 manager_b uuid:='33333333-3333-4333-8333-333333333333';
 worker_a uuid:='55555555-5555-4555-8555-555555555555';
 worker_b uuid:='66666666-6666-4666-8666-666666666666';
 station_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 station_b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 employee_a uuid:='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa';
 employee_b uuid:='aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa';
 r jsonb;bad boolean;event_id uuid;
BEGIN
 INSERT INTO public.app_users(id) VALUES(worker_a),(worker_b);
 INSERT INTO public.memberships(user_id,station_id,scope_type,role_code) VALUES
   (worker_a,station_a,'station','attendant'),
   (worker_b,station_a,'station','pump_staff');
 INSERT INTO public.employees(id,station_id,user_id,display_name,employment_status)
 VALUES(employee_a,station_a,NULL,'QA Worker A','active'),
       (employee_b,station_a,NULL,'QA Worker B','active');

 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_b,station_a,employee_a,worker_a);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'foreign_station_manager_linked_employee';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_a,station_a,employee_a,
    '44444444-4444-4444-8444-444444444444');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'foreign_or_nonstaff_user_linked';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_a,station_b,employee_a,worker_a);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='HR_MODULE_DISABLED';END;
 IF NOT bad THEN RAISE EXCEPTION 'disabled_hr_station_linked_employee';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_a,station_a,employee_a,manager_a);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='INVALID_REQUEST';END;
 IF NOT bad THEN RAISE EXCEPTION 'manager_linked_own_login';END IF;

 r:=public.hr_link_existing_station_employee(manager_a,station_a,employee_a,worker_a);
 IF r->>'replayed'<>'false' OR (SELECT user_id FROM public.employees WHERE id=employee_a)<>worker_a
 THEN RAISE EXCEPTION 'employee_link_not_saved %',r;END IF;
 r:=public.hr_link_existing_station_employee(manager_a,station_a,employee_a,worker_a);
 IF r->>'replayed'<>'true' THEN RAISE EXCEPTION 'employee_link_replay';END IF;
 IF (SELECT count(*) FROM public.audit_events WHERE action='employee_login_linked')<>1
 THEN RAISE EXCEPTION 'employee_link_duplicate_or_missing_audit';END IF;

 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_a,station_a,employee_a,worker_b);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='ALREADY_LINKED';END;
 IF NOT bad THEN RAISE EXCEPTION 'silently_replaced_linked_employee';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_a,station_a,employee_b,worker_a);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='ALREADY_LINKED';END;
 IF NOT bad THEN RAISE EXCEPTION 'same_user_linked_to_second_employee';END IF;

 bad:=false;
 BEGIN
  PERFORM public.hr_configure_station_geofence_audited(
    manager_b,station_a,13.7563,100.5018,150,100);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'foreign_manager_changed_geofence';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_configure_station_geofence_audited(
    manager_a,station_b,13.7563,100.5018,150,100);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='HR_MODULE_DISABLED';END;
 IF NOT bad THEN RAISE EXCEPTION 'disabled_hr_changed_geofence';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_configure_station_geofence_audited(
    manager_a,station_a,13.7563,100.5018,20,100);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='INVALID_REQUEST';END;
 IF NOT bad THEN RAISE EXCEPTION 'invalid_geofence_radius_accepted';END IF;
 r:=public.hr_configure_station_geofence_audited(
   manager_a,station_a,13.7563,100.5018,150,100);
 IF r->>'configured'<>'true'
   OR (SELECT radius_m FROM public.station_geofence_settings WHERE station_id=station_a)<>150
   OR (SELECT count(*) FROM public.audit_events WHERE action='station_geofence_configured')<>1
 THEN RAISE EXCEPTION 'geofence_audit_or_config_missing %',r;END IF;

 r:=public.hr_record_gps_attendance(worker_a,station_a,'clock_in',
   13.7563,100.5018,10,'GPS_QA_LINKED_000001');
 event_id:=(r->>'id')::uuid;
 IF r->>'status'<>'pending' OR r->>'geofence'<>'inside'
    OR r->>'faceVerified'<>'false'
 THEN RAISE EXCEPTION 'GPS_was_auto_accepted %',r;END IF;
 r:=public.hr_record_gps_attendance(worker_a,station_a,'clock_in',
   13.7563,100.5018,10,'GPS_QA_LINKED_000001');
 IF r->>'replayed'<>'true' OR (r->>'id')::uuid<>event_id
 THEN RAISE EXCEPTION 'GPS_duplicate_created';END IF;

 -- Revoked membership can never authorize a NEW employee link.
 UPDATE public.memberships SET active=false WHERE user_id=worker_b;
 bad:=false;
 BEGIN
  PERFORM public.hr_link_existing_station_employee(manager_a,station_a,employee_b,worker_b);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'revoked_station_user_linked';END IF;
 IF (SELECT count(*) FROM public.audit_events WHERE action='employee_login_linked')<>1
 THEN RAISE EXCEPTION 'failed_link_left_audit';END IF;
 RAISE NOTICE 'HR linked-user and geofence SQL PASS';
END $test$;
ROLLBACK;
