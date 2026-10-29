// An explicitly injected dependency boundary. Unit tests never access Supabase or secrets.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDKEY = /^[a-zA-Z0-9_-]{16,128}$/;
const LIMIT_BYTES = 16_384;
const allowMethods = { '/api/health': 'GET', '/api/me': 'GET', '/api/fuel-catalog': 'GET', '/api/coupons': 'POST', '/api/invitations/accept': 'POST' };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' },
  });
}
function fail(status, code) { return json(status, { error: code }); }
function permittedMember(m) { return m && m.active === true; }
function canIssue(m, companyId) {
  return permittedMember(m) &&
    m.scope_type === 'corporate_company' &&
    m.corporate_company_id === companyId &&
    (['corporate_admin', 'coupon_issuer', 'qr_issuer'].includes(m.role_code) || m.extra_permissions?.issue_coupon === true);
}
function parseCouponInput(data, now, idkey) {
  if (!data || Array.isArray(data) || typeof data !== 'object') return null;
  const { accountId, stationFuelId, amountSatang, expiresAt } = data;
  if (!UUID.test(accountId ?? '') || !UUID.test(stationFuelId ?? '')) return null;
  // The wire contract uses strings to avoid loss of integer precision in JSON.
  if (typeof amountSatang !== 'string' || !/^[1-9][0-9]{0,14}$/.test(amountSatang)) return null;
  if (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expiresAt)) return null;
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return null;
  if (typeof data.plate !== 'undefined' && (typeof data.plate !== 'string' || data.plate.length > 40)) return null;
  if (!IDKEY.test(idkey ?? '')) return null;
  return { accountId, stationFuelId, amountSatang, expiresAt: new Date(exp).toISOString(),
    plate: data.plate?.trim() || null, idempotencyKey: idkey };
}
async function readBody(request) {
  const header = request.headers.get('content-length');
  if (header && Number(header) > LIMIT_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let total = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMIT_BYTES) { await reader.cancel(); return null; }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) { bytes.set(p, offset); offset += p.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { return null; } finally { reader.releaseLock(); }
}
export function createApi({ authenticate, db, now = () => new Date() }) {
  return async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!(path in allowMethods)) return fail(404, 'not_found');
    if (request.method !== allowMethods[path]) return fail(405, 'method_not_allowed');
    if (path === '/api/health') return json(200, { service: 'oilstation', status: 'ok' });
    if (request.method !== 'GET' && request.headers.get('origin') &&
      request.headers.get('origin') !== url.origin) return fail(403, 'origin_forbidden');
    const header = request.headers.get('authorization') || '';
    const match = /^Bearer\s+([^\s]+)$/i.exec(header);
    if (!match) return fail(401, 'unauthenticated');
    try {
      const user = await authenticate(match[1]);
      if (!user?.id || !UUID.test(user.id)) return fail(401, 'unauthenticated');
      if (path === '/api/invitations/accept') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return fail(415, 'unsupported_media_type');
        const data = await readBody(request);
        if (typeof data?.token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(data.token)) return fail(400, 'invalid_invitation');
        return json(200, await db.acceptInvitation({ actorId: user.id, token: data.token }));
      }
      const memberships = (await db.memberships(user.id)) || [];
      const active = memberships.filter(permittedMember);
      if (!active.length) return fail(403, 'invitation_required');
      if (path === '/api/me') {
        return json(200, { userId: user.id, memberships: active.map(m => ({
          scopeType: m.scope_type, organizationId: m.organization_id,
          stationId: m.station_id, corporateCompanyId: m.corporate_company_id,
          role: m.role_code,
        })) });
      }
      if (path === '/api/fuel-catalog') {
        const brand = url.searchParams.get('brand');
        if (!brand || !/^[A-Z0-9_]{2,40}$/.test(brand)) return fail(400, 'invalid_brand');
        return json(200, { products: await db.fuelCatalog(brand) });
      }
      if (path === '/api/coupons') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return fail(415, 'unsupported_media_type');
        const body = await readBody(request);
        const input = parseCouponInput(body, now(), request.headers.get('idempotency-key'));
        if (!input) return fail(400, 'invalid_coupon_request');
        const account = await db.account(input.accountId);
        if (!account) return fail(404, 'account_not_found');
        if (!active.some(m => canIssue(m, account.company_id))) return fail(403, 'permission_denied');
        const result = await db.issueCoupon({ ...input, actorId: user.id, stationId: account.station_id });
        return json(result.replayed ? 200 : 201, { coupon: result });
      }
      return fail(404, 'not_found');
    } catch (error) {
      // Do not leak SQL details, bank/account references, keys, or stack traces.
      if (error && typeof error === 'object' && error.code === 'INSUFFICIENT_FUNDS') return fail(409, 'insufficient_funds');
      if (error && typeof error === 'object' && error.code === 'FORBIDDEN') return fail(403, 'permission_denied');
      if (error && typeof error === 'object' && error.code === 'INVALID_REQUEST') return fail(400, 'invalid_coupon_request');
      if (error && typeof error === 'object' && error.code === 'INVITE_INVALID') return fail(400, 'invalid_or_expired_invitation');
      if (error && typeof error === 'object' && error.code === 'EMAIL_MISMATCH') return fail(403, 'invited_email_verification_required');
      return fail(503, 'service_unavailable');
    }
  };
}
