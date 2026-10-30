/**
 * Pure satang arithmetic only. Never use UI snapshots as authorization for a
 * coupon: an issuance must recheck the account under a PostgreSQL row lock.
 * BigInt is intentional: financial fields must not pass through JS Number.
 */
const FIELDS = ['prepaidSatang', 'creditLimitSatang', 'outstandingDebtSatang', 'reservedSatang'];

function readAccount(account) {
  if (!account || typeof account !== 'object') {
    throw new TypeError('account must be an object');
  }
  const values = {};
  for (const field of FIELDS) {
    const amount = account[field];
    if (typeof amount !== 'bigint') throw new TypeError(`${field} must be a bigint satang amount`);
    if (amount < 0n) throw new RangeError(`${field} cannot be negative`);
    values[field] = amount;
  }
  return values;
}

/**
 * A credit overrun reduces the total issuance capacity; it cannot be ignored.
 * A negative derived amount is clamped to zero rather than issuing more debt.
 */
export function availableToIssueSatang(account) {
  const { prepaidSatang, creditLimitSatang, outstandingDebtSatang, reservedSatang } = readAccount(account);
  const unreserved = prepaidSatang + creditLimitSatang - outstandingDebtSatang - reservedSatang;
  return unreserved > 0n ? unreserved : 0n;
}

export function assertCanIssueCoupon(account, requestedSatang) {
  if (typeof requestedSatang !== 'bigint') throw new TypeError('requestedSatang must be a bigint satang amount');
  if (requestedSatang <= 0n) throw new RangeError('requestedSatang must be positive');
  const availableSatang = availableToIssueSatang(account);
  if (requestedSatang > availableSatang) {
    const deficit = requestedSatang - availableSatang;
    throw new RangeError(`Insufficient available balance; deficit ${deficit} satang`);
  }
  return { availableSatang, requestedSatang };
}
