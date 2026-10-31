import { sendInvitationEmail,sendInvitedEmailOtp } from '../notifications/invitation-email.mjs';
import {createClient} from '@supabase/supabase-js';
/**
 * All privileged PostgREST operations run on the trusted Worker only.
 * SUPABASE_SERVICE_ROLE_KEY must be configured as an encrypted Worker secret.
 * Browser clients NEVER receive this key; no direct table grants are needed.
 */
// Modern sb_secret_* keys are API keys, NOT JWTs: send them only in
// apikey. Legacy service_role JWTs still need Authorization: Bearer.
// Never forward either privileged key to the browser.
const headers = (key, extra = {}) => ({
  apikey: key,
  ...(!key.startsWith('sb_secret_') ? { authorization: `Bearer ${key}` } : {}),
  ...extra,
});
function requireEnv(env) {
  if (!env?.SUPABASE_URL || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.SUPABASE_URL)) throw new Error('invalid_supabase_url');
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY || !env.COUPON_SIGNING_KEY || env.COUPON_SIGNING_KEY.length < 32) throw new Error('missing_or_weak_secrets');
}
function normalizeUrl(env, path) { return env.SUPABASE_URL.replace(/\/$/, '') + path; }
async function fetchJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) {
    // Map only a small set of database error identifiers, never return raw SQL.
    const detail = await response.json().catch(() => ({}));
    const allowed = new Set(['INSUFFICIENT_FUNDS', 'FORBIDDEN', 'INVALID_REQUEST',
      'PRODUCT_NOT_AVAILABLE', 'IDEMPOTENCY_CONFLICT', 'ACCOUNT_NOT_FOUND',
      'NOT_CANCELLABLE', 'INVALID_RESERVATION', 'INVALID_INVITATION',
      'INVITE_INVALID_OR_EXPIRED', 'INVITED_EMAIL_MISMATCH', 'EMAIL_VERIFICATION_REQUIRED',
      'BOOTSTRAP_FORBIDDEN', 'ALREADY_BOOTSTRAPPED', 'PLATE_MISMATCH',
      'PUMP_AMOUNT_MISMATCH','COUPON_LIMIT_EXCEEDED','RATE_LIMITED','PLAN_IN_USE','TRANSFER_ALREADY_SCHEDULED','SALES_STATION_LIMIT_REACHED']);
    const err = new Error('supabase_request_failed');
    err.status = response.status;
    if (allowed.has(detail?.message)) {
      err.code = detail.message === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' :
        detail.message === 'FORBIDDEN' ? 'FORBIDDEN' :
        ['INVITE_INVALID_OR_EXPIRED', 'INVALID_INVITATION'].includes(detail.message) ? 'INVITE_INVALID' :
        ['INVITED_EMAIL_MISMATCH', 'EMAIL_VERIFICATION_REQUIRED'].includes(detail.message) ? 'EMAIL_MISMATCH' :
        ['BOOTSTRAP_FORBIDDEN','ALREADY_BOOTSTRAPPED','PLATE_MISMATCH',
         'PUMP_AMOUNT_MISMATCH','COUPON_LIMIT_EXCEEDED','RATE_LIMITED','PLAN_IN_USE','TRANSFER_ALREADY_SCHEDULED','SALES_STATION_LIMIT_REACHED'].includes(detail.message) ? detail.message :
        'INVALID_REQUEST';
    }
    throw err;
  }
  return response.status === 204 ? null : response.json();
}
async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hashed = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hashed].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function hmac(key, value) {
  const signingKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bits = new Uint8Array(await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(value)));
  return [...bits].map(x => x.toString(16).padStart(2, '0')).join('');
}
function serviceRequest(env, path, init = {}) {
  return fetchJson(normalizeUrl(env, path), {
    ...init,
    headers: headers(env.SUPABASE_SERVICE_ROLE_KEY, { accept: 'application/json', ...(init.headers || {}) }),
  });
}
export function createSupabaseAdapter(env) {
  requireEnv(env);
  return {
    authenticate: async (accessToken) => {
      // Supabase Auth validates JWT, expiration and signature on server.
      const response = await fetch(normalizeUrl(env, '/auth/v1/user'), {
        headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return null;
      const user = await response.json();
      // Disabling QA mode disables every QA access token at the Worker boundary.
      if(user.app_metadata?.oilstation_qa===true &&
        (env.OILSTATION_QA_MODE_ENABLED!=='true' ||
         user.app_metadata.oilstation_qa_run_id!==env.OILSTATION_QA_RUN_ID))
        return null;
      return typeof user.id === 'string' ? { id: user.id,
       ...(user.app_metadata?.oilstation_qa===true?{isQa:true}:{}) } : null;
    },
    provisionQaAccount: async ({actorId,qaRunId,alias,password,roleCode,scopeType,scopeId})=>{
      const email='qa-'+alias+'@qa.oilstation.invalid';
      const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{
        auth:{persistSession:false,autoRefreshToken:false},
      });
      const {data,error}=await admin.auth.admin.createUser({
        email,password,email_confirm:true,
        app_metadata:{oilstation_qa:true,oilstation_qa_run_id:qaRunId},
      });
      if(error||!data?.user?.id)throw new Error('qa_auth_provision_failed');
      const id=data.user.id;
      try{
        // app_users, memberships and audit_events are deliberately not writable
        // over PostgREST, even by service_role. Use the narrowly scoped,
        // service-role-only SECURITY DEFINER RPC to commit them atomically.
        const registered=await serviceRequest(env,
          '/rest/v1/rpc/platform_qa_register_account',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({
              p_actor_id:actorId,p_user_id:id,p_alias:alias,
              p_role_code:roleCode,p_scope_type:scopeType,
              p_scope_id:scopeId,p_qa_run_id:qaRunId,
            }),
          });
        return {id,alias,roleCode,scopeType,scopeId,email,
          membershipId:registered.membershipId};
      }catch{
        // The Postgres RPC is atomic: a rejected invocation leaves no
        // app_users/membership/audit rows behind. Auth is a separate service.
        // Delete only the new Auth account; never delete other existing data.
        await admin.auth.admin.deleteUser(id).catch(()=>{});
        throw new Error('qa_provision_not_committed');
      }
    },
    resetQaPassword: async ({qaRunId,alias,password})=>{
      // Only called after the Worker authenticated an active Platform Super Admin
      // and checked the same-origin QA request + strong password.
      const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{
        auth:{persistSession:false,autoRefreshToken:false},
      });
      const wanted='qa-'+alias+'@qa.oilstation.invalid';
      // This list is not exposed to a client. Restrict to the current QA run
      // through immutable app_metadata set only by Supabase Auth Admin.
      for(let page=1;page<=5;page++){
        const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
        if(error)throw new Error('qa_reset_lookup_failed');
        const users=Array.isArray(data?.users)?data.users:[];
        const match=users.find(u=>u.email===wanted&&
          u.app_metadata?.oilstation_qa===true&&
          u.app_metadata?.oilstation_qa_run_id===qaRunId);
        if(match){
          const {error:changeError}=await admin.auth.admin.updateUserById(
            match.id,{password});
          if(changeError)throw new Error('qa_reset_update_failed');
          return true;
        }
        if(users.length<100)break;
      }
      return false;
    },
    db: {
      qaSalesScopes: async ({actorId,qaRunId,allowed})=>serviceRequest(env,
        '/rest/v1/rpc/oilstation_qa_sales_scopes',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:actorId,p_qa_run_id:qaRunId,
            p_organization_ids:allowed.organization,p_station_ids:allowed.station,
          }),
        }),
      qaScopedOptions: async allow=>{
        // Direct REST SELECT is intentionally unavailable on tenant tables,
        // even to service_role. A read-only QA-run-locked RPC validates every
        // approved station/org mapping and maintains alias order.
        const data=await serviceRequest(env,
          '/rest/v1/rpc/oilstation_qa_scope_options',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({
              p_qa_run_id:env.OILSTATION_QA_RUN_ID,
              p_organization_ids:allow.organization,
              p_station_ids:allow.station,
              p_company_ids:allow.corporate_company,
            }),
          });
        if(!data||!Array.isArray(data.organization)||
          !Array.isArray(data.station)||!Array.isArray(data.corporate_company)||
          !Array.isArray(data.platform))throw Error('qa_scope_unavailable');
        return data;
      },
      releaseStatus: async ()=>serviceRequest(env,
        '/rest/v1/rpc/oilstation_release_status',{
          method:'POST',headers:{'content-type':'application/json'},body:'{}',
        }),
      claimLineNotifications: async limit=>serviceRequest(env,
        '/rest/v1/rpc/claim_verified_line_notifications',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_limit:limit}),
        }),
      finishLineNotification: async (id,decision)=>serviceRequest(env,
        '/rest/v1/rpc/finish_verified_line_notification',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_notification_id:id,p_decision:decision}),
        }),
      platformSupportOverview: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_support_overview',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId}),
        }),
      platformSalesInspection: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_sales_station_inspection',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
            p_company_id:d.companyId??null}),
        }),
      platformSalesActivity: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_sales_activity_history',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
            p_before:d.before??null}),
        }),
      platformSalesWorkspace: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_sales_workspace',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId}),
        }),
      platformSalesTransfer: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_transfer_sales_station',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
            p_sales_user_id:d.salesUserId,p_reason:d.reason}),
        }),
      platformPaidSaasCommissionContext: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_paid_saas_commission_context',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,
            p_invoice_line_id:d.invoiceLineId}),
        }),
      stationSaasPlanOptions: async d=>serviceRequest(env,
        '/rest/v1/rpc/station_saas_plan_options',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
        }),
      stationSaasSelectPlan: async d=>serviceRequest(env,
        '/rest/v1/rpc/station_select_saas_plan',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
            p_plan_id:d.planId,p_payment_method:d.paymentMethod}),
        }),
      platformSaasBillingOverview: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_saas_billing_overview',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId}),
        }),
      platformSaasDefineBundlePlan: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_define_saas_bundle_plan',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_code:d.code,p_name:d.name,
            p_frequency:d.frequency,p_coupon_price_satang:d.couponPriceSatang,
            p_hr_price_satang:d.hrPriceSatang,
            p_bundle_price_satang:d.bundlePriceSatang,p_effective_on:d.effectiveOn}),
        }),
      platformSaasPlanEditor: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_saas_plan_editor',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_plan_id:d.planId}),
        }),
      platformSaasEditBundlePlan: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_edit_saas_bundle_plan',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_plan_id:d.planId,
            p_code:d.code,p_name:d.name,p_frequency:d.frequency,
            p_coupon_price_satang:d.couponPriceSatang,p_hr_price_satang:d.hrPriceSatang,
            p_bundle_price_satang:d.bundlePriceSatang,p_effective_on:d.effectiveOn}),
        }),
      platformSaasArchivePlan: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_archive_saas_plan',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_plan_id:d.planId}),
        }),
      platformSaasDefinePlan: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_define_saas_flat_plan',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_code:d.code,p_name:d.name,
            p_frequency:d.frequency,p_coupon_price_satang:d.couponPriceSatang,
            p_hr_price_satang:d.hrPriceSatang,p_effective_on:d.effectiveOn}),
        }),
      platformSaasTaxPolicy: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_review_saas_tax_policy',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_vat_mode:d.vatMode,
            p_rate_basis_points:d.rateBasisPoints,p_effective_on:d.effectiveOn}),
        }),
      platformSaasGroup: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_create_saas_billing_group',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_organization_id:d.organizationId,
           p_name:d.name,p_station_ids:d.stationIds}),
        }),
      platformSaasSubscription: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_subscribe_saas_station',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
           p_plan_id:d.planId,p_starts_at:d.startsAt,p_period_end:d.periodEnd}),
        }),
      platformSaasDraftInvoice: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_draft_saas_flat_invoice',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_billing_group_id:d.billingGroupId,
           p_payment_method:d.paymentMethod,p_period_start:d.periodStart,
           p_period_end:d.periodEnd}),
        }),
      platformSaasIssueInvoice: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_issue_saas_invoice',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_invoice_id:d.invoiceId}),
        }),
      listSaasInvoices: async d=>serviceRequest(env,
        '/rest/v1/rpc/list_issued_saas_invoices',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_organization_id:d.organizationId}),
        }),
      reconcileSaasPaid: async d=>serviceRequest(env,
        '/rest/v1/rpc/reconcile_saas_test_paid_event',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
           p_event_id:d.eventId,p_payment_intent_id:d.paymentIntentId,
           p_invoice_id:d.invoiceId,p_attempt_id:d.attemptId,
           p_amount_satang:d.amountSatang,
           p_received_satang:d.amountReceivedSatang,
           p_currency:d.currency,p_payment_status:d.status,p_livemode:d.livemode,
          }),
        }),
      prepareSaasPayment: async d=>serviceRequest(env,
        '/rest/v1/rpc/prepare_saas_test_payment',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_invoice_id:d.invoiceId,
            p_method:d.paymentMethod}),
        }),
      attachSaasPaymentIntent: async d=>serviceRequest(env,
        '/rest/v1/rpc/attach_saas_test_intent',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_attempt_id:d.attemptId,
            p_payment_intent_id:d.paymentIntentId}),
        }),
      recordStripeEvent: async d=>serviceRequest(env,
        '/rest/v1/rpc/record_stripe_signed_event',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_event_id:d.eventId,p_event_type:d.eventType,
          p_payload_hash:d.hash,p_livemode:d.livemode}),
      }),
      fuelReviewInbox: async d=>serviceRequest(env,
        '/rest/v1/rpc/fuel_photo_review_inbox',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
        }),
      fuelReviewPhotoAccess: async d=>serviceRequest(env,
        '/rest/v1/rpc/fuel_review_photo_access',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_evidence_id:d.evidenceId}),
        }),
      reviewFuelPhoto: async d=>serviceRequest(env,
        '/rest/v1/rpc/review_fuel_evidence_photo',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_evidence_id:d.evidenceId,
            p_approved:d.approved,p_liters:d.liters,p_gross_satang:d.grossSatang}),
        }),
      finishReviewedFueling: async d=>serviceRequest(env,
        '/rest/v1/rpc/complete_reviewed_fuel_session',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_session_id:d.sessionId,
            p_pump_evidence_id:d.pumpEvidenceId,
            p_receipt_evidence_id:d.receiptEvidenceId}),
        }),
      fuelOcrContext: async d=>serviceRequest(env,
        '/rest/v1/rpc/fuel_photo_ocr_context',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_evidence_id:d.evidenceId}),
        }),
      readFuelPhoto: async path=>{
        if(typeof path!=='string'||
          !/^stations\/[0-9a-f-]{36}\/sessions\/[0-9a-f-]{36}\/(pump_display|receipt)\/[0-9a-f-]{36}\.(jpg|png)$/i.test(path))
          throw new Error('invalid_private_path');
        const response=await fetch(normalizeUrl(env,'/storage/v1/object/oilstation-evidence/'+path),{
          headers:headers(env.SUPABASE_SERVICE_ROLE_KEY),
          signal:AbortSignal.timeout(15_000),
        });
        if(!response.ok||Number(response.headers.get('content-length'))>5*1024*1024)
          throw new Error('private_photo_unavailable');
        const bytes=new Uint8Array(await response.arrayBuffer());
        if(bytes.length<64||bytes.length>5*1024*1024)throw new Error('private_photo_unavailable');
        const type=path.endsWith('.png')?'image/png':'image/jpeg';
        if(type==='image/jpeg'?
           !(bytes[0]===255&&bytes[1]===216&&bytes[2]===255):
           ![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))
          throw new Error('invalid_private_photo');
        return {bytes,contentType:type};
      },
      recordFuelOcr: async d=>serviceRequest(env,
        '/rest/v1/rpc/record_fuel_photo_ocr_preview',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_evidence_id:d.evidenceId,
           p_liters:d.preview.liters,p_gross_satang:d.preview.grossSatang,
           p_confidence:d.preview.confidence}),
        }),
      authorizeFuelPhoto: async d=>serviceRequest(env,
        '/rest/v1/rpc/authorize_fuel_photo_upload',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_session_id:d.sessionId,p_kind:d.kind}),
        }),
      uploadFuelPhoto: async d=>{
        const ext=d.contentType==='image/jpeg'?'jpg':'png';
        const path='stations/'+d.stationId+'/sessions/'+d.sessionId+'/'+d.kind+'/'+crypto.randomUUID()+'.'+ext;
        const response=await fetch(normalizeUrl(env,'/storage/v1/object/oilstation-evidence/'+path),{
          method:'POST',headers:headers(env.SUPABASE_SERVICE_ROLE_KEY,{
           'content-type':d.contentType,'x-upsert':'false','cache-control':'max-age=0',
          }),body:d.bytes,signal:AbortSignal.timeout(15_000),
        });
        if(!response.ok)throw new Error('private_storage_failed');
        return path;
      },
      recordFuelPhoto: async d=>serviceRequest(env,
        '/rest/v1/rpc/record_fuel_photo_upload',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_session_id:d.sessionId,
            p_kind:d.kind,p_photo_path:d.path}),
        }),
      beginVerifiedFueling: async d=>serviceRequest(env,
        '/rest/v1/rpc/begin_verified_fuel_session',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_photo_id:d.photoId}),
        }),
      hrReviewedAttendancePunches: async d=>serviceRequest(env,
        '/rest/v1/rpc/hr_reviewed_attendance_punches_local',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_employee_id:d.employeeId,
           p_start_date:d.startDate,p_end_date:d.endDate}),
        }),
      hrAttendancePending: async d=>serviceRequest(env,
        '/rest/v1/rpc/hr_attendance_pending_inbox',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
        }),
      hrReviewAttendance: async d=>serviceRequest(env,
        '/rest/v1/rpc/hr_review_attendance_manual',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_event_id:d.eventId,
            p_approved:d.approved,p_reason:d.reason}),
        }),
      hrRecordGps: async d=>serviceRequest(env,'/rest/v1/rpc/hr_record_gps_attendance',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
          p_event_type:d.eventType,p_latitude:d.latitude,p_longitude:d.longitude,
          p_accuracy_m:d.accuracyMeters,p_idempotency_key:d.idempotencyKey}),
      }),
      hrRequestOt: async d => serviceRequest(env,'/rest/v1/rpc/hr_request_overtime',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          p_actor_id:d.actorId,p_employee_id:d.employeeId,
          p_shift_id:d.shiftId,p_planned:d.planned,
          p_requested_minutes:d.requestedMinutes,p_reason:d.reason,
        }),
      }),
      hrReviewOt: async d => serviceRequest(env,'/rest/v1/rpc/hr_approve_overtime',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({
          p_actor_id:d.actorId,p_request_id:d.requestId,
          p_approved_minutes:d.approvedMinutes,
        }),
      }),
      hrPendingOt: async d => serviceRequest(env,'/rest/v1/rpc/hr_pending_overtime',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
      }),
      hrPendingShiftChanges: async d => serviceRequest(env,
        '/rest/v1/rpc/hr_station_pending_shift_changes',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
        }),
      hrRequestShiftOverride: async d => serviceRequest(env,
        '/rest/v1/rpc/hr_request_shift_override',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_original_assignment_id:d.originalAssignmentId,
            p_new_template_id:d.newTemplateId,p_reason:d.reason,
          }),
        }),
      hrReviewShiftOverride: async d => serviceRequest(env,
        '/rest/v1/rpc/hr_review_shift_override',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_request_id:d.requestId,p_approved:d.approved,
          }),
        }),
      hrRoster: async d => serviceRequest(env,'/rest/v1/rpc/hr_station_roster',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
      }),
      hrSeedTemplates: async d => serviceRequest(env,'/rest/v1/rpc/hr_seed_shift_templates',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
      }),
      hrAddEmployee: async d => serviceRequest(env,'/rest/v1/rpc/hr_add_employee',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId,
          p_employee_code:d.employeeCode,p_name:d.name,p_wage_type:d.wageType,
          p_wage_satang:d.wageSatang,p_payroll_frequency:d.payrollFrequency}),
      }),
      hrAssignShift: async d => serviceRequest(env,'/rest/v1/rpc/hr_assign_shift',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({p_actor_id:d.actorId,p_employee_id:d.employeeId,
          p_template_id:d.templateId,p_date:d.date}),
      }),
      inviteFirstCorporateAdmin: async (d) => {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const token = btoa(String.fromCharCode(...bytes))
          .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const result = await serviceRequest(env, '/rest/v1/rpc/station_invite_first_corporate_admin',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_station_id:d.stationId,
            p_company_id:d.companyId,p_email:d.email,
            p_token_hash:await digest(token),p_expires_at:d.expiresAt,
          }),
        });
        const inviteUrl='https://oilstation.goldensoft.cloud/invite/'+token;
        const delivery=await sendInvitationEmail({
          env,email:d.email,inviteUrl,id:result.id,expiresAt:d.expiresAt,
        });
        return {...result,...delivery,inviteUrl};
      },
      qaCreateCorporateCustomer: async d=>serviceRequest(env,
        '/rest/v1/rpc/oilstation_qa_station_create_company',{
         method:'POST',headers:{'content-type':'application/json'},
         body:JSON.stringify({
          p_actor_id:d.actorId,p_qa_run_id:d.qaRunId,p_station_id:d.stationId,
          p_name:d.name,p_contact_email:d.contactEmail,p_station_ids:d.stationIds,
         }),
        }),
      qaCompanyEvidence: async d=>serviceRequest(env,
        '/rest/v1/rpc/oilstation_qa_company_evidence',{
         method:'POST',headers:{'content-type':'application/json'},
         body:JSON.stringify({p_qa_run_id:d.qaRunId,p_station_ids:d.stationIds}),
        }),
      createCorporateCustomer: async (d) => serviceRequest(env,
        '/rest/v1/rpc/station_create_corporate_customer',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_station_id:d.stationId,
            p_name:d.name,p_tax_id:d.taxId,p_contact_email:d.contactEmail,
            p_payment_terms_days:d.paymentTermsDays,
            p_due_mode:d.dueMode,p_statement_close_day:d.statementCloseDay,
          }),
        }),
      requestCorporateLink: async (d) => serviceRequest(env,
        '/rest/v1/rpc/request_corporate_station_link',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_station_id:d.stationId,p_company_id:d.companyId,
          }),
        }),
      canUploadPlate: async d => serviceRequest(env,
        '/rest/v1/rpc/authorize_station_plate_upload',{
         method:'POST',headers:{'content-type':'application/json'},
         body:JSON.stringify({
           p_actor_id:d.actorId,p_station_id:d.stationId,p_coupon_id:d.couponId,
         }),
        }),
      uploadPlate: async d => {
        const ext=d.contentType==='image/jpeg'?'jpg':'png';
        const path='stations/'+d.stationId+'/plate/'+d.couponId+'/'+crypto.randomUUID()+'.'+ext;
        const response=await fetch(normalizeUrl(env,'/storage/v1/object/oilstation-evidence/'+path),{
          method:'POST',
          headers:headers(env.SUPABASE_SERVICE_ROLE_KEY,{
            'content-type':d.contentType,'cache-control':'max-age=0','x-upsert':'false',
          }),
          body:d.bytes,signal:AbortSignal.timeout(15_000),
        });
        if(!response.ok)throw new Error('private_storage_failed');
        return path;
      },
      recordPlate: async d => serviceRequest(env,
        '/rest/v1/rpc/record_station_plate_photo',{
         method:'POST',headers:{'content-type':'application/json'},
         body:JSON.stringify({
           p_actor_id:d.actorId,p_station_id:d.stationId,
           p_coupon_id:d.couponId,p_photo_path:d.path,
         }),
        }),
      stationPlateReviewInbox: async d=>serviceRequest(env,
        '/rest/v1/rpc/station_plate_review_inbox',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_station_id:d.stationId}),
        }),
      platePhotoAccess: async d=>serviceRequest(env,
        '/rest/v1/rpc/station_plate_photo_access',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_photo_id:d.photoId}),
        }),
      plateOcrContext: async d=>serviceRequest(env,
        '/rest/v1/rpc/station_plate_ocr_context',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_photo_id:d.photoId}),
        }),
      readPlate: async path=>{
        if(typeof path!=='string'||!/^stations\/[0-9a-f-]{36}\/plate\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/i.test(path))
          throw new Error('invalid_private_path');
        const response=await fetch(normalizeUrl(env,'/storage/v1/object/oilstation-evidence/'+path),{
          headers:headers(env.SUPABASE_SERVICE_ROLE_KEY),signal:AbortSignal.timeout(15_000),
        });
        if(!response.ok || Number(response.headers.get('content-length'))>5*1024*1024)
          throw new Error('private_photo_unavailable');
        const bytes=new Uint8Array(await response.arrayBuffer());
        if(bytes.byteLength<64||bytes.byteLength>5*1024*1024)
          throw new Error('private_photo_unavailable');
        return {bytes,contentType:path.endsWith('.png')?'image/png':'image/jpeg'};
      },
      completePlateOcr: async d=>serviceRequest(env,
        '/rest/v1/rpc/complete_station_plate_ocr',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_photo_id:d.photoId,
            p_observed_plate:d.observedPlate,p_accepted:d.accepted}),
        }),
      reviewPlate: async d=>serviceRequest(env,
        '/rest/v1/rpc/review_station_plate_photo',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_photo_id:d.photoId,
            p_observed_plate:d.observedPlate,p_approved:d.approved}),
        }),
      expireCoupons: async (limit=200) => serviceRequest(env,
        '/rest/v1/rpc/expire_reserved_coupons',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_limit:limit}),
        }),
      inspectQr: async (actorId, payload) => {
        const match=/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})$/i.exec(payload);
        if (!match) { const e=new Error('invalid_qr'); e.code='INVALID_REQUEST'; throw e; }
        const signingKey=await crypto.subtle.importKey('raw',
          new TextEncoder().encode(env.COUPON_SIGNING_KEY),
          {name:'HMAC',hash:'SHA-256'},false,['verify']);
        const signature=Uint8Array.from(match[2].match(/../g),s=>parseInt(s,16));
        const valid=await crypto.subtle.verify('HMAC',signingKey,signature,
          new TextEncoder().encode(match[1]+':qr'));
        if (!valid) { const e=new Error('invalid_qr'); e.code='INVALID_REQUEST'; throw e; }
        return serviceRequest(env,'/rest/v1/rpc/inspect_station_coupon',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId,p_qr_hash:await digest(payload)}),
        });
      },
      pendingCorporateLinks: async (actorId) => serviceRequest(env,
        '/rest/v1/rpc/pending_corporate_station_links',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId}),
        }),
      approveCorporateLink: async (d) => serviceRequest(env,
        '/rest/v1/rpc/approve_corporate_station_link',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_request_id:d.requestId,p_approved:d.approved,
          }),
        }),
      createInvitation: async (input) => {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const token = btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const hash = await digest(token);
        const scoped = {
          p_actor_id: input.actorId,
          p_email: input.email,
          p_role_code: input.roleCode,
          p_scope_type: input.scopeType,
          p_organization_id: input.scopeType==='organization' ? input.scopeId : null,
          p_station_id: input.scopeType==='station' ? input.scopeId : null,
          p_company_id: input.scopeType==='corporate_company' ? input.scopeId : null,
          p_token_hash: hash,
          p_expires_at: input.expiresAt,
        };
        const result = await serviceRequest(env, '/rest/v1/rpc/create_scoped_invitation', {
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify(scoped),
        });
        const inviteUrl='https://oilstation.goldensoft.cloud/invite/'+token;
        const delivery=await sendInvitationEmail({
          env,email:input.email,inviteUrl,id:result.id,expiresAt:input.expiresAt,
        });
        return {...result,...delivery,inviteUrl};
      },
      bootstrapAdmin: async (actorId) => {
        if (!env.BOOTSTRAP_ADMIN_EMAIL || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.BOOTSTRAP_ADMIN_EMAIL)) {
          const e = new Error('bootstrap_not_configured');
          e.code = 'BOOTSTRAP_FORBIDDEN';
          throw e;
        }
        return serviceRequest(env, '/rest/v1/rpc/bootstrap_first_platform_admin', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            p_actor_id: actorId,
            p_expected_email: env.BOOTSTRAP_ADMIN_EMAIL,
          }),
        });
      },
      couponView: async (token) => {
        const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.([a-f0-9]{64})$/i.exec(token || '');
        if (!match) return null;
        const signingKey = await crypto.subtle.importKey('raw',
          new TextEncoder().encode(env.COUPON_SIGNING_KEY),
          { name: 'HMAC', hash: 'SHA-256' },false,['verify']);
        const signature = Uint8Array.from(match[2].match(/../g), x => parseInt(x,16));
        const valid = await crypto.subtle.verify('HMAC',signingKey,signature,
          new TextEncoder().encode(match[1] + ':link'));
        if (!valid) return null;
        try {
          const details = await serviceRequest(env, '/rest/v1/rpc/resolve_coupon_link', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ p_coupon_id: match[1], p_secret_hash: await digest(token) }),
          });
          const showQR = ['reserved','verified'].includes(details.status);
          return {
            id: details.id, status: details.status, stationName: details.station_name,
            fuelName: details.fuel_name, amountSatang: details.max_amount_satang,
            expiresAt: details.expires_at, replaced: details.replaced,
            qrPayload: showQR ? details.id + '.' +
              await hmac(env.COUPON_SIGNING_KEY, details.id + ':qr') : null,
          };
        } catch { return null; }
      },
      beginInvitedEmailOtp: async ({actorId,token})=>{
        // No database challenge and no OTP disclosure when sending is off.
        if(env.INVITATION_EMAIL_ENABLED!=='true'||
          !/^re_[A-Za-z0-9_]{12,}$/.test(env.RESEND_API_KEY||'')||
          !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(env.INVITATION_FROM_EMAIL||'')){
          const e=new Error('invited_email_provider_unconfigured');
          e.code='EMAIL_PROVIDER_UNAVAILABLE';throw e;
        }
        const tokenHash=await digest(token);
        const bound=0x100000000;
        const limit=Math.floor(bound/100000000)*100000000;
        const bytes=new Uint32Array(1);
        do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);
        const code=String(bytes[0]%100000000).padStart(8,'0');
        const proofHash=await hmac(env.COUPON_SIGNING_KEY,
          'invited-email-otp:'+actorId+':'+tokenHash+':'+code);
        const expiry=new Date(Date.now()+10*60*1000).toISOString();
        const pending=await serviceRequest(env,'/rest/v1/rpc/begin_invited_email_otp',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:actorId,p_token_hash:tokenHash,
            p_proof_hash:proofHash,p_expires_at:expiry,
          }),
        });
        const accepted=await sendInvitedEmailOtp({
          env,email:pending.email,code,id:pending.id,
        });
        if(!accepted){
          const e=new Error('email_delivery_unconfirmed');
          e.code='EMAIL_PROVIDER_UNAVAILABLE';throw e;
        }
        return {providerAccepted:true,expiresInMinutes:10};
      },
      confirmInvitedEmailOtp: async ({actorId,token,code})=>{
        const tokenHash=await digest(token);
        const proofHash=await hmac(env.COUPON_SIGNING_KEY,
          'invited-email-otp:'+actorId+':'+tokenHash+':'+code);
        return serviceRequest(env,'/rest/v1/rpc/confirm_invited_email_otp',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:actorId,p_token_hash:tokenHash,p_proof_hash:proofHash,
          }),
        });
      },
      acceptInvitation: async ({ actorId, token }) => {
        const tokenHash = await digest(token);
        return serviceRequest(env, '/rest/v1/rpc/accept_member_invitation', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ p_actor_id: actorId, p_token_hash: tokenHash }),
        });
      },
      memberships: async (userId) => {
        const params = new URLSearchParams({
          select: 'user_id,role_code,scope_type,organization_id,station_id,corporate_company_id,active,extra_permissions',
          user_id: 'eq.' + userId, active: 'eq.true',
        });
        return serviceRequest(env, '/rest/v1/memberships?' + params);
      },
      fuelBrands: async () => {
        const params = new URLSearchParams({
          select: 'code,display_name_th,display_name_en',
          active: 'eq.true', order: 'display_name_th.asc',
        });
        const rows = await serviceRequest(env, '/rest/v1/fuel_brands?' + params);
        return rows.map(({ code, display_name_th, display_name_en }) => ({
          code, name_th: display_name_th, name_en: display_name_en,
        }));
      },
      stationFuels: async (actorId, stationId) => {
        return serviceRequest(env, '/rest/v1/rpc/station_fuel_inventory', {
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId,p_station_id:stationId}),
        });
      },
      configureFuel: async (data) => {
        return serviceRequest(env, '/rest/v1/rpc/configure_station_fuel', {
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:data.actorId,p_station_id:data.stationId,
            p_station_fuel_id:data.stationFuelId,p_enabled:data.enabled,
            p_public_price:data.publicPrice,
          }),
        });
      },
      platformStations: async (actorId) => {
        return serviceRequest(env, '/rest/v1/rpc/platform_station_overview', {
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId}),
        });
      },
      salesStations: async actorId=>serviceRequest(env,
        '/rest/v1/rpc/platform_sales_station_overview',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId}),
        }),
      salesCreateStation: async d=>serviceRequest(env,
        '/rest/v1/rpc/platform_sales_create_station',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_request_id:d.requestId,
            p_organization_name:d.organizationName,p_station_name:d.stationName,
            p_brand_code:d.brandCode,p_enable_coupon:d.qrCoupon,
            p_enable_hr:d.hrPayroll,p_max_stations:d.maxStations}),
        }),
      createStation: async (data) => {
        return serviceRequest(env, '/rest/v1/rpc/platform_create_station', {
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:data.actorId,
            p_organization_name:data.organizationName,
            p_station_name:data.stationName,
            p_brand_code:data.brandCode,
            p_enable_coupon:data.qrCoupon,
            p_enable_hr:data.hrPayroll,
          }),
        });
      },
      walletIntegrity: async d=>serviceRequest(env,
        '/rest/v1/rpc/corporate_wallet_integrity_snapshot',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:d.actorId,p_account_id:d.accountId}),
        }),
      reviewTopup: async d=>serviceRequest(env,
        '/rest/v1/rpc/review_verified_corporate_topup',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_request_id:d.requestId,
            p_approved:d.approved,p_bank_received:d.bankReceived,
            p_verified_bank_reference:d.bankReference,
          }),
        }),
      canUploadTopup: async d=>serviceRequest(env,
        '/rest/v1/rpc/authorize_corporate_topup_upload',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_account_id:d.accountId,
            p_station_bank_id:d.bankId,p_amount_satang:d.amountSatang,
          }),
        }),
      uploadTopupSlip: async d=>{
        const ext=d.contentType==='image/png'?'png':'jpg';
        const path='accounts/'+d.accountId+'/slips/'+crypto.randomUUID()+'.'+ext;
        const resp=await fetch(normalizeUrl(env,
          '/storage/v1/object/oilstation-slips/'+path),{
          method:'POST',headers:headers(env.SUPABASE_SERVICE_ROLE_KEY,{
            'content-type':d.contentType,'cache-control':'max-age=0','x-upsert':'false',
          }),body:d.bytes,signal:AbortSignal.timeout(15_000),
        });
        if(!resp.ok)throw new Error('private_slip_upload_failed');
        return path;
      },
      submitTopup: async d=>serviceRequest(env,
        '/rest/v1/rpc/request_corporate_topup',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({
            p_actor_id:d.actorId,p_account_id:d.accountId,
            p_station_bank_id:d.bankId,p_amount_satang:d.amountSatang,
            p_slip_path:d.path,
          }),
        }),
      getTopupSlip: async d=>{
        const auth=await serviceRequest(env,
          '/rest/v1/rpc/authorize_station_topup_slip',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({p_actor_id:d.actorId,p_request_id:d.requestId}),
          });
        const path=auth.path;
        if(typeof path!=='string'||!/^accounts\/[a-f0-9-]+\/slips\/[a-f0-9-]+\.(jpg|png)$/.test(path))
          throw new Error('invalid_stored_slip_path');
        const resp=await fetch(normalizeUrl(env,
          '/storage/v1/object/authenticated/oilstation-slips/'+path),{
          method:'GET',headers:headers(env.SUPABASE_SERVICE_ROLE_KEY),
          signal:AbortSignal.timeout(10_000),
        });
        if(!resp.ok)throw new Error('slip_read_failed');
        const contentLength=Number(resp.headers.get('content-length'));
        if(contentLength>5242880)throw new Error('slip_size_invalid');
        const bytes=new Uint8Array(await resp.arrayBuffer());
        if(bytes.length>5242880||bytes.length<64)throw new Error('slip_size_invalid');
        return {bytes,contentType:path.endsWith('.png')?'image/png':'image/jpeg'};
      },
      corporateTopupBanks: async (actorId, accountId) =>
        serviceRequest(env, '/rest/v1/rpc/corporate_topup_bank_options',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId,p_account_id:accountId}),
        }),
      stationPendingTopups: async (actorId, stationId) =>
        serviceRequest(env, '/rest/v1/rpc/station_pending_topup_inbox',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({p_actor_id:actorId,p_station_id:stationId}),
        }),
      corporateAccounts: async (userId) => {
        return serviceRequest(env, '/rest/v1/rpc/corporate_account_summaries', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ p_actor_id: userId }),
        });
      },
      accountFuels: async (userId, accountId) => {
        return serviceRequest(env, '/rest/v1/rpc/corporate_account_fuel_offers', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ p_actor_id: userId, p_account_id: accountId }),
        });
      },
      account: async (accountId) => {
        const params = new URLSearchParams({
          select: 'id,company_id,station_id', id: 'eq.' + accountId, limit: '1',
        });
        const result = await serviceRequest(env, '/rest/v1/corporate_station_accounts?' + params);
        return result?.[0] ?? null;
      },
      fuelCatalog: async (brandCode) => {
        const params = new URLSearchParams({ select: 'code,name_th,name_en,fuel_family,verification_status,fuel_brands!inner(code)',
          'fuel_brands.code': 'eq.' + brandCode, active: 'eq.true', order: 'name_th.asc' });
        const rows = await serviceRequest(env, '/rest/v1/brand_fuel_products?' + params);
        return rows.map(({ fuel_brands, ...row }) => ({ ...row, brand_code: fuel_brands.code }));
      },
      issueCoupon: async (input) => {
        const id = crypto.randomUUID();
        const linkSig = await hmac(env.COUPON_SIGNING_KEY, id + ':link');
        const qrSig = await hmac(env.COUPON_SIGNING_KEY, id + ':qr');
        const linkToken = id + '.' + linkSig;
        const qrToken = id + '.' + qrSig;
        const payload = {
          p_coupon_id: id,
          p_actor_id: input.actorId,
          p_account_id: input.accountId,
          p_station_fuel_id: input.stationFuelId,
          p_amount_satang: input.amountSatang,
          p_expires_at: input.expiresAt,
          p_plate: input.plate,
          p_secret_hash: await digest(linkToken),
          p_qr_hash: await digest(qrToken),
          p_idempotency_key: input.idempotencyKey,
        };
        const result = await serviceRequest(env, '/rest/v1/rpc/issue_reserved_coupon', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        });
        // Idempotency replay can return an existing coupon ID; recalculate tokens.
        const couponId = result.id;
        const stableLinkSig = couponId === id ? linkSig : await hmac(env.COUPON_SIGNING_KEY, couponId + ':link');
        const stableQrSig = couponId === id ? qrSig : await hmac(env.COUPON_SIGNING_KEY, couponId + ':qr');
        return {
          id: couponId, status: result.status, replayed: result.replayed,
          expiresAt: result.expires_at, availableSatang: result.available_satang,
          shareUrl: 'https://oilstation.goldensoft.cloud/c/' + couponId + '.' + stableLinkSig,
          qrPayload: couponId + '.' + stableQrSig,
        };
      },
    },
  };
}
