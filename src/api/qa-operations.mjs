import {qaFinanceEnabled,createQaTopupSimulationApi} from './qa-topup-simulation.mjs';
import {qaScopeAllowlist} from './qa-accounts.mjs';
import {createApi} from './router.mjs';
import {createFuelReviewApi} from './fuel-review.mjs';
import {createFuelPhotoApi} from './fuel-photo.mjs';
import {createFuelStartApi} from './fuel-start.mjs';
import {createPlateReviewInboxApi} from './plate-review-inbox.mjs';
import {createPlateVerificationApi} from './plate-verification.mjs';
import {createEvidenceApi} from './evidence.mjs';
import {createWalletIntegrityApi} from './wallet-integrity.mjs';

const json=(status,error)=>new Response(JSON.stringify({error}),{
 status,headers:{'content-type':'application/json','cache-control':'no-store'},
});
export function createQaOperationsApi({env,authenticate,db}){
 return async request=>{
  if(!qaFinanceEnabled(env))return json(404,'not_found');
  const path=new URL(request.url).pathname;
  const corp=path==='/api/my-accounts'||path==='/api/coupons'||
    /^\/api\/my-accounts\/[a-f0-9-]{36}\/fuels$/i.test(path)||
    path==='/api/corporate/wallet-integrity';
  const station=path==='/api/station/scan-qr'||
    ['/api/evidence/plate','/api/evidence/plate/reviews',
     '/api/evidence/plate/photo','/api/evidence/plate/status',
     '/api/evidence/plate/review','/api/fuel/start',
     '/api/evidence/fuel','/api/evidence/fuel/reviews',
     '/api/evidence/fuel/photo','/api/evidence/fuel/review',
     '/api/fuel/finish'].includes(path);
  if(!corp&&!station)return json(404,'not_found');
  const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  if(!token)return json(401,'unauthenticated');
  try{
   const actor=await authenticate(token[1]);
   if(actor?.isQa!==true)return json(403,'qa_actor_only');
   const allow=qaScopeAllowlist(env);
   if(allow.station.length!==4||allow.corporate_company.length!==12||
      new Set(allow.station).size!==4||new Set(allow.corporate_company).size!==12)
    return json(503,'qa_scope_unavailable');
   const memberships=(await db.memberships(actor.id)||[]).filter(m=>m.active===true);
   if(corp&&!memberships.some(m=>m.scope_type==='corporate_company'&&
        allow.corporate_company.includes(m.corporate_company_id)))
    return json(403,'qa_corporate_only');
   if(station&&!memberships.some(m=>m.scope_type==='station'&&
        allow.station.includes(m.station_id)))
    return json(403,'qa_station_only');
   const deps={authenticate,db};
   if(path==='/api/evidence/plate')return createEvidenceApi(deps)(request);
   if(['/api/evidence/plate/reviews','/api/evidence/plate/photo'].includes(path))
    return createPlateReviewInboxApi(deps)(request);
   if(['/api/evidence/plate/review','/api/evidence/plate/status'].includes(path))
    return createPlateVerificationApi(deps)(request);
   if(path==='/api/evidence/fuel')return createFuelPhotoApi(deps)(request);
   if(['/api/evidence/fuel/reviews','/api/evidence/fuel/photo',
       '/api/evidence/fuel/review','/api/fuel/finish'].includes(path))
    return createFuelReviewApi(deps)(request);
   if(path==='/api/fuel/start')return createFuelStartApi(deps)(request);
   if(path==='/api/corporate/wallet-integrity')
    return createWalletIntegrityApi(deps)(request);
   return createApi(deps)(request);
  }catch{return json(503,'qa_operations_unavailable');}
 };
}
