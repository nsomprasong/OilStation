-- Private evidence bucket: browser has no direct Storage grants or policies.
-- Photos are stored only via trusted Worker after station-scoped auth checks.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('oilstation-evidence','oilstation-evidence',false,5242880,
 ARRAY['image/jpeg','image/png']::text[])
ON CONFLICT(id) DO UPDATE SET
 public=false,file_size_limit=5242880,
 allowed_mime_types=ARRAY['image/jpeg','image/png']::text[];

-- The OCR/visual-attestation pipeline is deliberately NOT exposed as an API
-- until it can validate a real private image, its correct coupon and station,
-- and distinguish OCR uncertainty from an actually different plate.
CREATE TABLE IF NOT EXISTS public.coupon_photo_checks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 coupon_id uuid NOT NULL REFERENCES public.coupons(id),
 station_id uuid NOT NULL REFERENCES public.stations(id),
 photo_path text NOT NULL,
 captured_by uuid NOT NULL REFERENCES public.app_users(id),
 observed_plate text,
 decision text NOT NULL CHECK(decision IN
  ('pending','verified_ocr','verified_supervisor','rejected')),
 checked_by uuid REFERENCES public.app_users(id),
 checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT coupon_photo_check_path_unique UNIQUE(coupon_id,photo_path),
 CONSTRAINT coupon_photo_check_review_state CHECK(
   (decision='pending' AND checked_at IS NULL)
   OR (decision<>'pending' AND checked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS coupon_photo_checks_coupon_decision_idx
 ON public.coupon_photo_checks(coupon_id,decision,checked_at DESC);
ALTER TABLE public.coupon_photo_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_photo_checks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.coupon_photo_checks FROM PUBLIC,anon,authenticated,service_role;
-- The dedicated trust-checked OCR/supervisor workflow will expose a
-- narrowly scoped SECURITY DEFINER routine; no manual/attendant API today.
