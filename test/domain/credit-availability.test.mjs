import test from 'node:test';
import assert from 'node:assert/strict';
import { availableToIssueSatang, assertCanIssueCoupon } from '../../src/domain/credit-availability.mjs';

const account = (overrides = {}) => ({
  prepaidSatang: 50_000n,
  creditLimitSatang: 500_000n,
  outstandingDebtSatang: 130_000n,
  reservedSatang: 70_000n,
  ...overrides,
});

test('includes prepaid and approved remaining credit, subtracts prior holds', () => {
  assert.equal(availableToIssueSatang(account()), 350_000n);
});

test('validates exact amount and reports deficit; does not mutate account', () => {
  const values = account();
  assert.deepEqual(assertCanIssueCoupon(values, 350_000n), { availableSatang: 350_000n, requestedSatang: 350_000n });
  assert.throws(() => assertCanIssueCoupon(values, 350_001n), /insufficient/i);
  assert.equal(values.reservedSatang, 70_000n);
});

test('returns zero when fully reserved or credit is overdrawn', () => {
  assert.equal(availableToIssueSatang(account({ prepaidSatang: 0n, creditLimitSatang: 50n, outstandingDebtSatang: 100n, reservedSatang: 0n })), 0n);
  assert.equal(availableToIssueSatang(account({ prepaidSatang: 100n, creditLimitSatang: 0n, outstandingDebtSatang: 0n, reservedSatang: 100n })), 0n);
});

test('rejects invalid/unsafe or negative amounts instead of rounding', () => {
  assert.throws(() => availableToIssueSatang(account({ prepaidSatang: 12.5 })), /bigint/i);
  assert.throws(() => availableToIssueSatang(account({ reservedSatang: -1n })), /negative/i);
  assert.throws(() => assertCanIssueCoupon(account(), 0n), /positive/i);
  assert.throws(() => assertCanIssueCoupon(account(), 100.01), /bigint/i);
});

test('balance snapshot can change: caller must revalidate under database row lock', () => {
  const firstView = account();
  assert.equal(availableToIssueSatang(firstView), 350_000n);
  const updated = { ...firstView, reservedSatang: firstView.reservedSatang + 340_000n };
  assert.equal(availableToIssueSatang(updated), 10_000n);
  assert.throws(() => assertCanIssueCoupon(updated, 20_000n), /insufficient/i);
});
