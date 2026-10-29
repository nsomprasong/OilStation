-- Cross-module regression with ONE simulated wallet:
-- QR reservation -> fuel and AR -> verified top-up -> debt-first repayment
-- -> fresh coupon available credit. Every change is rolled back.
BEGIN;
DO $test$
DECLARE
 issuer uuid:='11111111-1111-4111-8111-111111111111';
 attendant uuid:='22222222-2222-4222-8222-222222222222';
 reviewer uuid:='33333333-3333-4333-8333-333333333333';
 account_a uuid:='aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa';
 station_a uuid:='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
 fuel_a uuid:='aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa';
 bank_a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-555555555555';
 coupon_id uuid:='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa';
 next_coupon uuid:='aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa';
 photo_id uuid;session_id uuid;pump_id uuid;receipt_id uuid;topup_id uuid;
 plate_path text:='stations/a/coupons/verified-photo-1.jpg';
 pump_path text;receipt_path text;slip_path text;
 d jsonb;balance record;
BEGIN
 -- New QR reserves 200 THB of a 600 THB corporate credit envelope.
 d:=public.issue_reserved_coupon(coupon_id,issuer,account_a,fuel_a,
  20000,clock_timestamp()+interval '2 hours','ABC123',repeat('a',64),
  repeat('b',64),'cross-module-coupon-0001');
 IF d->>'status'<>'reserved' OR d->>'available_satang'<>'40000'
 THEN RAISE EXCEPTION 'initial_wallet_hold_failed %',d;END IF;
 INSERT INTO storage.objects(bucket_id,name)
 VALUES('oilstation-evidence',plate_path);
 INSERT INTO public.coupon_photo_checks(
  coupon_id,station_id,photo_path,captured_by,observed_plate,
  decision,checked_by,checked_at)
 VALUES(coupon_id,station_a,plate_path,attendant,'ABC123',
  'verified_supervisor',reviewer,clock_timestamp())
 RETURNING id INTO photo_id;
 d:=public.begin_verified_fuel_session(attendant,photo_id);
 session_id:=(d->>'id')::uuid;
 IF d->>'corporate_price'<>'35.0000'
 THEN RAISE EXCEPTION 'corporate_discount_not_locked';END IF;
 pump_path:='stations/'||station_a::text||'/sessions/'||
  session_id::text||'/pump_display/aaaaaaaa-aaaa-4aaa-8aaa-111111111111.jpg';
 receipt_path:='stations/'||station_a::text||'/sessions/'||
  session_id::text||'/receipt/aaaaaaaa-aaaa-4aaa-8aaa-222222222222.jpg';
 INSERT INTO storage.objects(bucket_id,name)
 VALUES('oilstation-evidence',pump_path),('oilstation-evidence',receipt_path);
 d:=public.record_fuel_photo_upload(attendant,session_id,'pump_display',pump_path);
 pump_id:=(d->>'evidenceId')::uuid;
 d:=public.record_fuel_photo_upload(attendant,session_id,'receipt',receipt_path);
 receipt_id:=(d->>'evidenceId')::uuid;
 PERFORM public.review_fuel_evidence_photo(reviewer,pump_id,true,'5.000','20000');
 PERFORM public.review_fuel_evidence_photo(reviewer,receipt_id,true,NULL,'20000');
 d:=public.complete_reviewed_fuel_session(reviewer,session_id,pump_id,receipt_id);
 IF d->>'status'<>'completed' OR d->>'debt_created_satang'<>'7500'
 THEN RAISE EXCEPTION 'fuel_settlement_did_not_create_expected_ar %',d;END IF;
 d:=public.corporate_wallet_integrity_snapshot(issuer,account_a);
 IF d->>'healthy'<>'true' OR d->>'debtSatang'<>'7500'
 THEN RAISE EXCEPTION 'fuel_and_ar_inconsistent %',d;END IF;

 -- Uploading a slip MUST NOT credit the wallet. Bank review comes later.
 slip_path:='accounts/'||account_a::text||'/slips/'||
  'aaaaaaaa-aaaa-4aaa-8aaa-999999999999.jpg';
 INSERT INTO storage.objects(bucket_id,name) VALUES('oilstation-slips',slip_path);
 d:=public.request_corporate_topup(issuer,account_a,bank_a,9000,slip_path);
 topup_id:=(d->>'requestId')::uuid;
 IF (SELECT debt_outstanding_satang FROM public.corporate_station_accounts
   WHERE id=account_a)<>7500
 THEN RAISE EXCEPTION 'pending_topup_silently_repaid_debt';END IF;
 d:=public.review_verified_corporate_topup(
  reviewer,topup_id,true,true,'BANK-CROSS-MODULE-0001');
 IF d->>'paidDebtSatang'<>'7500' OR d->>'addedPrepaidSatang'<>'1500'
 THEN RAISE EXCEPTION 'topup_not_applied_debt_first %',d;END IF;
 SELECT prepaid_balance_satang,debt_outstanding_satang,reserved_satang
 INTO balance FROM public.corporate_station_accounts WHERE id=account_a;
 IF balance.prepaid_balance_satang<>1500 OR balance.debt_outstanding_satang<>0
  OR balance.reserved_satang<>0
 THEN RAISE EXCEPTION 'post_topup_wallet_not_reconciled';END IF;
 IF EXISTS(SELECT 1 FROM public.accounts_receivable
  WHERE account_id=account_a AND outstanding_satang<>0)
 THEN RAISE EXCEPTION 'accounts_receivable_not_repaid';END IF;
 d:=public.corporate_wallet_integrity_snapshot(issuer,account_a);
 IF d->>'healthy'<>'true' THEN RAISE EXCEPTION 'post_topup_wallet_unhealthy %',d;END IF;

 -- New coupon uses repaid credit, and simultaneous old settlement/topup
 -- replays must not grant credit a second time.
 d:=public.issue_reserved_coupon(next_coupon,issuer,account_a,fuel_a,
  12000,clock_timestamp()+interval '2 hours','ABC123',
  repeat('c',64),repeat('d',64),'cross-module-coupon-0002');
 IF d->>'status'<>'reserved' OR d->>'available_satang'<>'39500'
 THEN RAISE EXCEPTION 'repaid_credit_not_available_for_next_coupon %',d;END IF;
 d:=public.complete_reviewed_fuel_session(reviewer,session_id,pump_id,receipt_id);
 IF d->>'replayed'<>'true' THEN RAISE EXCEPTION 'duplicate_fuel_settlement';END IF;
 d:=public.review_verified_corporate_topup(
  reviewer,topup_id,true,true,'BANK-CROSS-MODULE-0001');
 IF d->>'replayed'<>'true' THEN RAISE EXCEPTION 'duplicate_bank_topup';END IF;
 d:=public.corporate_wallet_integrity_snapshot(issuer,account_a);
 IF d->>'healthy'<>'true' OR d->>'heldCouponSatang'<>'12000'
 THEN RAISE EXCEPTION 'cross_module_wallet_integrity_failed %',d;END IF;
 IF (SELECT count(*) FROM public.wallet_ledger WHERE account_id=account_a)<>4
 THEN RAISE EXCEPTION 'cross_module_double_booking';END IF;
END $test$;
ROLLBACK;
