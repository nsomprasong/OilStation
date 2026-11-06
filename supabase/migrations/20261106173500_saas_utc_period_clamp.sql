-- Compute next UTC end-exclusive service boundary with month-end/leap-year clamping.
-- This function only computes an instant; it cannot change billing or entitlements.
CREATE OR REPLACE FUNCTION public.saas_next_period_end_utc(
 p_effective_at timestamptz,p_frequency text
) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_local timestamp;v_start timestamp;v_next_month timestamp;
 v_after_month timestamp;v_days integer;v_anchor integer;v_tod interval;
BEGIN
 IF p_effective_at IS NULL OR p_frequency NOT IN ('monthly','yearly')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_local:=p_effective_at AT TIME ZONE 'UTC';
 v_start:=date_trunc('month',v_local);
 v_next_month:=v_start+CASE WHEN p_frequency='monthly' THEN interval '1 month'
  ELSE interval '1 year' END;
 v_after_month:=v_next_month+interval '1 month';
 v_days:=extract(day FROM v_after_month-interval '1 day')::integer;
 v_anchor:=extract(day FROM v_local)::integer;
 v_tod:=v_local-date_trunc('day',v_local);
 RETURN (v_next_month+(least(v_days,v_anchor)-1)*interval '1 day'+v_tod)
   AT TIME ZONE 'UTC';
END $fn$;
REVOKE ALL ON FUNCTION public.saas_next_period_end_utc(timestamptz,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.saas_next_period_end_utc(timestamptz,text) TO service_role;
