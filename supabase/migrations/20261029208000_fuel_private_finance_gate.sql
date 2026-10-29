-- Only audited evidence wrappers may start or settle fuel in PostgREST.
-- SECURITY DEFINER wrappers can invoke these private routines as their owner;
-- the Cloudflare Worker service role may not bypass private evidence reviews.
REVOKE ALL ON FUNCTION public.start_reserved_fuel_session(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.finish_reserved_fuel_session(uuid,uuid,numeric,bigint,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
-- Review-only direct RPCs are still granted separately by their migration.
