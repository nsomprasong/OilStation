import {test,expect} from '@playwright/test';
import {BASE,STATION_A,qaLogin} from '../scripts/qa/master-six-harness.mjs';

const PHOTO='06533350-9254-4613-b272-7fcb00bc0656';
const authReq=(page,path,headers)=>page.request.get(BASE+path,{headers});

// FAILED_ONLY_RETRY_S06R: QA finance-off POST is 503 release_not_enabled, not a 404.
test('S-06-R fresh QA owner A can read photo while foreign station B cannot see private bytes @qa-photo-readonly',async({browser})=>{
 test.setTimeout(110000);
 test.skip(!process.env.OILSTATION_QA_REVIEW_PASSWORD,'Protected station owner QA secret required');
 const aCtx=await browser.newContext(),bCtx=await browser.newContext(),cCtx=await browser.newContext();
 try{
  const own=await aCtx.newPage();
  await own.goto(BASE,{waitUntil:'domcontentloaded'});
  const a=await qaLogin(own,'s01a-owner','station_owner','station',STATION_A);
  const ownStatus=await authReq(own,'/api/evidence/plate/status?photoId='+PHOTO,a.headers);
  expect(ownStatus.status()).toBe(200);
  const body=(await ownStatus.json()).result;
  expect(body.photoId).toBe(PHOTO);
  expect(body.status).toBe('verified_supervisor');
  expect(body.verified).toBe(true);
  const ownPhoto=await authReq(own,'/api/evidence/plate/photo?photoId='+PHOTO,a.headers);
  expect(ownPhoto.status()).toBe(200);
  expect(ownPhoto.headers()['cache-control']).toContain('no-store');
  expect(ownPhoto.headers()['content-security-policy']).toContain('sandbox');
  expect((await ownPhoto.body()).length).toBeGreaterThan(64);
  const reviews=await authReq(own,'/api/evidence/plate/reviews?stationId='+STATION_A,a.headers);
  expect(reviews.status()).toBe(200);
  expect(Array.isArray((await reviews.json()).reviews)).toBe(true);
  const uploadWrite=await own.request.post(BASE+'/api/evidence/plate/review',{
   headers:{...a.headers,origin:BASE,'content-type':'application/json'},
   data:{photoId:PHOTO,approved:false}
  });
  expect(uploadWrite.status()).toBe(503);
  expect(await uploadWrite.json()).toEqual({error:'release_not_enabled'});
  const foreign=await bCtx.newPage();
  await foreign.goto(BASE,{waitUntil:'domcontentloaded'});
  const b=await qaLogin(foreign,'s01b-owner','station_owner','station','76388e2c-ef36-4656-808b-7d0fbd1d2c35');
  for(const url of [
   '/api/evidence/plate/status?photoId='+PHOTO,
   '/api/evidence/plate/photo?photoId='+PHOTO,
   '/api/evidence/plate/reviews?stationId='+STATION_A
  ]){
   const denied=await authReq(foreign,url,b.headers);
   expect(denied.status(),url).toBe(403);
   expect(await denied.json()).toEqual({error:'permission_denied'});
  }
  const corporate=await cCtx.newPage();
  await corporate.goto(BASE,{waitUntil:'domcontentloaded'});
  const c=await qaLogin(corporate,'c01-admin','corporate_admin','corporate_company',
   '4e6a3fc9-217d-4543-885b-113f1f3ba4c3');
  const noStation=await authReq(corporate,'/api/evidence/plate/photo?photoId='+PHOTO,c.headers);
  expect(noStation.status()).toBe(403);
  expect(await noStation.json()).toEqual({error:'qa_station_only'});
  console.log('MASTER_CASE S-06-R AUTHORIZED_PRIVATE_PLATE_READ_AND_FOREIGN_STATION_403_PASS + ZERO_ACCEPTED_WRITES');
 }finally{await Promise.all([aCtx.close(),bCtx.close(),cCtx.close()]);}
});
