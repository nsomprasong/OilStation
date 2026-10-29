CREATE OR REPLACE FUNCTION public.pending_corporate_station_links(p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE result jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'requestId',r.id,'companyId',r.company_id,'companyName',c.name,
  'stationId',r.station_id,'stationName',s.name,'requestedAt',r.requested_at
 ) ORDER BY r.requested_at),'[]'::jsonb)
 INTO result
 FROM public.corporate_station_link_requests r
 JOIN public.stations s ON s.id=r.station_id
 JOIN public.corporate_companies c ON c.id=r.company_id
 WHERE r.status='pending' AND EXISTS(
  SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id AND m.active
   AND m.scope_type='corporate_company'
   AND m.corporate_company_id=r.company_id AND m.role_code='corporate_admin');
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.pending_corporate_station_links(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pending_corporate_station_links(uuid) TO service_role;
