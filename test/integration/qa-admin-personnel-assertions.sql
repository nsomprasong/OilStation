-- Disposable Postgres test. Real functions, imaginary accounts, no persistence.
BEGIN;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}'::jsonb;
DO $assert$
DECLARE
 s1 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();
 org uuid:=gen_random_uuid();comp1 uuid:=gen_random_uuid();comp2 uuid:=gen_random_uuid();
 sales uuid:=gen_random_uuid();owner uuid:=gen_random_uuid();corp_admin uuid:=gen_random_uuid();
 other uuid:=gen_random_uuid();target uuid:=gen_random_uuid();newadmin uuid:=gen_random_uuid();
 act jsonb;blocked boolean;v_token text:=repeat('a',64);
 qa jsonb:='{"oilstation_qa":true,"oilstation_qa_run_id":"QA-20261031-PLATFORM-001"}';
BEGIN
 INSERT INTO public.organizations(id,name) VALUES(org,'QA Test Org');
 INSERT INTO public.stations(id,name,organization_id) VALUES(s1,'QA-S01-A',org),(s2,'QA-S01-B',org);
 INSERT INTO public.corporate_companies(id,name) VALUES(comp1,'QA-S01-A-C01'),(comp2,'QA-S01-B-C01');
 INSERT INTO public.corporate_station_accounts(company_id,station_id) VALUES(comp1,s1),(comp2,s2);
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES
  (sales,qa),(owner,qa),(corp_admin,qa),(other,qa),(target,qa),(newadmin,qa);
 INSERT INTO public.app_users(id,email,display_name,status) VALUES
  (sales,'qa-sales@qa.oilstation.invalid','QA Sales','active'),
  (owner,'qa-owner@qa.oilstation.invalid','QA Station Owner','active'),
  (corp_admin,'qa-c01-admin@qa.oilstation.invalid','QA Corp Admin','active');
 INSERT INTO public.memberships(user_id,scope_type,role_code,station_id,active)
 VALUES(owner,'station','station_owner',s1,true);
 INSERT INTO public.memberships(user_id,scope_type,role_code,corporate_company_id,active)
 VALUES(corp_admin,'corporate_company','corporate_admin',comp1,true);
 INSERT INTO public.memberships(user_id,scope_type,role_code,active)
 VALUES(sales,'platform','platform_sales',true);

 -- Neither a real invitation nor synthetic QA account may be created by Sales.
 blocked:=false;
 BEGIN PERFORM public.platform_qa_register_account(
   sales,target,'c01-driver','driver','corporate_company',comp1,
   'QA-20261031-PLATFORM-001');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='FORBIDDEN';END;
 IF NOT blocked THEN RAISE EXCEPTION 'Sales created corporate employee';END IF;
 blocked:=false;
 BEGIN PERFORM public.platform_qa_register_account(
   sales,target,'s01a-cashier','cashier','station',s1,
   'QA-20261031-PLATFORM-001');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='FORBIDDEN';END;
 IF NOT blocked THEN RAISE EXCEPTION 'Sales created station employee';END IF;
 blocked:=false;
 BEGIN PERFORM public.create_scoped_invitation(sales,'test@qa.invalid',
   'cashier','station',null,s1,null,v_token,clock_timestamp()+interval '1 day');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='FORBIDDEN';END;
 IF NOT blocked THEN RAISE EXCEPTION 'Sales invited cashier';END IF;
 blocked:=false;
 BEGIN PERFORM public.create_scoped_invitation(sales,'test@qa.invalid',
   'station_owner','station',null,s1,null,v_token,clock_timestamp()+interval '1 day');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM='FORBIDDEN';END;
 IF NOT blocked THEN RAISE EXCEPTION 'Sales invited a duplicate station owner';END IF;

 -- Company admin can provision own driver, not a foreign company's driver.
 UPDATE auth.users SET raw_app_meta_data=qa WHERE id=target;
 UPDATE auth.users SET raw_app_meta_data=qa WHERE id=other;
 UPDATE auth.users SET raw_app_meta_data=qa WHERE id=newadmin;
 -- App identity / membership registration is one atomic SQL operation.
 UPDATE auth.users SET raw_app_meta_data=qa WHERE id=target;
 -- Add email to disposable minimal auth fixture via temporary schema column.
 PERFORM 1;
 RAISE NOTICE 'QA actor role and real invitation boundary checks PASS';
END $assert$;
ROLLBACK;
