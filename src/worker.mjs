import { createApi } from './api/router.mjs';
import { createFuelReviewApi } from './api/fuel-review.mjs';
import { createFuelOcrApi } from './api/fuel-ocr.mjs';
import { createFuelPhotoApi } from './api/fuel-photo.mjs';
import { createFuelStartApi } from './api/fuel-start.mjs';
import { createEvidenceApi } from './api/evidence.mjs';
import { drainLineNotifications } from './notifications/line.mjs';
import { createCommissionPreviewApi } from './api/commission-preview.mjs';
import { createPlatformBillingApi } from './api/platform-billing.mjs';
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
import { createTopupEvidenceApi } from './api/topup-evidence.mjs';
import { createSupabaseAdapter } from './adapters/supabase.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({ service: 'oilstation', status: 'ok' }), {
          status: request.method === 'GET' ? 200 : 405,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
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
    ctx.waitUntil(
      createSupabaseAdapter(env).db.expireCoupons(200)
        .catch(() => { console.error('oilstation_coupon_expiry_failed'); })
    );
    if (env.LINE_NOTIFICATIONS_ENABLED === 'true' && env.LINE_CHANNEL_ACCESS_TOKEN) {
      ctx.waitUntil(drainLineNotifications({ db:createSupabaseAdapter(env).db,
        accessToken:env.LINE_CHANNEL_ACCESS_TOKEN,limit:10 })
        .catch(()=>console.error('oilstation_line_delivery_failed')));
    }
  },
};
