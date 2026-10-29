-- Read-only Supabase public-table ACLs observed 2026-10-29.
-- Anon and authenticated had NO SELECT/INSERT/UPDATE/DELETE privileges
-- on ANY of the 65 public tables. Service role SELECT on four tables only.
-- The roles and this fixture are used solely in isolated PostgreSQL CI.
GRANT SELECT ON public.brand_fuel_products TO service_role;
GRANT SELECT ON public.corporate_station_accounts TO service_role;
GRANT SELECT ON public.fuel_brands TO service_role;
GRANT SELECT ON public.memberships TO service_role;
