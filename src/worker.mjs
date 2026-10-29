import { createApi } from './api/router.mjs';
import { createEvidenceApi } from './api/evidence.mjs';
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
        }), { status:200, headers: { 'content-type':'application/json',
            'cache-control':'no-store', 'x-content-type-options':'nosniff' }});
      }
      try {
        const deps = createSupabaseAdapter(env);
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
  },
};
