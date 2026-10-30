-- Least-privilege PostgREST read grants needed by the trusted Worker.
-- anon/authenticated still have NO direct access, and RLS remains forced on all tables.
-- Financial writes are exposed exclusively through audited SECURITY DEFINER RPCs.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON TABLE
  public.memberships,
  public.corporate_station_accounts,
  public.fuel_brands,
  public.brand_fuel_products
TO service_role;

-- No direct UPDATE/INSERT/DELETE on wallet/coupon/reservation tables.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.corporate_station_accounts,
  public.coupons,
  public.coupon_versions,
  public.credit_reservations,
  public.wallet_ledger
FROM service_role;
