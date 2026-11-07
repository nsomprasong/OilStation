-- Station-specific operations and tax-invoice issuer information.
-- This is a data profile only; it does NOT generate VAT invoices or alter billing.
CREATE TABLE public.station_operational_profiles(
  station_id uuid PRIMARY KEY REFERENCES public.stations(id) ON DELETE CASCADE,
  contact_name text,
  station_phone text,
  station_email text,
  postal_code text,
  invoice_issuer_name text,
  invoice_tax_id text,
  invoice_branch_code text,
  invoice_address text,
  invoice_phone text,
  invoice_email text,
  vat_registered boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.station_operational_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_operational_profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.station_operational_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.station_operational_profiles TO service_role;

CREATE OR REPLACE FUNCTION public.platform_read_station_profile(
 p_actor_id uuid,p_station_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
  AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 SELECT jsonb_build_object(
  'stationId',s.id,'stationName',s.name,'organizationName',o.name,
  'organizationId',o.id,'brandName',b.display_name_th,
  'brandCode',b.code,'timezone',s.timezone,'address',coalesce(s.address,''),
  'latitude',coalesce(s.latitude::text,''),'longitude',coalesce(s.longitude::text,''),
  'contactName',coalesce(p.contact_name,''),'stationPhone',coalesce(p.station_phone,''),
  'stationEmail',coalesce(p.station_email,''),'postalCode',coalesce(p.postal_code,''),
  'invoiceIssuerName',coalesce(p.invoice_issuer_name,''),
  'invoiceTaxId',coalesce(p.invoice_tax_id,''),
  'invoiceBranchCode',coalesce(p.invoice_branch_code,''),
  'invoiceAddress',coalesce(p.invoice_address,''),
  'invoicePhone',coalesce(p.invoice_phone,''),
  'invoiceEmail',coalesce(p.invoice_email,''),
  'vatRegistered',coalesce(p.vat_registered,false),
  'updatedAt',p.updated_at)
 INTO result FROM public.stations s
 JOIN public.organizations o ON o.id=s.organization_id
 LEFT JOIN public.fuel_brands b ON b.id=s.brand_id
 LEFT JOIN public.station_operational_profiles p ON p.station_id=s.id
 WHERE s.id=p_station_id;
 IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 RETURN result;
END $fn$;

CREATE OR REPLACE FUNCTION public.platform_update_station_profile(
 p_actor_id uuid,p_station_id uuid,p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_key text;v_before jsonb;v_after jsonb;v_vat boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=p_actor_id
   AND m.active AND m.scope_type='platform' AND m.role_code='platform_superadmin')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='FORBIDDEN';END IF;
 IF p_details IS NULL OR jsonb_typeof(p_details)<>'object'
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 -- Require all form keys, reject extra keys (especially organizationId/brandId/status).
 IF (SELECT count(*) FROM jsonb_object_keys(p_details))<>15
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_details) k
   WHERE k NOT IN ('stationName','address','latitude','longitude','contactName',
    'stationPhone','stationEmail','postalCode','invoiceIssuerName','invoiceTaxId',
    'invoiceBranchCode','invoiceAddress','invoicePhone','invoiceEmail','vatRegistered'))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 FOR v_key IN SELECT jsonb_object_keys(p_details) LOOP
  IF v_key='vatRegistered' THEN
   IF jsonb_typeof(p_details->v_key)<>'boolean'
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  ELSE
   IF jsonb_typeof(p_details->v_key)<>'string'
   THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
  END IF;
 END LOOP;
 IF length(btrim(p_details->>'stationName')) NOT BETWEEN 2 AND 160
  OR length(p_details->>'address')>750
  OR length(p_details->>'contactName')>120
  OR length(p_details->>'stationPhone')>30
  OR length(p_details->>'stationEmail')>254
  OR length(p_details->>'postalCode')>10
  OR length(p_details->>'invoiceIssuerName')>200
  OR length(p_details->>'invoiceAddress')>750
  OR length(p_details->>'invoicePhone')>30
  OR length(p_details->>'invoiceEmail')>254
  OR (p_details->>'invoiceTaxId' NOT IN ('') AND
   p_details->>'invoiceTaxId' !~ '^[0-9]{13}$')
  OR (p_details->>'invoiceBranchCode' NOT IN ('') AND
   p_details->>'invoiceBranchCode' !~ '^[0-9]{5}$')
  OR (p_details->>'postalCode' NOT IN ('') AND
   p_details->>'postalCode' !~ '^[0-9]{5}$')
  OR (p_details->>'stationEmail' NOT IN ('') AND
   p_details->>'stationEmail' !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
  OR (p_details->>'invoiceEmail' NOT IN ('') AND
   p_details->>'invoiceEmail' !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 IF (p_details->>'latitude' NOT IN ('') AND
      (p_details->>'latitude' !~ '^-?[0-9]{1,3}([.][0-9]{1,7})?$'
      OR (p_details->>'latitude')::numeric NOT BETWEEN -90 AND 90))
  OR (p_details->>'longitude' NOT IN ('') AND
      (p_details->>'longitude' !~ '^-?[0-9]{1,3}([.][0-9]{1,7})?$'
      OR (p_details->>'longitude')::numeric NOT BETWEEN -180 AND 180))
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 v_vat=(p_details->>'vatRegistered')::boolean;
 IF v_vat AND (p_details->>'invoiceIssuerName'=''
  OR p_details->>'invoiceTaxId'='' OR p_details->>'invoiceBranchCode'=''
  OR p_details->>'invoiceAddress'='')
 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='INVALID_REQUEST';END IF;
 PERFORM 1 FROM public.stations WHERE id=p_station_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='NOT_FOUND';END IF;
 v_before=public.platform_read_station_profile(p_actor_id,p_station_id);
 UPDATE public.stations SET
  name=btrim(p_details->>'stationName'),
  address=nullif(btrim(p_details->>'address'),''),
  latitude=nullif(p_details->>'latitude','')::numeric,
  longitude=nullif(p_details->>'longitude','')::numeric
 WHERE id=p_station_id;
 INSERT INTO public.station_operational_profiles AS existing(
  station_id,contact_name,station_phone,station_email,postal_code,
  invoice_issuer_name,invoice_tax_id,invoice_branch_code,invoice_address,
  invoice_phone,invoice_email,vat_registered,updated_by,updated_at)
 VALUES(p_station_id,nullif(btrim(p_details->>'contactName'),''),
  nullif(btrim(p_details->>'stationPhone'),''),
  nullif(btrim(p_details->>'stationEmail'),''),
  nullif(btrim(p_details->>'postalCode'),''),
  nullif(btrim(p_details->>'invoiceIssuerName'),''),
  nullif(p_details->>'invoiceTaxId',''),
  nullif(p_details->>'invoiceBranchCode',''),
  nullif(btrim(p_details->>'invoiceAddress'),''),
  nullif(btrim(p_details->>'invoicePhone'),''),
  nullif(btrim(p_details->>'invoiceEmail'),''),
  v_vat,p_actor_id,clock_timestamp())
 ON CONFLICT (station_id) DO UPDATE SET
  contact_name=excluded.contact_name,
  station_phone=excluded.station_phone,station_email=excluded.station_email,
  postal_code=excluded.postal_code,invoice_issuer_name=excluded.invoice_issuer_name,
  invoice_tax_id=excluded.invoice_tax_id,invoice_branch_code=excluded.invoice_branch_code,
  invoice_address=excluded.invoice_address,invoice_phone=excluded.invoice_phone,
  invoice_email=excluded.invoice_email,vat_registered=excluded.vat_registered,
  updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 v_after=public.platform_read_station_profile(p_actor_id,p_station_id);
 INSERT INTO public.audit_events(actor_id,station_id,organization_id,
  entity_type,entity_id,action,before_state,after_state)
 SELECT p_actor_id,s.id,s.organization_id,
  'station_profile',s.id::text,'station_profile_updated',
  jsonb_build_object('stationName',v_before->>'stationName',
   'hasInvoiceTaxId',(v_before->>'invoiceTaxId')<>''), 
  jsonb_build_object('stationName',v_after->>'stationName',
   'hasInvoiceTaxId',(v_after->>'invoiceTaxId')<>'')
 FROM public.stations s WHERE s.id=p_station_id;
 RETURN v_after;
END $fn$;

REVOKE ALL ON FUNCTION public.platform_read_station_profile(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.platform_update_station_profile(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_read_station_profile(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_update_station_profile(uuid,uuid,jsonb) TO service_role;
