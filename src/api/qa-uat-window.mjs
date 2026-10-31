// Temporary QA-only release window. A cancelled runner cannot leave synthetic
// money or HR APIs active beyond the short per-run expiry.
export function qaUatWindowOpen(env,nowSeconds=Math.floor(Date.now()/1000)){
 if(env?.OILSTATION_QA_BUSINESS_UAT_TEMP!=='true')return true;
 const end=Number(env?.OILSTATION_QA_UAT_EXPIRES_EPOCH);
 return Number.isSafeInteger(end) && end>nowSeconds && end<=nowSeconds+3600;
}
