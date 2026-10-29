/** Pump/receipt private supervisor review and DB-attested settlement. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private,no-store',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
}});
const GROSS=/^[1-9][0-9]{0,11}$/;
const LITERS=/^[0-9]{1,7}(?:\.[0-9]{1,3})?$/;
export function createFuelReviewApi({authenticate,db}){
 return async request=>{
  const url=new URL(request.url);
  const list=url.pathname==='/api/evidence/fuel/reviews';
  const photo=url.pathname==='/api/evidence/fuel/photo';
  const review=url.pathname==='/api/evidence/fuel/review';
  const finish=url.pathname==='/api/fuel/finish';
  if(!list&&!photo&&!review&&!finish)return json(404,{error:'not_found'});
  if(request.method!==(list||photo?'GET':'POST'))return json(405,{error:'method_not_allowed'});
  if((review||finish)&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return json(403,{error:'origin_forbidden'});
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,{error:'unauthenticated'});
  if((review||finish)&&!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
   return json(415,{error:'unsupported_media_type'});
  let body=null;
  if(review||finish){
   if(Number(request.headers.get('content-length'))>2048)return json(413,{error:'body_too_large'});
   const text=await request.text();
   if(text.length>2048)return json(413,{error:'body_too_large'});
   try{body=JSON.parse(text);}catch{return json(400,{error:'invalid_json'});}
   if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'invalid_json'});
   const keys=Object.keys(body);
   if(review){
    if(!UUID.test(body.evidenceId??'')||typeof body.approved!=='boolean'
      ||keys.some(k=>!['evidenceId','approved','liters','grossSatang'].includes(k))
      ||(body.approved&&(!GROSS.test(body.grossSatang??'')
        ||(body.liters!=null&&!LITERS.test(body.liters)))))
      return json(400,{error:'invalid_evidence_review'});
   }else if(keys.length!==3||!UUID.test(body.sessionId??'')||
     !UUID.test(body.pumpEvidenceId??'')||!UUID.test(body.receiptEvidenceId??'')||
     body.pumpEvidenceId===body.receiptEvidenceId)
     return json(400,{error:'invalid_fuel_finish'});
  }
  const id=url.searchParams.get(list?'stationId':'evidenceId');
  if((list||photo)&&!UUID.test(id??''))return json(400,{error:'invalid_identifier'});
  try{
   const actor=await authenticate(token[1]);
   if(!actor?.id||!UUID.test(actor.id))return json(401,{error:'unauthenticated'});
   if(list)return json(200,{reviews:await db.fuelReviewInbox({actorId:actor.id,stationId:id})});
   if(photo){
    const access=await db.fuelReviewPhotoAccess({actorId:actor.id,evidenceId:id});
    const image=await db.readFuelPhoto(access.path);
    return new Response(image.bytes,{status:200,headers:{
     'content-type':image.contentType==='image/png'?'image/png':'image/jpeg',
     'content-disposition':'inline','cache-control':'private, no-store',
     'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
     'content-security-policy':"default-src 'none'; sandbox",
    }});
   }
   if(review)return json(200,{result:await db.reviewFuelPhoto({
     actorId:actor.id,evidenceId:body.evidenceId,approved:body.approved,
     liters:body.approved?body.liters??null:null,
     grossSatang:body.approved?body.grossSatang:null,
   })});
   return json(200,{session:await db.finishReviewedFueling({
     actorId:actor.id,sessionId:body.sessionId,pumpEvidenceId:body.pumpEvidenceId,
     receiptEvidenceId:body.receiptEvidenceId,
   })});
  }catch(e){
   if(e?.code==='FORBIDDEN')return json(403,{error:'permission_denied'});
   if(e?.code==='INVALID_REQUEST'||e?.code==='PUMP_AMOUNT_MISMATCH'||
      e?.code==='COUPON_LIMIT_EXCEEDED')return json(409,{error:'evidence_or_amount_not_approved'});
   return json(503,{error:'fuel_review_unavailable'});
  }
 };
}
