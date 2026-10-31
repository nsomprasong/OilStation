-- DISPOSABLE PostgreSQL ONLY. All rows are fictional and rolled back.
BEGIN;
DO $test$
DECLARE
 s uuid:=gen_random_uuid();o uuid:=gen_random_uuid();company uuid:=gen_random_uuid();
 company_b uuid:=gen_random_uuid();a uuid:=gen_random_uuid();
 admin uuid:=gen_random_uuid();driver uuid:=gen_random_uuid();
 other uuid:=gen_random_uuid();foreign_admin uuid:=gen_random_uuid();
 fuel uuid:=gen_random_uuid();first_coupon uuid:=gen_random_uuid();
 d_id uuid;v_id uuid;r jsonb;v_failed boolean; v2 uuid;
BEGIN
 INSERT INTO public.organizations(id,name) VALUES(o,'QA Driver Org');
 INSERT INTO public.stations(id,organization_id,name) VALUES(s,o,'QA Driver Station');
 INSERT INTO public.corporate_companies(id,name) VALUES(company,'QA Transport'),(company_b,'Foreign QA');
 INSERT INTO public.corporate_station_accounts(id,station_id,company_id,prepaid_balance_satang)
 VALUES(a,s,company,10000);
 INSERT INTO auth.users(id) VALUES(admin),(driver),(other),(foreign_admin);
 INSERT INTO public.app_users(id,display_name,email)
 VALUES(admin,'Dispatcher','dispatcher@qa.invalid'),
  (driver,'Driver A','driver@qa.invalid'),(other,'Driver B','driverb@qa.invalid'),
  (foreign_admin,'Other Company','external@qa.invalid');
 INSERT INTO public.memberships(user_id,scope_type,corporate_company_id,role_code,active)
 VALUES (admin,'corporate_company',company,'corporate_admin',true),
  (driver,'corporate_company',company,'driver',true),
  (other,'corporate_company',company,'driver',true),
  (foreign_admin,'corporate_company',company_b,'corporate_admin',true);
 INSERT INTO public.station_modules(station_id,module_code,status)
 VALUES(s,'qr_coupon','enabled');
 INSERT INTO public.station_fuel_products(id,station_id,custom_name,enabled,current_public_price)
 VALUES(fuel,s,'QA Diesel',true,32.50);

 IF has_function_privilege('anon',
   'public.oilstation_driver_coupon_inbox(uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.oilstation_assign_driver_vehicle(uuid,uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'driver finance functions accessible in browser';END IF;

 SELECT public.oilstation_company_driver_roster(admin,company) INTO r;
 IF jsonb_array_length(r)<>2 OR (r->0)->>'driverId' IS NOT NULL
 THEN RAISE EXCEPTION 'driver membership roster incorrect %',r;END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.oilstation_assign_driver_vehicle(
   foreign_admin,company,driver,'กข 1234');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign company assigned a vehicle';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.oilstation_assign_driver_vehicle(
   driver,company,driver,'กข 1234');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'driver edited own vehicle';END IF;

 r:=public.oilstation_assign_driver_vehicle(admin,company,driver,'กข 1234');
 d_id:=(r->>'driverId')::uuid;v_id:=(r->>'vehicleId')::uuid;
 IF r->>'plate'<>'กข 1234' THEN RAISE EXCEPTION 'plate mismatch';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.oilstation_assign_driver_vehicle(admin,company,other,'กข 1234');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='VEHICLE_ALREADY_ASSIGNED';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'shared car assigned to two drivers';END IF;

 r:=public.oilstation_issue_driver_coupon(first_coupon,admin,a,fuel,5000,
  clock_timestamp()+interval '1 day',d_id,repeat('a',64),repeat('b',64),'qa-driver-token-test-001');
 IF r->>'status'<>'reserved' OR r->>'replayed'<>'false'
 OR (SELECT reserved_satang FROM public.corporate_station_accounts WHERE id=a)<>5000
 THEN RAISE EXCEPTION 'QR reservation failed %',r;END IF;
 IF (SELECT driver_id FROM public.coupons WHERE id=first_coupon)<>d_id
 OR (SELECT vehicle_id FROM public.coupons WHERE id=first_coupon)<>v_id
 OR (SELECT plate_snapshot FROM public.coupons WHERE id=first_coupon)<>'กข 1234'
 THEN RAISE EXCEPTION 'QR not bound to selected driver and vehicle';END IF;

 r:=public.oilstation_driver_coupon_inbox(driver);
 IF jsonb_array_length(r->'vehicles')<>1
 OR jsonb_array_length(r->'coupons')<>1
 OR ((r->'coupons')->0)->>'id'<>first_coupon::text
 OR ((r->'vehicles')->0)->>'plate'<>'กข 1234'
 THEN RAISE EXCEPTION 'driver QR not in individual inbox %',r;END IF;
 r:=public.oilstation_driver_coupon_inbox(other);
 IF jsonb_array_length(r->'coupons')<>0
 THEN RAISE EXCEPTION 'another driver saw QR';END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.oilstation_assign_driver_vehicle(admin,company,driver,'ขค 5678');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='ACTIVE_COUPON_REQUIRES_CANCELLATION';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'active QR silently switched car';END IF;

 v2:=gen_random_uuid();
 r:=public.oilstation_issue_driver_coupon(v2,admin,a,fuel,5000,
  (SELECT expires_at FROM public.coupons WHERE id=first_coupon),
  d_id,repeat('c',64),repeat('d',64),'qa-driver-token-test-001');
 IF r->>'replayed'<>'true' OR (r->>'id')::uuid<>first_coupon
 OR (SELECT count(*) FROM public.coupons WHERE driver_id=d_id)<>1
 OR (SELECT reserved_satang FROM public.corporate_station_accounts WHERE id=a)<>5000
 THEN RAISE EXCEPTION 'driver QR idempotency created duplicate';END IF;

 v_failed:=false;
 BEGIN
  PERFORM public.oilstation_issue_driver_coupon(
   gen_random_uuid(),foreign_admin,a,fuel,1000,clock_timestamp()+interval '1 day',
   d_id,repeat('e',64),repeat('f',64),'qa-driver-token-test-002');
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM='FORBIDDEN';END;
 IF NOT v_failed THEN RAISE EXCEPTION 'foreign issuer issued company coupon';END IF;
 RAISE NOTICE 'driver-specific coupon SQL UAT PASS: auth, plate, QR, idempotency, review boundary';
END $test$;
ROLLBACK;
