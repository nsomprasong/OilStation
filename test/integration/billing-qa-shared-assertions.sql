-- Isolated Postgres rollback-only scope security regression.
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
DO $test$
DECLARE
 v_admin uuid:='11111111-1111-4111-8111-111111111111';
 v_actor uuid:='22222222-2222-4222-8222-222222222222';
 v_qa_org uuid:='d6f31134-2c74-41d8-8bc3-6d83bb41840b';
 v_qa_station uuid:='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
 v_run text:='QA-20261031-PLATFORM-001';
 v_plan uuid;v_group uuid;v_invoice uuid;d jsonb;
BEGIN
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES
   (v_actor,jsonb_build_object('oilstation_qa',true,'oilstation_qa_run_id',v_run)),
   (v_admin,'{}'::jsonb);
 INSERT INTO public.organizations(id,name) VALUES(v_qa_org,'QA-ORG-S01-A');
 INSERT INTO public.stations(id,organization_id,name) VALUES
   (v_qa_station,v_qa_org,'QA-S01-A');
 INSERT INTO public.station_modules(station_id,module_code,status) VALUES
   (v_qa_station,'qr_coupon','enabled');
 INSERT INTO public.memberships(user_id,active,scope_type,role_code,organization_id)
   VALUES(v_actor,true,'organization','organization_owner',v_qa_org);
 PERFORM public.platform_review_saas_tax_policy(v_admin,'exclusive',700,'2026-10-01');
 v_plan:=(public.platform_define_saas_flat_plan(v_admin,'qa_stripe_scope',
   'QA Stripe Scope','monthly',50000,70000,'2026-10-01')->>'planId')::uuid;
 v_group:=(public.platform_create_saas_billing_group(v_admin,v_qa_org,
   'QA Scope Billing',ARRAY[v_qa_station])->>'billingGroupId')::uuid;
 PERFORM public.platform_subscribe_saas_station(v_admin,v_qa_station,v_plan,
   '2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
 d:=public.platform_draft_saas_flat_invoice(v_admin,v_group,'card',
   '2026-10-01','2026-11-01');
 v_invoice:=(d->>'invoiceId')::uuid;
 IF public.qa_authorize_saas_test_invoice(v_actor,v_invoice,v_qa_station,v_run)
 THEN RAISE EXCEPTION 'untagged_invoice_is_qa_authorized';END IF;
 UPDATE public.saas_invoices SET pricing_snapshot=pricing_snapshot ||
   jsonb_build_object('qaOnly',true,'qaRunId',v_run) WHERE id=v_invoice;
 PERFORM public.platform_issue_saas_invoice(v_admin,v_invoice);
 IF NOT public.qa_authorize_saas_test_invoice(v_actor,v_invoice,v_qa_station,v_run)
    OR NOT public.qa_authorize_saas_test_invoice(NULL,v_invoice,v_qa_station,v_run)
 THEN RAISE EXCEPTION 'real_qa_scoped_invoice_was_rejected';END IF;
 IF public.qa_authorize_saas_test_invoice(v_admin,v_invoice,v_qa_station,v_run)
    OR public.qa_authorize_saas_test_invoice(v_actor,v_invoice,v_qa_station,'QA-20261031-DIFFERENT-001')
    OR public.qa_authorize_saas_test_invoice(v_actor,v_invoice,
       'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'::uuid,v_run)
    OR public.qa_authorize_saas_test_invoice(NULL,
       'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,v_qa_station,v_run)
 THEN RAISE EXCEPTION 'cross_scope_invoice_accepted';END IF;
 UPDATE auth.users SET raw_app_meta_data='{}'::jsonb WHERE id=v_actor;
 IF public.qa_authorize_saas_test_invoice(v_actor,v_invoice,v_qa_station,v_run)
 THEN RAISE EXCEPTION 'non_qa_actor_passed';END IF;
 RAISE NOTICE 'PASS shared-project QA station/actor/invoice guard in disposable PostgreSQL';
END $test$;
ROLLBACK;
