import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../src/api/router.mjs';

const USER = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const FUEL = '33333333-3333-4333-8333-333333333333';
const COMPANY = '44444444-4444-4444-8444-444444444444';
const STATION = '55555555-5555-4555-8555-555555555555';
const request = (url, method = 'GET', data, headers = {}) => new Request('https://oilstation.goldensoft.cloud' + url, {
  method,
  headers: { ...(data ? { 'content-type': 'application/json' } : {}), ...headers },
  ...(data ? { body: JSON.stringify(data) } : {}),
});

function app({ authenticated = true, membership = true, accountStation = STATION } = {}) {
  const calls = [];
  const dependencies = {
    authenticate: async (token) => authenticated && token === 'verified-token' ? { id: USER } : null,
    db: {
      memberships: async (userId) => membership ? [{
        user_id: userId, role_code: 'coupon_issuer', scope_type: 'corporate_company',
        corporate_company_id: COMPANY, active: true, extra_permissions: {},
      }] : [],
      account: async (id) => id === ACCOUNT ? { id, company_id: COMPANY, station_id: accountStation } : null,
      issueCoupon: async (args) => { calls.push(args); return { id: 'aaaa0000-0000-4000-8000-000000000000', status: 'reserved', replayed: false }; },
      fuelCatalog: async (brand) => [{ code: 'GSH95', brand_code: brand, name_th: 'แก๊สโซฮอล์ 95' }],
    },
    now: () => new Date('2026-10-29T12:00:00.000Z'),
  };
  return { handler: createApi(dependencies), calls };
}

const AUTH = { authorization: 'Bearer verified-token' };
const couponData = {
  accountId: ACCOUNT,
  stationFuelId: FUEL,
  amountSatang: '250000',
  expiresAt: '2026-10-30T12:00:00.000Z',
  plate: 'กข 1234',
};

test('unauthenticated requests never read business data', async () => {
  const { handler, calls } = app();
  assert.equal((await handler(request('/api/me'))).status, 401);
  assert.equal((await handler(request('/api/coupons', 'POST', couponData, { 'idempotency-key': 'a'.repeat(16) }))).status, 401);
  assert.equal(calls.length, 0);
});

test('valid user without accepted invite membership has no access', async () => {
  const { handler } = app({ membership: false });
  assert.equal((await handler(request('/api/me', 'GET', undefined, AUTH))).status, 403);
  assert.equal((await handler(request('/api/fuel-catalog?brand=PTT', 'GET', undefined, AUTH))).status, 403);
});

test('health works without secret configuration; private endpoints need auth', async () => {
  const { handler } = app();
  const r = await handler(request('/api/health'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
  assert.equal((await handler(request('/api/health', 'POST'))).status, 405);
});

test('known corporate issuer can reserve only its authorized corporate account', async () => {
  const { handler, calls } = app();
  const res = await handler(request('/api/coupons', 'POST', couponData, {
    ...AUTH, 'idempotency-key': 'reserve-coupon-0001',
  }));
  assert.equal(res.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].actorId, USER);
  assert.equal(calls[0].amountSatang, '250000');
  assert.equal(calls[0].accountId, ACCOUNT);
  assert.ok(!JSON.stringify(await res.json()).includes('SUPABASE_SERVICE'));
});

test('cross-company or nonmember coupon attempts are forbidden', async () => {
  const { handler, calls } = app({ membership: false });
  const r = await handler(request('/api/coupons', 'POST', couponData, { ...AUTH, 'idempotency-key': 'reserve-coupon-0001' }));
  assert.equal(r.status, 403);
  assert.equal(calls.length, 0);
});

test('rejects bad money input, missing idempotency, bad expiry and cross-origin writes', async () => {
  const { handler, calls } = app();
  const base = { ...AUTH, 'idempotency-key': 'reserve-coupon-0001' };
  assert.equal((await handler(request('/api/coupons', 'POST', { ...couponData, amountSatang: '250.50' }, base))).status, 400);
  assert.equal((await handler(request('/api/coupons', 'POST', { ...couponData, amountSatang: '-1' }, base))).status, 400);
  assert.equal((await handler(request('/api/coupons', 'POST', { ...couponData, expiresAt: '2026-10-28T12:00:00Z' }, base))).status, 400);
  assert.equal((await handler(request('/api/coupons', 'POST', couponData, AUTH))).status, 400);
  assert.equal((await handler(request('/api/coupons', 'POST', couponData, { ...base, origin: 'https://evil.example' }))).status, 403);
  assert.equal(calls.length, 0);
});

test('members see scoped session and brand catalog, not arbitrary data', async () => {
  const { handler } = app();
  const sess = await handler(request('/api/me', 'GET', undefined, AUTH));
  assert.equal(sess.status, 200);
  const data = await sess.json();
  assert.equal(data.memberships.length, 1);
  const catalog = await handler(request('/api/fuel-catalog?brand=PTT', 'GET', undefined, AUTH));
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).products[0].brand_code, 'PTT');
});
