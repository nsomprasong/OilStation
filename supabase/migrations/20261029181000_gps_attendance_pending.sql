-- Provisional GPS attendance. Face/manual verification is a separate approval;
-- never mark GPS alone accepted or payable.
CREATE TABLE IF NOT EXISTS public.station_geofence_settings(
 station_id uuid PRIMARY KEY REFERENCES public.stations(id),
 radius_m integer NOT NULL DEFAULT 150 CHECK(radius_m BETWEEN 50 AND 1500),
 max_accuracy_m integer NOT NULL DEFAULT 100 CHECK(max_accuracy_m BETWEEN 5 AND 500),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.station_geofence_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_geofence_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.station_geofence_settings FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE IF NOT EXISTS public.attendance_request_keys(
 employee_id uuid NOT NULL REFERENCES public.employees(id),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 128),
 event_id uuid NOT NULL UNIQUE,
 event_type text NOT NULL,
 payload_hash text NOT NULL,
 PRIMARY KEY(employee_id,idempotency_key)
);
ALTER TABLE public.attendance_request_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_request_keys FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_request_keys FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.hr_configure_station_geofence(
 p_actor_id uuid,p_station_id uuid,p_latitude numeric,p_longitude numeric,
 p_radius_m integer,p_accuracy_m integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF p_latitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR
   p_longitude IS NULL OR p_longitude NOT BETWEEN -180 AND 180 OR
   p_radius_m NOT BETWEEN 50 AND 1500 OR p_accuracy_m NOT BETWEEN 5 AND 500
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.active AND
   m.user_id=p_actor_id AND m.scope_type='station' AND m.station_id=p_station_id
   AND m.role_code IN ('station_owner','owner','manager','hr_manager'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 UPDATE public.stations SET latitude=p_latitude,longitude=p_longitude WHERE id=p_station_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 INSERT INTO public.station_geofence_settings(station_id,radius_m,max_accuracy_m)
 VALUES(p_station_id,p_radius_m,p_accuracy_m)
 ON CONFLICT(station_id) DO UPDATE SET radius_m=excluded.radius_m,
 max_accuracy_m=excluded.max_accuracy_m,updated_at=clock_timestamp();
 RETURN jsonb_build_object('configured',true,'stationId',p_station_id,
   'radiusMeters',p_radius_m,'maxAccuracyMeters',p_accuracy_m);
END $fn$;

CREATE OR REPLACE FUNCTION public.hr_record_gps_attendance(
 p_actor_id uuid,p_station_id uuid,p_event_type text,
 p_latitude numeric,p_longitude numeric,p_accuracy_m numeric,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE e public.employees%ROWTYPE;s public.stations%ROWTYPE;
 v_radius numeric; v_max numeric; v_dist double precision;v_status text:='unconfigured';
 v_saved_status text;v_saved_geofence text;
 v_event uuid:=gen_random_uuid();v_hash text;v_inserted integer;
 v_old public.attendance_request_keys%ROWTYPE;
BEGIN
 IF p_event_type NOT IN ('clock_in','clock_out','break_start','break_end') OR
    p_latitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR
    p_longitude IS NULL OR p_longitude NOT BETWEEN -180 AND 180 OR
    p_accuracy_m IS NULL OR p_accuracy_m NOT BETWEEN 0 AND 1000 OR
    p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 SELECT * INTO e FROM public.employees WHERE user_id=p_actor_id
 AND station_id=p_station_id AND employment_status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT * INTO s FROM public.stations WHERE id=p_station_id;
 SELECT coalesce(g.radius_m,150),coalesce(g.max_accuracy_m,100) INTO v_radius,v_max
 FROM public.stations st LEFT JOIN public.station_geofence_settings g
 ON st.id=g.station_id WHERE st.id=p_station_id;
 v_hash:=md5(concat_ws(':',p_event_type,p_latitude::text,p_longitude::text,p_accuracy_m::text));
 INSERT INTO public.attendance_request_keys(employee_id,idempotency_key,event_id,event_type,payload_hash)
 VALUES(e.id,p_idempotency_key,v_event,p_event_type,v_hash) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted=0 THEN
   SELECT * INTO v_old FROM public.attendance_request_keys
   WHERE employee_id=e.id AND idempotency_key=p_idempotency_key;
   IF v_old.event_type IS DISTINCT FROM p_event_type OR v_old.payload_hash IS DISTINCT FROM v_hash
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='IDEMPOTENCY_CONFLICT';END IF;
   -- A retry must report the committed event's CURRENT review status:
   -- the same nonce can be retried after a supervisor approved or rejected.
   SELECT a.review_status,a.geofence_status
     INTO v_saved_status,v_saved_geofence
     FROM public.attendance_events a WHERE a.id=v_old.event_id;
   IF NOT FOUND THEN
     RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';
   END IF;
   RETURN jsonb_build_object('id',v_old.event_id,
     'status',v_saved_status,'geofence',v_saved_geofence,
     'replayed',true,'faceVerified',false);
 END IF;
 IF s.latitude IS NOT NULL AND s.longitude IS NOT NULL THEN
   v_dist:=6371000.0*2*asin(sqrt(least(1.0,
    power(sin(radians((s.latitude-p_latitude)::double precision)/2),2)+
    cos(radians(p_latitude::double precision))*cos(radians(s.latitude::double precision))*
    power(sin(radians((s.longitude-p_longitude)::double precision)/2),2))));
   v_status:=CASE WHEN p_accuracy_m>v_max THEN 'uncertain'
     WHEN v_dist+p_accuracy_m<=v_radius THEN 'inside'
     WHEN v_dist-p_accuracy_m>v_radius THEN 'outside' ELSE 'uncertain' END;
 END IF;
 INSERT INTO public.attendance_events(id,employee_id,event_type,occurred_at,
 latitude,longitude,accuracy_meters,geofence_status,review_status,recorded_at)
 VALUES(v_event,e.id,p_event_type,clock_timestamp(),p_latitude,p_longitude,
 p_accuracy_m,v_status,'pending',clock_timestamp());
 RETURN jsonb_build_object('id',v_event,'status','pending','geofence',v_status,
 'distanceMeters',CASE WHEN v_dist IS NULL THEN NULL ELSE round(v_dist)::integer END,
 'replayed',false,'faceVerified',false);
END $fn$;
REVOKE ALL ON FUNCTION public.hr_configure_station_geofence(uuid,uuid,numeric,numeric,integer,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_record_gps_attendance(uuid,uuid,text,numeric,numeric,numeric,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hr_configure_station_geofence(uuid,uuid,numeric,numeric,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_record_gps_attendance(uuid,uuid,text,numeric,numeric,numeric,text) TO service_role;
