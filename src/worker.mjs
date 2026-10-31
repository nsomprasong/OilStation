import { createApi } from './api/router.mjs';
import { createFuelReviewApi } from './api/fuel-review.mjs';
import { createFuelOcrApi } from './api/fuel-ocr.mjs';
import { createFuelPhotoApi } from './api/fuel-photo.mjs';
import { createFuelStartApi } from './api/fuel-start.mjs';
import { createEvidenceApi } from './api/evidence.mjs';
import { drainLineNotifications } from './notifications/line.mjs';
import { createCommissionPreviewApi } from './api/commission-preview.mjs';
import { createPlatformSalesApi } from './api/platform-sales.mjs';
import { createPlatformBillingApi } from './api/platform-billing.mjs';
import { createStationSaasOnboardingApi } from './api/station-saas-onboarding.mjs';
import { createBillingInvoiceApi } from './api/billing-invoices.mjs';
import { createBillingPaymentApi } from './api/billing-payment.mjs';
import { createStripeTestPaymentIntents } from './adapters/stripe-test-payments.mjs';
import { createStripeWebhookApi } from './api/stripe-webhook.mjs';
import { createPlateReviewInboxApi } from './api/plate-review-inbox.mjs';
import { createAttendancePayrollPreviewApi } from './api/attendance-payroll-preview.mjs';
import { createAttendanceReviewApi } from './api/attendance-review.mjs';
import { createGpsAttendanceApi } from './api/attendance.mjs';
import { createPlateVerificationApi } from './api/plate-verification.mjs';
import { createGoogleVisionRecognizer } from './adapters/google-vision.mjs';
import { createWalletIntegrityApi } from './api/wallet-integrity.mjs';
import { createTopupEvidenceApi } from './api/topup-evidence.mjs';
import { createSupabaseAdapter } from './adapters/supabase.mjs';
import { createSupabaseConnectivityProbe } from './api/supabase-connectivity.mjs';
import {createQaAccountsApi,qaIsEnabled} from './api/qa-accounts.mjs';

const RELEASE_SCHEMA_VERSION = '20261029215000';
const PRODUCTION_SUPABASE_REF = 'cxihsotcpdnalswfoysx';

// UAT must explicitly name a separate Supabase project before ANY business
// operation can be enabled. Existing UAT bindings may still reference live
// credentials; a release flag and even a ready production database are not
// sufficient authorization to use them for tests.
function isIsolatedUatDatabase(env) {
  if (env?.OILSTATION_DEPLOY_TARGET !== 'uat') return true;
  const ref = env?.OILSTATION_UAT_SUPABASE_REF;
  if (typeof ref !== 'string' || !/^[a-z0-9]{20}$/.test(ref) ||
      ref === PRODUCTION_SUPABASE_REF) return false;
  return env?.SUPABASE_URL === 'https://' + ref + '.supabase.co' ||
    env?.SUPABASE_URL === 'https://' + ref + '.supabase.co/';
}

