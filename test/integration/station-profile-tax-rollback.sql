-- QA-only: execute after migration inside BEGIN; ... ROLLBACK.
-- Never persist synthetic tax IDs, bank details, fuel prices, or station names.
DO $qa$
DECLARE actor uuid; other_actor uuid; target_station uuid;
 before jsonb; after jsonb; input jsonb; refused boolean;
BEGIN
 SELECT user_id INTO actor FROM public.memberships
 WHERE active AND scope_type='platform' AND role_code='platform_superadmin'
 LIMIT 1;
 SELECT user_id INTO other_actor FROM public.memberships
 WHERE active AND scope_type='platform' AND role_code='platform_sales'
 LIMIT 1;
 SELECT id INTO target_station FROM public.stations ORDER BY id LIMIT 1;
 IF actor IS NULL OR target_station IS NULL
 THEN RAISE EXCEPTION 'QA actor or station missing';END IF;
 before=public.platform_read_station_profile(actor,target_station);
 IF before->>'stationId'<>target_station::text THEN RAISE EXCEPTION 'QA scope missing';END IF;
 input=jsonb_build_object(
  'stationName',before->>'stationName','address','QA test address 123',
  'latitude','13.7563','longitude','100.5018',
  'contactName','QA Contact','stationPhone','021234567',
  'stationEmail','qa-test@example.com','postalCode','10200',
  'invoiceIssuerName','QA Company Limited','invoiceTaxId','0123456789012',
  'invoiceBranchCode','00000','invoiceAddress','QA Invoice Address',
  'invoicePhone','021234568','invoiceEmail','tax-test@example.com',
  'vatRegistered',true);
 after=public.platform_update_station_profile(actor,target_station,input);
 IF after->>'invoiceTaxId'<>'0123456789012'
  OR after->>'invoiceBranchCode'<>'00000'
  OR after->>'invoiceAddress'<>'QA Invoice Address'
  OR (after->>'latitude')::numeric<>13.7563
  OR after->>'stationPhone'<>'021234567'
  OR after->'vatRegistered'<>'true'::jsonb
 THEN RAISE EXCEPTION 'QA station save/read failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_events a
   WHERE a.station_id=target_station AND a.actor_id=actor
    AND a.action='station_profile_updated')
 THEN RAISE EXCEPTION 'QA missing audit';END IF;
 refused=false;
 BEGIN
  PERFORM public.platform_update_station_profile(actor,target_station,
   input||jsonb_build_object('organizationId','11111111-1111-4111-8111-111111111111'));
 EXCEPTION WHEN OTHERS THEN refused=SQLERRM='INVALID_REQUEST'; END;
 IF NOT refused THEN RAISE EXCEPTION 'QA mass assignment accepted'; END IF;
 refused=false;
 BEGIN
  PERFORM public.platform_update_station_profile(actor,target_station,
   input||jsonb_build_object('invoiceTaxId','123'));
 EXCEPTION WHEN OTHERS THEN refused=SQLERRM='INVALID_REQUEST'; END;
 IF NOT refused THEN RAISE EXCEPTION 'QA invalid tax id accepted';END IF;
 refused=false;
 BEGIN
  PERFORM public.platform_update_station_profile(actor,target_station,
   input||jsonb_build_object('invoiceBranchCode','X'));
 EXCEPTION WHEN OTHERS THEN refused=SQLERRM='INVALID_REQUEST'; END;
 IF NOT refused THEN RAISE EXCEPTION 'QA invalid branch accepted';END IF;
 IF other_actor IS NOT NULL THEN
  refused=false;
  BEGIN PERFORM public.platform_read_station_profile(other_actor,target_station);
  EXCEPTION WHEN OTHERS THEN refused=SQLERRM='FORBIDDEN';END;
  IF NOT refused THEN RAISE EXCEPTION 'QA sales can read tax profile'; END IF;
  refused=false;
  BEGIN PERFORM public.platform_update_station_profile(other_actor,target_station,input);
  EXCEPTION WHEN OTHERS THEN refused=SQLERRM='FORBIDDEN';END;
  IF NOT refused THEN RAISE EXCEPTION 'QA sales can update tax profile'; END IF;
 END IF;
 RAISE NOTICE 'PASS: station profile writes and tax data scoped, audited, sales denied; transaction will roll back';
END $qa$;
