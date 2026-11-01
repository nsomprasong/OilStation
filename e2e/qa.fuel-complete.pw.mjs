import {test,expect} from '@playwright/test';
import {createHmac,createHash} from 'node:crypto';

// ONE irreversible fictional 50 THB reservation in QA-S01-A only.
// These visibly marked photos do NOT document actual petrol or bank payment.
const BASE='https://oilstation.goldensoft.cloud';
const STATION='e22fb5ff-1878-446f-ab8d-585115e8a1a9';
const COUPON='bee58d32-9444-4514-8a7f-5ee6cd9e2d5c';
const COMPANY='4e6a3fc9-217d-4543-885b-113f1f3ba4c3';
const PLATE='QA 1001';
const MAX=5000n;
function pwd(alias){
 const secret=process.env.OILSTATION_QA_SALES01_PASSWORD;
 if(!secret)throw Error('Missing fixed QA account secret');
 const owner=createHmac('sha256',secret)
  .update('OilStation QA station role account 20261031/v1/s01a-owner')
  .digest('base64url').slice(0,30)+'a9!';
 if(alias==='s01a-owner')return owner;
 if(alias.startsWith('s01a-')){
  return createHmac('sha256',secret)
   .update('OilStation QA station role account 20261031/v1/'+alias)
   .digest('base64url').slice(0,30)+'a9!';
 }
 return createHmac('sha256',owner)
  .update('OilStation QA corporate staff created by own Admin 20261031/v1/'+alias)
  .digest('base64url').slice(0,30)+'a9!';
}
async function signIn(page,alias,screen){
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#qa-login-form')).toBeVisible();
 await page.locator('#qa-login-alias').fill(alias);
 await page.locator('#qa-login-password').fill(pwd(alias));
 await page.locator('#qa-login-form button[type=submit]').click();
 await expect(page.locator('[data-ws-go="'+screen+'"]:visible').first())
   .toBeVisible({timeout:35000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{return JSON.parse(localStorage.getItem(k))?.access_token||null;}catch{}
  }
  return null;
 });
 expect(token).toBeTruthy();
 return token;
}
const headers=(token,method='GET',contentType='application/json')=>({
 authorization:'Bearer '+token,
 ...(method==='POST'?{origin:BASE,'content-type':contentType}:{}),
});
async function get(page,token,path){
 return page.request.get(BASE+path,{headers:headers(token)});
}
async function post(page,token,path,data){
 return page.request.post(BASE+path,{headers:headers(token,'POST'),data});
}
async function payload(page,label,detail){
 // Canvas is created only in a fictional QA browser context; not a receipt forgery.
 const encoded=await page.evaluate(({label,detail})=>{
  const canvas=document.createElement('canvas');
  canvas.width=960;canvas.height=540;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#141c4e';ctx.fillRect(0,0,960,540);
  ctx.fillStyle='#ffda73';ctx.font='bold 60px sans-serif';
  ctx.fillText('QA SIMULATION ONLY',48,106);
  ctx.font='bold 52px sans-serif';ctx.fillText(label,48,226);
  ctx.fillStyle='#fff';ctx.font='40px sans-serif';ctx.fillText(detail,48,315);
  ctx.font='28px sans-serif';
  ctx.fillText('FICTIONAL TEST IMAGE - NO REAL FUEL DELIVERY',48,400);
  ctx.strokeStyle='#ffda73';ctx.lineWidth=7;ctx.strokeRect(20,20,920,500);
  return canvas.toDataURL('image/png').split(',')[1];
 },{label,detail});
 return Buffer.from(encoded,'base64');
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function upload(page,token,path,bytes){
 return page.request.post(BASE+path,{
  headers:headers(token,'POST','image/png'),data:bytes,
 });
}
async function identicalPrivatePhoto(page,token,url,bytes){
 const res=await get(page,token,url);
 expect(res.status(),'reviewer must read original private test image').toBe(200);
 expect(res.headers()['cache-control']).toMatch(/no-store/);
 expect(res.headers()['content-type']).toBe('image/png');
 expect(sha(Buffer.from(await res.body()))).toBe(sha(bytes));
}
test.use({headless:true,trace:'off',screenshot:'off',video:'off'});
test('QA-FUEL-01 complete photo-reviewed synthetic 50 THB QR exactly once @qa-fuel-complete',
 async({browser,request})=>{
 test.skip(process.env.OILSTATION_QA_FUEL_COMPLETE_RUN!=='true',
  'Only main-branch, time-limited approved QA finance lane can write synthetic ledger.');
 test.setTimeout(11*60*1000);
 const cfg=await request.get(BASE+'/api/public-config');
 expect(cfg.status()).toBe(200);
 const env=(await cfg.json());
 expect(env.qaModeEnabled).toBe(true);
 expect(env.qaFinanceSimEnabled).toBe(true);
 const attendant=await browser.newPage();
 const owner=await browser.newPage();
 const driver=await browser.newPage();
 const corporate=await browser.newPage();
 try{
  const [at,ot,dt,ct]=await Promise.all([
   signIn(attendant,'s01a-attendant','pump'),
   signIn(owner,'s01a-owner','pump'),
   signIn(driver,'c01-driver','driver'),
   signIn(corporate,'c01-admin','corporate'),
  ]);
  const walletBefore=await get(corporate,ct,'/api/my-accounts');
  expect(walletBefore.status()).toBe(200);
  const account=(await walletBefore.json()).accounts.find(a=>
    a.companyId===COMPANY && a.stationName==='QA-S01-A');
  expect(account,'preexisting fictional station/company wallet').toBeTruthy();
  const before=BigInt(account.availableSatang);

  const qrInbox=await get(driver,dt,'/api/driver/coupons');
  expect(qrInbox.status()).toBe(200);
  const assigned=(await qrInbox.json()).coupons.find(c=>
   typeof c.qrPayload==='string'&&c.qrPayload.startsWith(COUPON+'.'));
  expect(assigned,'existing non-expired QA driver QR; never create new coupon').toBeTruthy();
  expect(assigned.plate||PLATE).toMatch(/QA.?1001/i);

  const scan=await post(attendant,at,'/api/station/scan-qr',
   {qrPayload:assigned.qrPayload});
  expect(scan.status(),'authorized station should inspect fixed fictional QR').toBe(200);

  // A test driver and employees at foreign stations cannot upload plate evidence.
  const plateBytes=await payload(attendant,'TEST VEHICLE PLATE','QA 1001');
  const platePath='/api/evidence/plate?'+
   new URLSearchParams({stationId:STATION,couponId:COUPON});
  const unauthorized=await upload(driver,dt,platePath,plateBytes);
  expect(unauthorized.status()).toBe(403);

  const plate=await upload(attendant,at,platePath,plateBytes);
  expect(plate.status(),await plate.text()).toBe(201);
  const photoId=(await plate.json()).evidence.photoId;
  expect(photoId).toBeTruthy();

  const pending=await get(owner,ot,
    '/api/evidence/plate/reviews?stationId='+STATION);
  expect(pending.status()).toBe(200);
  expect((await pending.json()).reviews.some(v=>v.photoId===photoId)).toBe(true);
  const asUploader=await post(attendant,at,'/api/evidence/plate/review',
    {photoId,observedPlate:PLATE,approved:true});
  expect(asUploader.status(),'uploader must not self-approve').toBe(403);
  await identicalPrivatePhoto(owner,ot,
   '/api/evidence/plate/photo?photoId='+photoId,plateBytes);
  const mismatch=await post(owner,ot,'/api/evidence/plate/review',
    {photoId,observedPlate:'QA 9999',approved:true});
  expect(mismatch.status(),'wrong plate must block without changing decision').toBe(409);
  const plateOK=await post(owner,ot,'/api/evidence/plate/review',
    {photoId,observedPlate:PLATE,approved:true});
  expect(plateOK.status()).toBe(200);
  expect((await plateOK.json()).result.status).toBe('verified_supervisor');

  const start=await post(attendant,at,'/api/fuel/start',{photoId});
  expect(start.status(),await start.text()).toBe(200);
  const session=(await start.json()).session;
  expect(session.status).toBe('fueling');
  expect(session.replayed).toBe(false);
  const lockedPublic=Number(session.public_price);
  const lockedNet=Number(session.corporate_price);
  expect(Number.isFinite(lockedPublic)&&lockedPublic>0).toBe(true);
  expect(Number.isFinite(lockedNet)&&lockedNet>0).toBe(true);
  const liters='1.000';
  const grossSatang=String(Math.round(lockedPublic*100));
  const netExpected=BigInt(Math.round(lockedNet*100));
  expect(BigInt(grossSatang)).toBeLessThanOrEqual(MAX);
  expect(netExpected).toBeLessThanOrEqual(MAX);
  const startedAgain=await post(attendant,at,'/api/fuel/start',{photoId});
  expect(startedAgain.status()).toBe(200);
  const replayed=(await startedAgain.json()).session;
  expect(replayed.replayed).toBe(true);
  expect(replayed.id).toBe(session.id);

  // Pump and receipt carry transparent fictional markers and the same test gross.
  const pumpBytes=await payload(attendant,'TEST PUMP DISPLAY',
    '1.000 L  |  THB '+(Number(grossSatang)/100).toFixed(2));
  const receiptBytes=await payload(attendant,'TEST RECEIPT - NOT REAL',
    'THB '+(Number(grossSatang)/100).toFixed(2));
  const url='/api/evidence/fuel?'+new URLSearchParams({sessionId:session.id});
  const pump=await upload(attendant,at,url+'&kind=pump_display',pumpBytes);
  expect(pump.status(),await pump.text()).toBe(201);
  const pumpId=(await pump.json()).evidence.evidenceId;
  const receipt=await upload(attendant,at,url+'&kind=receipt',receiptBytes);
  expect(receipt.status(),await receipt.text()).toBe(201);
  const receiptId=(await receipt.json()).evidence.evidenceId;

  const early=await post(owner,ot,'/api/fuel/finish',
   {sessionId:session.id,pumpEvidenceId:pumpId,receiptEvidenceId:receiptId});
  expect(early.status(),'unreviewed photo must never settle wallet').toBe(409);

  const queue=await get(owner,ot,
   '/api/evidence/fuel/reviews?stationId='+STATION);
  expect(queue.status()).toBe(200);
  const waiting=(await queue.json()).reviews;
  expect(waiting.some(v=>v.evidenceId===pumpId)).toBe(true);
  expect(waiting.some(v=>v.evidenceId===receiptId)).toBe(true);
  const selfReview=await post(attendant,at,'/api/evidence/fuel/review',
   {evidenceId:pumpId,approved:true,liters,grossSatang});
  expect(selfReview.status(),'photo uploader may not review own photo').toBe(403);
  await identicalPrivatePhoto(owner,ot,
   '/api/evidence/fuel/photo?evidenceId='+pumpId,pumpBytes);
  await identicalPrivatePhoto(owner,ot,
   '/api/evidence/fuel/photo?evidenceId='+receiptId,receiptBytes);

  const reviewPump=await post(owner,ot,'/api/evidence/fuel/review',
   {evidenceId:pumpId,approved:true,liters,grossSatang});
  expect(reviewPump.status(),await reviewPump.text()).toBe(200);
  const reviewReceipt=await post(owner,ot,'/api/evidence/fuel/review',
   {evidenceId:receiptId,approved:true,grossSatang});
  expect(reviewReceipt.status(),await reviewReceipt.text()).toBe(200);
  const finishBody={sessionId:session.id,pumpEvidenceId:pumpId,receiptEvidenceId:receiptId};
  const finish=await post(owner,ot,'/api/fuel/finish',finishBody);
  expect(finish.status(),await finish.text()).toBe(200);
  const settled=(await finish.json()).session;
  expect(settled.status).toBe('completed');
  expect(BigInt(settled.net_amount_satang)).toBe(netExpected);
  const repeat=await post(owner,ot,'/api/fuel/finish',finishBody);
  expect(repeat.status()).toBe(200);
  expect((await repeat.json()).session.replayed).toBe(true);
  const afterRes=await get(corporate,ct,'/api/my-accounts');
  expect(afterRes.status()).toBe(200);
  const after=(await afterRes.json()).accounts.find(a=>a.id===account.id);
  expect(after).toBeTruthy();
  expect(BigInt(after.availableSatang)).toBe(before+MAX-netExpected);
  console.log('QA-FUEL PASS: fictional plate/photo data, independent QA actor review, locked '+lockedPublic+' pump price, 1.000L, 50THB hold settled once, no real fueling/payment.');
 }finally{
  await Promise.all([attendant.close(),owner.close(),driver.close(),corporate.close()]);
 }
});