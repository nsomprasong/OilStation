-- LINE recipient may be attached only after independent LINE identity verification
-- and documented notification opt-in. No browser direct CRUD is permitted.
CREATE TABLE IF NOT EXISTS public.line_notification_bindings(
 user_id uuid PRIMARY KEY REFERENCES public.app_users(id),
 line_user_id text NOT NULL UNIQUE CHECK(line_user_id ~ '^U[0-9a-f]{32}$'),
 verified_at timestamptz NOT NULL,
 consented_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.line_notification_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_notification_bindings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_notification_bindings FROM PUBLIC,anon,authenticated,service_role;
-- Lease state is required for SKIP LOCKED worker claims. Do not expose these tables.
ALTER TABLE public.notification_outbox
 DROP CONSTRAINT IF EXISTS notification_outbox_status_check;
ALTER TABLE public.notification_outbox
 ADD CONSTRAINT notification_outbox_status_check
 CHECK(status IN ('pending','sending','sent','failed','cancelled'));

CREATE OR REPLACE FUNCTION public.claim_verified_line_notifications(p_limit integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Older events are cancelled, never retried after LINE's 24h retry-key window.
 UPDATE public.notification_outbox SET status='cancelled'
 WHERE channel='line' AND status IN ('pending','failed','sending')
   AND created_at<clock_timestamp()-interval '23 hours';
 WITH picks AS (
   SELECT n.id FROM public.notification_outbox n
   JOIN public.line_notification_bindings b ON b.user_id=n.recipient_user_id
    AND b.revoked_at IS NULL AND b.verified_at IS NOT NULL AND b.consented_at IS NOT NULL
   WHERE n.channel='line' AND
     (n.status IN ('pending','failed') OR (n.status='sending'
      AND n.next_attempt_at<=clock_timestamp()))
     AND n.attempts<5 AND
       (n.next_attempt_at IS NULL OR n.next_attempt_at<=clock_timestamp())
     AND n.created_at>=clock_timestamp()-interval '23 hours'
   ORDER BY n.created_at,n.id LIMIT p_limit FOR UPDATE OF n SKIP LOCKED
 ), claimed AS (
   UPDATE public.notification_outbox n SET status='sending',
    attempts=n.attempts+1,next_attempt_at=clock_timestamp()+interval '2 minutes'
   FROM picks WHERE n.id=picks.id
   RETURNING n.id,n.recipient_user_id,n.event_type
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,
   'lineUserId',b.line_user_id,'eventType',c.event_type)),'[]'::jsonb)
 INTO result FROM claimed c JOIN public.line_notification_bindings b
  ON b.user_id=c.recipient_user_id AND b.revoked_at IS NULL;
 RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.finish_verified_line_notification(
 p_notification_id uuid,p_decision text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE n public.notification_outbox%ROWTYPE;
BEGIN
 IF p_decision NOT IN ('sent','retry','cancel')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 UPDATE public.notification_outbox SET
  status=CASE WHEN p_decision='sent' THEN 'sent'
    WHEN p_decision='cancel' OR attempts>=5 THEN 'cancelled'
    ELSE 'failed' END,
  next_attempt_at=CASE WHEN p_decision='retry' AND attempts<5
    THEN clock_timestamp()+(power(2,least(attempts,4))::integer::text||' minutes')::interval
    ELSE NULL END
 WHERE id=p_notification_id AND channel='line' AND status='sending'
 RETURNING * INTO n;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 RETURN jsonb_build_object('id',n.id,'status',n.status);
END $fn$;
REVOKE ALL ON FUNCTION public.claim_verified_line_notifications(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_verified_line_notification(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_verified_line_notifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_verified_line_notification(uuid,text) TO service_role;
