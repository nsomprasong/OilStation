import { createApi } from './api/router.mjs';
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
      try {
        const deps = createSupabaseAdapter(env);
        return createApi(deps)(request);
      } catch {
        return new Response(JSON.stringify({ error: 'service_not_configured' }), {
          status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