// An activation flag alone must never unlock business or scheduled writes.
async function isReleaseReady(env) {
  if (env?.OILSTATION_API_ENABLED !== 'true' || !isIsolatedUatDatabase(env)) return false;
  try {
    const status = await createSupabaseAdapter(env).db.releaseStatus();
    return status?.ready === true && status?.schemaVersion === RELEASE_SCHEMA_VERSION;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/internal/supabase-connectivity') {
        return createSupabaseConnectivityProbe(env)(request);
      }
      // Explicit server-only QA switch. Never expose account creation just
      // because the production preview login is enabled.
      if(url.pathname.startsWith('/api/qa/')){
        if(!qaIsEnabled(env))return new Response(JSON.stringify({error:'not_found'}),{
          status:404,headers:{'content-type':'application/json','cache-control':'no-store'},
        });
        try{
          const adapter=createSupabaseAdapter(env);
          return createQaAccountsApi({
            env,authenticate:adapter.authenticate,db:adapter.db,
            provisionAccount:adapter.provisionQaAccount,
          })(request);
        }catch{
          return new Response(JSON.stringify({error:'qa_service_unavailable'}),{
            status:503,headers:{'content-type':'application/json','cache-control':'no-store'},
          });
        }
      }
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({ service: 'oilstation', status: 'ok' }), {
          status: request.method === 'GET' ? 200 : 405,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      // Early production preview: the publishable Supabase key and project URL
      // let testers use OAuth while finance/privileged APIs remain release-gated.
      if (url.pathname === '/api/public-config' &&
          env.OILSTATION_PREVIEW_LOGIN_ENABLED === 'true') {
        if (request.method !== 'GET') return new Response(null,{status:405});
        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)
          return new Response(JSON.stringify({error:'service_not_configured'}),{
            status:503,headers:{'content-type':'application/json','cache-control':'no-store'},
          });
        return new Response(JSON.stringify({
          supabaseUrl:env.SUPABASE_URL,supabaseAnonKey:env.SUPABASE_ANON_KEY,
          stripePublishableKey:null,qaModeEnabled:qaIsEnabled(env),
        }),{status:200,headers:{'content-type':'application/json; charset=utf-8',
           'cache-control':'no-store','x-content-type-options':'nosniff'}});
      }
      // In preview mode, first-admin bootstrap and authenticated membership
      // lookup are the only privileged routes accessible before the full
      // financial release. Supabase validates the OAuth token and the bootstrap
      // RPC enforces the preconfigured confirmed email and single admin.
      if (env.OILSTATION_DEPLOY_TARGET === 'production' &&
          env.OILSTATION_PREVIEW_LOGIN_ENABLED === 'true' &&
          env.OILSTATION_API_ENABLED !== 'true' &&
          (url.pathname === '/api/bootstrap' || url.pathname === '/api/me')) {
        try {
          return createApi(createSupabaseAdapter(env))(request);
        } catch {
          return new Response(JSON.stringify({error:'service_not_configured'}),{
            status:503,headers:{'content-type':'application/json; charset=utf-8',
              'cache-control':'no-store','x-content-type-options':'nosniff'},
          });
        }
      }
      // Production-first pilot: expose only explicitly scoped onboarding APIs.
      // All other financial actions remain gated by the full release marker.
      if (env.OILSTATION_DEPLOY_TARGET==='production' &&
          env.OILSTATION_PREVIEW_LOGIN_ENABLED==='true' &&
          env.OILSTATION_PREVIEW_OPERATIONS_ENABLED==='true' &&
          env.OILSTATION_API_ENABLED!=='true') {
        const salesPages=new Set(['/api/platform/sales/workspace',
          '/api/platform/sales/transfer',
          '/api/platform/sales/inspection','/api/platform/sales/activity']);
        const billingPages=new Set(['/api/platform/billing/overview',
          '/api/platform/billing/tax','/api/platform/billing/flat-plan',
          '/api/platform/billing/bundle-plan','/api/platform/billing/archive-plan',
          '/api/platform/billing/plan-editor','/api/platform/billing/edit-plan']);
        const stationPages=new Set(['/api/fuel-brands',
          '/api/platform/stations','/api/platform/create-station',
          '/api/platform/sales/stations','/api/platform/sales/create-station',
          '/api/invitations/create','/api/invitations/accept',
          '/api/invitations/email-challenge','/api/invitations/email-confirm',
          '/api/station-fuels','/api/station-fuel-config']);
        try {
          if(salesPages.has(url.pathname))
            return createPlatformSalesApi(createSupabaseAdapter(env))(request);
          if(billingPages.has(url.pathname))
            return createPlatformBillingApi(createSupabaseAdapter(env))(request);
          if(stationPages.has(url.pathname))
            return createApi(createSupabaseAdapter(env))(request);
          if(url.pathname==='/api/station/billing/options' ||
             url.pathname==='/api/station/billing/select')
            return createStationSaasOnboardingApi(createSupabaseAdapter(env))(request);
        } catch {
          return new Response(JSON.stringify({error:'service_not_configured'}),{
            status:503,headers:{'content-type':'application/json','cache-control':'no-store'},
          });
        }
      }
      if (url.pathname === '/api/ready') {
        if (request.method !== 'GET') return new Response(null,{status:405});
        // A healthy process is not a ready release. Validate the deployed
        // DB migration marker, private buckets and server-only secrets.
        const ready = await isReleaseReady(env);
        return new Response(JSON.stringify({service:'oilstation',ready}),{
          status:ready?200:503,
          headers:{'content-type':'application/json; charset=utf-8',
            'cache-control':'no-store','x-content-type-options':'nosniff'},
        });
      }
      // Safe default: uploading a Worker must NEVER enable money writes,
      // private evidence, invitations or scheduled tasks before explicit UAT.
      if (env.OILSTATION_API_ENABLED!=='true') {
        return new Response(JSON.stringify({error:'release_not_enabled'}),{
          status:503,headers:{'content-type':'application/json',
            'cache-control':'no-store','x-content-type-options':'nosniff'},
        });
      }
      // Even if an operator accidentally enables the feature flag, refuse
      // every business endpoint until SQL ACLs, private buckets and version
      // have been independently attested by the server-side readiness RPC.
      if (!(await isReleaseReady(env))) {
        return new Response(JSON.stringify({error:'release_not_ready'}),{
          status:503,headers:{'content-type':'application/json',
            'cache-control':'no-store','x-content-type-options':'nosniff'},
        });
      }
      if (url.pathname === '/api/public-config') {
        if (request.method !== 'GET') return new Response(null,{status:405});
        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return new Response(null,{status:503});
        return new Response(JSON.stringify({
          supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY,
          stripePublishableKey:env.STRIPE_TEST_PAYMENTS_ENABLED==='true' &&
           /^pk_test_[A-Za-z0-9_]{12,}$/.test(env.STRIPE_PUBLISHABLE_KEY||'')?
           env.STRIPE_PUBLISHABLE_KEY:null,
        }), { status:200, headers: { 'content-type':'application/json',
            'cache-control':'no-store', 'x-content-type-options':'nosniff' }});
      }
      try {
        const deps = createSupabaseAdapter(env);
        if (['/api/evidence/fuel/reviews','/api/evidence/fuel/photo',
             '/api/evidence/fuel/review','/api/fuel/finish'].includes(url.pathname)) {
          return createFuelReviewApi(deps)(request);
        }
        if (url.pathname === '/api/evidence/fuel/ocr') {
          return createFuelOcrApi({...deps,
            recognize:createGoogleVisionRecognizer(env.GOOGLE_VISION_API_KEY)})(request);
        }
        if (url.pathname === '/api/evidence/fuel') {
          return createFuelPhotoApi(deps)(request);
        }
        if (url.pathname === '/api/fuel/start') {
          return createFuelStartApi(deps)(request);
        }
        if (url.pathname.startsWith('/api/platform/sales/')) {
          return createPlatformSalesApi(deps)(request);
        }
        if (url.pathname === '/api/platform/billing/commission-preview') {
          return createCommissionPreviewApi(deps)(request);
        }
        if (url.pathname.startsWith('/api/platform/billing/')) {
          return createPlatformBillingApi(deps)(request);
        }
        if (url.pathname === '/api/billing/invoices') {
          return createBillingInvoiceApi(deps)(request);
        }
        if (url.pathname === '/api/billing/payment-intent') {
          const enabled=env.STRIPE_TEST_PAYMENTS_ENABLED==='true';
          const payments=enabled?createStripeTestPaymentIntents(env.STRIPE_SECRET_KEY):null;
          return createBillingPaymentApi({...deps,payments,enabled})(request);
        }
        if (url.pathname === '/api/webhooks/stripe') {
          return createStripeWebhookApi({db:deps.db,secret:env.STRIPE_WEBHOOK_SECRET,
            processTestPayments:env.STRIPE_TEST_RECONCILIATION_ENABLED==='true' &&
              env.STRIPE_TEST_PAYMENTS_ENABLED==='true'})(request);
        }
        if (url.pathname === '/api/hr/attendance/payroll-preview') {
          return createAttendancePayrollPreviewApi(deps)(request);
        }
        if (url.pathname === '/api/hr/attendance/pending' || url.pathname === '/api/hr/attendance/review') {
          return createAttendanceReviewApi(deps)(request);
        }
        if (url.pathname === '/api/hr/attendance/gps') {
          return createGpsAttendanceApi(deps)(request);
        }
        if (url.pathname === '/api/corporate/wallet-integrity') {
          return createWalletIntegrityApi(deps)(request);
        }
        if (url.pathname === '/api/evidence/topup' || url.pathname === '/api/evidence/topup-slip') {
          return createTopupEvidenceApi(deps)(request);
        }
        if (url.pathname === '/api/evidence/plate/reviews' || url.pathname === '/api/evidence/plate/photo') {
          return createPlateReviewInboxApi(deps)(request);
        }
        if (url.pathname === '/api/evidence/plate/ocr' || url.pathname === '/api/evidence/plate/review') {
          return createPlateVerificationApi({ ...deps,
            recognize: createGoogleVisionRecognizer(env.GOOGLE_VISION_API_KEY),
          })(request);
        }
        if (url.pathname === '/api/evidence/plate') {
          return createEvidenceApi(deps)(request);
        }
        if (url.pathname === '/api/coupon-view') {
          if (request.method !== 'GET') return new Response(null,{status:405});
          const token = url.searchParams.get('token');
          if (!token || token.length>150) return new Response(null,{status:404});
          const data = await deps.db.couponView(token);
          return new Response(JSON.stringify(data || {error:'invalid_coupon'}),{
            status:data?200:404,
            headers:{'content-type':'application/json','cache-control':'no-store',
              'referrer-policy':'no-referrer','x-content-type-options':'nosniff'},
          });
        }
        return createApi(deps)(request);
      } catch {
        return new Response(JSON.stringify({ error: 'service_not_configured' }), {
          status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
  scheduled(_controller, env, ctx) {
    if (env.OILSTATION_API_ENABLED !== 'true') return;
    // Cron can mutate balances or send messages: require the exact same
    // verified release state as the interactive business API.
    ctx.waitUntil((async () => {
      if (!(await isReleaseReady(env))) return;
      const db = createSupabaseAdapter(env).db;
      const tasks = [
        db.expireCoupons(200).catch(() => {
          console.error('oilstation_coupon_expiry_failed');
        }),
      ];
      if (env.LINE_NOTIFICATIONS_ENABLED === 'true' && env.LINE_CHANNEL_ACCESS_TOKEN) {
        tasks.push(drainLineNotifications({
          db, accessToken:env.LINE_CHANNEL_ACCESS_TOKEN,limit:10,
        }).catch(() => console.error('oilstation_line_delivery_failed')));
      }
      await Promise.all(tasks);
    })());
  },
};
