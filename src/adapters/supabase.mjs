/**
 * All privileged PostgREST operations run on the trusted Worker only.
 * SUPABASE_SERVICE_ROLE_KEY must be configured as an encrypted Worker secret.
 * Browser clients NEVER receive this key; no direct table grants are needed.
 */
const headers = (key, extra = {}) => ({
  apikey: key,
  authorization: `Bearer ${key}`,
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
      'BOOTSTRAP_FORBIDDEN', 'ALREADY_BOOTSTRAPPED']);
    const err = new Error('supabase_request_failed');
    err.status = response.status;
    if (allowed.has(detail?.message)) {
      err.code = detail.message === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' :
        detail.message === 'FORBIDDEN' ? 'FORBIDDEN' :
        ['INVITE_INVALID_OR_EXPIRED', 'INVALID_INVITATION'].includes(detail.message) ? 'INVITE_INVALID' :
        ['INVITED_EMAIL_MISMATCH', 'EMAIL_VERIFICATION_REQUIRED'].includes(detail.message) ? 'EMAIL_MISMATCH' :
        ['BOOTSTRAP_FORBIDDEN','ALREADY_BOOTSTRAPPED'].includes(detail.message) ? detail.message :
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
      return typeof user.id === 'string' ? { id: user.id } : null;
    },
    db: {
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
