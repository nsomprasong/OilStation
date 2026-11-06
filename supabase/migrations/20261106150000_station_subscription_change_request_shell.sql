-- Structural prerequisite for SaaS replacement scheduling (#205).
-- No INSERT/UPDATE route, scheduler, charges or subscription modifications here.
-- Do not backfill production QA subscriptions or manufacture pending transitions.
CREATE TABLE IF NOT EXISTS public.station_subscription_change_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 requested_by uuid NOT NULL REFERENCES public.app_users(id),
 current_subscription_id uuid NOT NULL REFERENCES public.station_subscriptions(id),
 current_plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
 next_plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
 old_period_end_snapshot timestamptz NOT NULL,
 requested_effective_at timestamptz NOT NULL,
 renewal_anchor_day integer,
 idempotency_key text NOT NULL,
 request_fingerprint text NOT NULL,
 price_snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 payment_status text NOT NULL DEFAULT 'unconfirmed',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 cancelled_at timestamptz,
 applied_at timestamptz,
 CONSTRAINT saas_change_distinct_plan CHECK (current_plan_id <> next_plan_id),
 CONSTRAINT saas_change_not_backdated CHECK (requested_effective_at >= old_period_end_snapshot),
 CONSTRAINT saas_change_anchor_range CHECK (renewal_anchor_day BETWEEN 1 AND 31),
 CONSTRAINT saas_change_request_key_length CHECK (length(idempotency_key) BETWEEN 8 AND 128),
 CONSTRAINT saas_change_request_fingerprint_length CHECK (length(request_fingerprint) BETWEEN 8 AND 2048),
 CONSTRAINT saas_change_price_snapshot_required CHECK (
   jsonb_typeof(price_snapshot)='object' AND price_snapshot <> '{}'::jsonb
 ),
 CONSTRAINT saas_change_status CHECK (status IN ('pending','cancelled','applied','failed')),
 CONSTRAINT saas_change_payment_status CHECK (payment_status IN ('unconfirmed','confirmed','failed')),
 CONSTRAINT saas_change_status_timestamp CHECK (
  (status='cancelled' AND cancelled_at IS NOT NULL AND applied_at IS NULL) OR
  (status='applied' AND applied_at IS NOT NULL AND cancelled_at IS NULL) OR
  (status IN ('pending','failed') AND cancelled_at IS NULL AND applied_at IS NULL)
 ),
 CONSTRAINT saas_change_per_station_key UNIQUE (station_id,idempotency_key)
);

-- One pending transition per station, enforced by the database even under race.
CREATE UNIQUE INDEX IF NOT EXISTS saas_change_one_pending_per_station
 ON public.station_subscription_change_requests(station_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS saas_change_due_lookup
 ON public.station_subscription_change_requests(requested_effective_at)
 WHERE status='pending';

ALTER TABLE public.station_subscription_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.station_subscription_change_requests
 FROM PUBLIC,anon,authenticated;
-- Read-only inspection by trusted backend only; mutation grants deliberately absent.
GRANT SELECT ON TABLE public.station_subscription_change_requests TO service_role;

COMMENT ON TABLE public.station_subscription_change_requests IS
 'Restricted scheduled SaaS plan replacement history; no mutation RPC or activation is installed by this migration. Business policy and trusted payment/atomic activation remain gated by issue 205.';
