-- Financial integration tests: all data is fake; every write is rolled back.
-- PostgreSQL raises and aborts if any invariant fails.
BEGIN;
DO $checks$
DECLARE
 issuer uuid:='11111111-1111-4111-8111-111111111111';
 attendant uuid:='22222222-2222-4222-8222-222222222222';
 supervisor uuid:='33333333-3333-4333-8333-333333333333';
 foreign_supervisor uuid:='44444444-4444-4444-8444-444444444444';
 foreign_issuer uuid:='55555555-5555-4555-8555-555555555555';
 account_a uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 product_a uuid:='aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa';
 product_b uuid:='bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb';
 station_a uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 coupon_a uuid:='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa';
 coupon_b uuid:='aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa';
 coupon_c uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
 photo_id uuid;
 session_id uuid;
 pump_id uuid;receipt_id uuid;
 expiry timestamptz:=clock_timestamp()+interval '4 hours';
 plate_path text:='stations/a/coupons/verified-photo-1.jpg';
 pump_path text;receipt_path text;
 r jsonb;result jsonb;
 bal record;v_wallet integer;v_failed boolean;v_count integer;
BEGIN
 IF has_function_privilege('service_role',
  'public.start_reserved_fuel_session(uuid,uuid,text,text)','EXECUTE')
  OR has_function_privilege('service_role',
  'public.finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'service_role_can_skip_verified_photo_review';END IF;
 IF NOT has_function_privilege('service_role',
  'public.begin_verified_fuel_session(uuid,uuid)','EXECUTE')
  OR NOT has_function_privilege('service_role',
  'public.complete_reviewed_fuel_session(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'reviewed_photo_wrappers_not_exposed';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.issue_reserved_coupon(coupon_a,foreign_issuer,account_a,product_a,
   20000,expiry,'ABC123',repeat('a',64),repeat('b',64),'fuel-issuer-test-0001');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'cross_corporate_coupon_issuance';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.issue_reserved_coupon(coupon_a,issuer,account_a,product_b,
   20000,expiry,'ABC123',repeat('a',64),repeat('b',64),'fuel-issuer-test-0001');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='PRODUCT_NOT_AVAILABLE';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'wrong_station_fuel_issuance';END IF;

 result:=public.issue_reserved_coupon(coupon_a,issuer,account_a,product_a,
   20000,expiry,'ABC123',repeat('a',64),repeat('b',64),'fuel-issuer-test-0001');
 IF (result->>'id')::uuid<>coupon_a OR result->>'status'<>'reserved'
    OR result->>'replayed'<>'false' OR result->>'available_satang'<>'40000'
 THEN RAISE EXCEPTION 'incorrect_initial_coupon_reservation %',result;END IF;
 r:=public.issue_reserved_coupon(coupon_a,issuer,account_a,product_a,
   20000,expiry,'ABC123',repeat('a',64),repeat('b',64),'fuel-issuer-test-0001');
 IF r->>'replayed'<>'true' OR (SELECT count(*) FROM public.wallet_ledger)<>1
 THEN RAISE EXCEPTION 'duplicate_coupon_nonce_debited_wallet';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.issue_reserved_coupon(coupon_a,issuer,account_a,product_a,
   30000,expiry,'ABC123',repeat('a',64),repeat('b',64),'fuel-issuer-test-0001');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='IDEMPOTENCY_CONFLICT';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'nonce_reuse_for_different_amount_allowed';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.issue_reserved_coupon(coupon_b,issuer,account_a,product_a,
   41000,expiry,'ABC123',repeat('c',64),repeat('d',64),'fuel-issuer-test-0002');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='INSUFFICIENT_FUNDS';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'over_reservation_not_blocked';END IF;
 SELECT prepaid_balance_satang,credit_limit_satang,debt_outstanding_satang,reserved_satang
 INTO bal FROM public.corporate_station_accounts WHERE id=account_a;
 IF bal.prepaid_balance_satang<>10000 OR bal.reserved_satang<>20000
    OR bal.debt_outstanding_satang<>0
 THEN RAISE EXCEPTION 'failed_reservation_mutated_balance';END IF;

 -- The independent photo review checks a private Storage object and exact plate.
 INSERT INTO storage.objects(bucket_id,name) VALUES('oilstation-evidence',plate_path);
 INSERT INTO public.coupon_photo_checks(coupon_id,station_id,photo_path,captured_by,
   observed_plate,decision,checked_by,checked_at)
 VALUES(coupon_a,station_a,plate_path,attendant,'ABC123',
  'verified_supervisor',supervisor,clock_timestamp())
 RETURNING id INTO photo_id;
 v_failed:=false;
 BEGIN
  PERFORM public.begin_verified_fuel_session(foreign_supervisor,photo_id);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign_station_started_fueling';END IF;
 result:=public.begin_verified_fuel_session(attendant,photo_id);
 session_id:=(result->>'id')::uuid;
 IF result->>'status'<>'fueling' OR result->>'corporate_price'<>'35.0000'
 THEN RAISE EXCEPTION 'incorrect_locked_price %',result;END IF;
 r:=public.begin_verified_fuel_session(attendant,photo_id);
 IF r->>'replayed'<>'true' OR (r->>'id')::uuid<>session_id
    OR (SELECT count(*) FROM public.fuel_sessions WHERE coupon_id=coupon_a)<>1
 THEN RAISE EXCEPTION 'duplicate_photo_created_second_fuel_session';END IF;

 pump_path:='stations/'||station_a::text||'/sessions/'||session_id::text||
   '/pump_display/aaaaaaaa-aaaa-4aaa-8aaa-111111111111.jpg';
 receipt_path:='stations/'||station_a::text||'/sessions/'||session_id::text||
   '/receipt/aaaaaaaa-aaaa-4aaa-8aaa-222222222222.jpg';
 INSERT INTO storage.objects(bucket_id,name) VALUES
  ('oilstation-evidence',pump_path),('oilstation-evidence',receipt_path);
 result:=public.record_fuel_photo_upload(attendant,session_id,'pump_display',pump_path);
 pump_id:=(result->>'evidenceId')::uuid;
 result:=public.record_fuel_photo_upload(attendant,session_id,'receipt',receipt_path);
 receipt_id:=(result->>'evidenceId')::uuid;
 v_failed:=false;
 BEGIN
  PERFORM public.complete_reviewed_fuel_session(supervisor,session_id,pump_id,receipt_id);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='INVALID_REQUEST';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'fuel_settled_without_photo_review';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.review_fuel_evidence_photo(attendant,pump_id,true,'5.000','20000');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'fuel_camera_capture_self_review_allowed';END IF;
 PERFORM public.review_fuel_evidence_photo(supervisor,pump_id,true,'5.000','20000');
 PERFORM public.review_fuel_evidence_photo(supervisor,receipt_id,true,NULL,'20000');
 v_failed:=false;
 BEGIN
  PERFORM public.complete_reviewed_fuel_session(foreign_supervisor,session_id,pump_id,receipt_id);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign_station_settled_fuel';END IF;
 result:=public.complete_reviewed_fuel_session(supervisor,session_id,pump_id,receipt_id);
 IF result->>'status'<>'completed' OR result->>'net_amount_satang'<>'17500'
    OR result->>'gross_amount_satang'<>'20000'
    OR result->>'released_satang'<>'2500'
    OR result->>'debt_created_satang'<>'7500'
 THEN RAISE EXCEPTION 'incorrect_atomic_fuel_settlement %',result;END IF;
 SELECT prepaid_balance_satang,credit_limit_satang,debt_outstanding_satang,reserved_satang
 INTO bal FROM public.corporate_station_accounts WHERE id=account_a;
 IF bal.prepaid_balance_satang<>0 OR bal.credit_limit_satang<>50000 OR
  bal.debt_outstanding_satang<>7500 OR bal.reserved_satang<>0
 THEN RAISE EXCEPTION 'incorrect_post_settlement_wallet';END IF;
 IF (SELECT amount_satang FROM public.accounts_receivable
    WHERE fuel_session_id=session_id)<>7500
 THEN RAISE EXCEPTION 'accounts_receivable_debt_missing';END IF;
 r:=public.complete_reviewed_fuel_session(supervisor,session_id,pump_id,receipt_id);
 IF r->>'replayed'<>'true' OR (SELECT count(*) FROM public.accounts_receivable)<>1
    OR (SELECT count(*) FROM public.wallet_ledger)<>2
 THEN RAISE EXCEPTION 'duplicate_settlement_mutated_ledger';END IF;
 -- Even the restricted underlying finance function is not an information
 -- oracle on completed sessions when invoked by the privileged DB owner.
 v_failed:=false;
 BEGIN
  PERFORM public.finish_reserved_fuel_session(foreign_supervisor,
   session_id,5.000,20000,pump_path,receipt_path);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'completed_fuel_replay_leaked_money';END IF;

 -- Canceling a new coupon releases the reservation once, without fuel credit.
 result:=public.issue_reserved_coupon(coupon_b,issuer,account_a,product_a,
   9000,expiry,'ABC123',repeat('c',64),repeat('d',64),'fuel-issuer-test-0002');
 IF result->>'status'<>'reserved' THEN RAISE EXCEPTION 'second_coupon_failed';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.cancel_reserved_coupon(foreign_issuer,coupon_b);
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign_company_cancelled_coupon';END IF;
 r:=public.cancel_reserved_coupon(issuer,coupon_b);
 IF r->>'status'<>'cancelled' OR r->>'released'<>'true'
 THEN RAISE EXCEPTION 'coupon_cancel_did_not_release';END IF;
 r:=public.cancel_reserved_coupon(issuer,coupon_b);
 IF r->>'released'<>'false' OR (SELECT reserved_satang FROM
 public.corporate_station_accounts WHERE id=account_a)<>0
 THEN RAISE EXCEPTION 'coupon_repeated_cancel_released_twice';END IF;

 -- Expiration returns held cash to available exactly once; fueling coupon
 -- is already completed and must never be touched by expiration Cron.
 result:=public.issue_reserved_coupon(coupon_c,issuer,account_a,product_a,
   12000,expiry,'ABC123',repeat('e',64),repeat('f',64),'fuel-issuer-test-0003');
 UPDATE public.coupons SET expires_at=clock_timestamp()-interval '1 second'
 WHERE id=coupon_c;
 r:=public.expire_reserved_coupons(100);
 IF (r->>'expired')::integer<>1 OR r->>'releasedSatang'<>'12000'
 THEN RAISE EXCEPTION 'expiry_release_mismatch %',r;END IF;
 r:=public.expire_reserved_coupons(100);
 IF r->>'releasedSatang'<>'0' OR
    (SELECT reserved_satang FROM public.corporate_station_accounts
      WHERE id=account_a)<>0
 THEN RAISE EXCEPTION 'double_coupon_expiration';END IF;
 IF (SELECT status FROM public.coupons WHERE id=coupon_a)<>'completed'
    OR (SELECT count(*) FROM public.wallet_ledger WHERE account_id=account_a)<>6
 THEN RAISE EXCEPTION 'unexpected_money_movement';END IF;
END $checks$;
ROLLBACK;
