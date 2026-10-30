-- Restrict direct legacy bank topup settlement; the reviewed SECURITY DEFINER
-- wrapper still invokes the inner function as its owner. No Worker bypass.
REVOKE ALL ON FUNCTION public.review_corporate_topup(
 uuid,uuid,boolean,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
