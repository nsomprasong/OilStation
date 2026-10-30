-- Service-only public coupon link lookup.
-- Worker must verify HMAC signature of token before calling this RPC.
CREATE OR REPLACE FUNCTION public.resolve_coupon_link(
 p_coupon_id uuid,p_secret_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 c public.coupons%ROWTYPE;
 next_coupon public.coupons%ROWTYPE;
 station_name text;
 fuel_name text;
 n integer:=0;
BEGIN
 IF p_secret_hash IS NULL OR p_secret_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';
 END IF;
 SELECT * INTO c FROM public.coupons
  WHERE id=p_coupon_id AND secret_link_hash=p_secret_hash;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND'; END IF;
 -- Follow replacement chain so a previously shared link displays the new QR.
 WHILE c.status='cancelled' AND n<10 LOOP
  SELECT * INTO next_coupon FROM public.coupons
   WHERE replaces_coupon_id=c.id AND account_id=c.account_id
   ORDER BY issued_at DESC LIMIT 1;
  EXIT WHEN NOT FOUND;
  c:=next_coupon;
  n:=n+1;
 END LOOP;
 SELECT s.name INTO station_name FROM public.stations s WHERE s.id=c.station_id;
 SELECT coalesce(sp.name_override,sp.custom_name,p.name_th)
 INTO fuel_name
 FROM public.station_fuel_products sp LEFT JOIN public.brand_fuel_products p
 ON p.id=sp.brand_product_id WHERE sp.id=c.station_fuel_id;
 RETURN jsonb_build_object(
  'id',c.id,'status',case when c.expires_at<=clock_timestamp()
    AND c.status IN ('reserved','verified') THEN 'expired' ELSE c.status END,
  'expires_at',c.expires_at,
  'max_amount_satang',c.max_amount_satang::text,
  'station_name',station_name,
  'fuel_name',fuel_name,
  'replaced',c.id<>p_coupon_id
 );
END
$fn$;
REVOKE ALL ON FUNCTION public.resolve_coupon_link(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_coupon_link(uuid,text) TO service_role;
