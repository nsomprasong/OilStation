BEGIN;
DO $test$
DECLARE
 manager_a uuid:='11111111-1111-4111-8111-111111111111';
 employee_a uuid:='22222222-2222-4222-8222-222222222222';
 manager_b uuid:='33333333-3333-4333-8333-333333333333';
 employee_b uuid:='44444444-4444-4444-8444-444444444444';
 station_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 station_b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 event_id uuid;self_event uuid;outside_event uuid;other_event uuid;
 d jsonb;a jsonb;bad boolean;
BEGIN
 bad:=false;
 BEGIN
  PERFORM public.hr_configure_station_geofence(employee_a,station_a,13.7563,100.5018,150,100);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN'; END;
 IF NOT bad THEN RAISE EXCEPTION 'employee_changed_station_geofence';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_configure_station_geofence(manager_a,station_b,13.7563,100.5018,150,100);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN'; END;
 IF NOT bad THEN RAISE EXCEPTION 'manager_changed_foreign_station';END IF;
 PERFORM public.hr_configure_station_geofence(manager_a,station_a,13.7563,100.5018,150,100);
 d:=public.hr_record_gps_attendance(employee_a,station_a,'clock_in',
     13.7563,100.5018,10,'HR_ATTESTATION_TEST_0001');
 event_id:=(d->>'id')::uuid;
 IF d->>'status'<>'pending' OR d->>'geofence'<>'inside'
   OR d->>'faceVerified'<>'false' THEN
   RAISE EXCEPTION 'new_gps_unjustifiably_approved %',d;END IF;
 -- The first replay reflects still-pending status.
 a:=public.hr_record_gps_attendance(employee_a,station_a,'clock_in',
     13.7563,100.5018,10,'HR_ATTESTATION_TEST_0001');
 IF (a->>'id')::uuid<>event_id OR a->>'replayed'<>'true'
   OR a->>'status'<>'pending' THEN
   RAISE EXCEPTION 'gps_duplicate_nonce_not_idempotent %',a;END IF;
 IF jsonb_array_length(public.hr_attendance_pending_inbox(manager_a,station_a))<>1
 THEN RAISE EXCEPTION 'pending_inbox_failed';END IF;
 IF jsonb_array_length(public.hr_attendance_pending_inbox(manager_b,station_b))<>0
 THEN RAISE EXCEPTION 'cross_station_inbox_leaked';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_attendance_pending_inbox(manager_b,station_a);
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN'; END;
 IF NOT bad THEN RAISE EXCEPTION 'foreign_manager_sees_attendance';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_record_gps_attendance(employee_a,station_b,'clock_in',
   13.7563,100.5018,10,'HR_ATTESTATION_TEST_0002');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN'; END;
 IF NOT bad THEN RAISE EXCEPTION 'employee_clocked_foreign_station';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_record_gps_attendance(employee_a,station_a,'clock_out',
   13.7563,100.5018,10,'HR_ATTESTATION_TEST_0001');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='IDEMPOTENCY_CONFLICT'; END;
 IF NOT bad THEN RAISE EXCEPTION 'nonce_reused_with_changed_event';END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_review_attendance_manual(manager_b,event_id,true,
   'Staff punched at verified shift');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN'; END;
 IF NOT bad THEN RAISE EXCEPTION 'foreign_manager_reviewed_event';END IF;
 a:=public.hr_review_attendance_manual(manager_a,event_id,true,
     'Verified timesheet with staffed shift records');
 IF a->>'status'<>'accepted' OR a->>'faceVerified'<>'false' OR
     a->>'method'<>'supervisor_manual'
 THEN RAISE EXCEPTION 'supervisor_decision_not_applied %',a;END IF;
 a:=public.hr_record_gps_attendance(employee_a,station_a,'clock_in',
     13.7563,100.5018,10,'HR_ATTESTATION_TEST_0001');
 IF a->>'status'<>'accepted' OR a->>'replayed'<>'true' OR
    a->>'faceVerified'<>'false' THEN
   RAISE EXCEPTION 'nonce_replay_after_review_stale %',a;END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_review_attendance_manual(manager_a,event_id,true,
    'Please approve the same event again for payroll');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='INVALID_REQUEST'; END;
 IF NOT bad THEN RAISE EXCEPTION 'duplicate_supervisor_review_allowed';END IF;

 -- Managers cannot sign off their own GPS attendance.
 d:=public.hr_record_gps_attendance(manager_a,station_a,'clock_in',
      13.7563,100.5018,10,'HR_ATTESTATION_TEST_0003');
 self_event:=(d->>'id')::uuid;
 bad:=false;
 BEGIN
  PERFORM public.hr_review_attendance_manual(manager_a,self_event,true,
    'My manager presence proves this is an authorized event');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN'; END;
 IF NOT bad THEN RAISE EXCEPTION 'manager_self_approval_allowed';END IF;
 -- The same manager's event is hidden from their review inbox.
 IF jsonb_array_length(public.hr_attendance_pending_inbox(manager_a,station_a))<>0
 THEN RAISE EXCEPTION 'manager_self_approval_inbox_visible';END IF;
 -- Outside the permitted radius is STILL pending and must be reviewed.
 d:=public.hr_record_gps_attendance(employee_a,station_a,'clock_out',
      13.9000,100.5018,10,'HR_ATTESTATION_TEST_0004');
 outside_event:=(d->>'id')::uuid;
 IF d->>'status'<>'pending' OR d->>'geofence'<>'outside'
 THEN RAISE EXCEPTION 'outside_geofence_auto_accepted %',d;END IF;
 a:=public.hr_review_attendance_manual(manager_a,outside_event,false,
   'Supervisor could not independently verify the absence');
 IF a->>'status'<>'rejected' THEN
  RAISE EXCEPTION 'rejection_was_not_saved';END IF;
 a:=public.hr_record_gps_attendance(employee_a,station_a,'clock_out',
      13.9000,100.5018,10,'HR_ATTESTATION_TEST_0004');
 IF a->>'status'<>'rejected' THEN RAISE EXCEPTION 'rejected_nonce_replay_stale';END IF;
 -- Unconfigured stations never infer GPS attendance is accepted.
 d:=public.hr_record_gps_attendance(employee_b,station_b,'clock_in',
      13.7563,100.5018,10,'HR_ATTESTATION_TEST_0005');
 other_event:=(d->>'id')::uuid;
 IF d->>'status'<>'pending' OR d->>'geofence'<>'unconfigured'
 THEN RAISE EXCEPTION 'unconfigured_station_accepted_gps %',d;END IF;
 -- A separate employee with a complete, independently reviewed shift
 -- may generate a conservative preview but never a paid payroll entry.
 INSERT INTO public.employees(id,station_id,user_id,display_name,employment_status)
 VALUES('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',station_a,NULL,'Employee C','active');
 INSERT INTO public.attendance_events(id,employee_id,event_type,occurred_at,review_status)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-111111111111',
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa','clock_in',
   '2026-10-01T08:00:59+07:00','pending'),
   ('aaaaaaaa-aaaa-4aaa-8aaa-222222222222',
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa','clock_out',
   '2026-10-01T09:00:58+07:00','pending');
 bad:=false;
 BEGIN
  PERFORM public.hr_reviewed_attendance_punches(manager_a,
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
   '2026-10-01T00:00:00Z','2026-10-02T00:00:00Z');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='PUNCH_REVIEW_REQUIRED';END;
 IF NOT bad THEN RAISE EXCEPTION 'pending_punches_in_payroll_preview';END IF;
 PERFORM public.hr_review_attendance_manual(manager_a,
   'aaaaaaaa-aaaa-4aaa-8aaa-111111111111',true,
   'Supervisor independently reviewed clock in evidence');
 PERFORM public.hr_review_attendance_manual(manager_a,
   'aaaaaaaa-aaaa-4aaa-8aaa-222222222222',true,
   'Supervisor independently reviewed clock out evidence');
 d:=public.hr_reviewed_attendance_punches(manager_a,
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
   '2026-10-01T00:00:00Z','2026-10-02T00:00:00Z');
 IF jsonb_array_length(d->'events')<>2 OR d->>'payable'<>'false'
    OR d->>'faceVerified'<>'false'
 THEN RAISE EXCEPTION 'unsafe_payroll_preview %',d;END IF;
 bad:=false;
 BEGIN
  PERFORM public.hr_reviewed_attendance_punches(manager_b,
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
   '2026-10-01T00:00:00Z','2026-10-02T00:00:00Z');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='FORBIDDEN';END;
 IF NOT bad THEN RAISE EXCEPTION 'foreign_manager_reads_payroll_preview';END IF;
 -- A third "accepted by default" punch without an audit must block payroll.
 INSERT INTO public.attendance_events(id,employee_id,event_type,occurred_at)
 VALUES('aaaaaaaa-aaaa-4aaa-8aaa-333333333333',
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa','break_start',
   '2026-10-01T08:30:00+07:00');
 bad:=false;
 BEGIN
  PERFORM public.hr_reviewed_attendance_punches(manager_a,
   'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
   '2026-10-01T00:00:00Z','2026-10-02T00:00:00Z');
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='PUNCH_REVIEW_REQUIRED';END;
 IF NOT bad THEN RAISE EXCEPTION 'default_accepted_punch_exposed_without_audit';END IF;
 -- Audit trail remains one row per manually reviewed event.
 IF (SELECT count(*) FROM public.attendance_review_audit)<>4
 THEN RAISE EXCEPTION 'audit_trail_missing_or_duplicated';END IF;
 bad:=false;
 BEGIN
  UPDATE public.attendance_review_audit SET reason='forged update'
   WHERE attendance_event_id=event_id;
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='REVIEW_AUDIT_IMMUTABLE';END;
 IF NOT bad THEN RAISE EXCEPTION 'review_audit_was_mutable';END IF;
 bad:=false;
 BEGIN
  DELETE FROM public.attendance_review_audit WHERE attendance_event_id=event_id;
 EXCEPTION WHEN OTHERS THEN bad:=SQLERRM='REVIEW_AUDIT_IMMUTABLE';END;
 IF NOT bad THEN RAISE EXCEPTION 'review_audit_was_deletable';END IF;

END $test$;
ROLLBACK;
