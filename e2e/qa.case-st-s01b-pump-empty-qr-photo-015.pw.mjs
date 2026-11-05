import {test,expect} from '@playwright/test';
// 015: one existing QA station cashier, pump scanner empty-input validation and photo-only fields.
// No QR inspection, fueling, credit reservation, camera access, file upload or API write.
const BASE='https://oilstation.goldensoft.cloud';
const CASE='OS-QA-ST-PUMP-EMPTY-QR-AND-PHOTO-FIELDS-015';
const STATION='76388e2c-ef36-4656-808b-7d0fbd1d2c35';
test.use({headless:true,viewport:{width:390,height:844},screenshot:'off',trace:'off',video:'off'});
test.beforeEach(()=>{
 test.skip(process.env.OILSTATION_QA_SINGLE_CASE_RUN!=='true','Protected serial one-case workflow only');
 if(!process.env.OILSTATION_QA_REVIEW_PASSWORD)throw Error('Missing protected QA Secret');
});
test(CASE+': cashier scanner refuses blank QR and photo evidence is required @qa-one-case',async({page})=>{
 test.setTimeout(105000);
 const writes=[],errors=[];
 page.on('pageerror',()=>errors.push('javascript_exception'));
 page.on('request',request=>{
  try{const u=new URL(request.url());
   if(u.origin===BASE&&u.pathname.startsWith('/api/')&&
      !['GET','HEAD','OPTIONS'].includes(request.method()))writes.push([u.pathname,request.method()]);
  }catch{}
 });
 expect((await page.goto(BASE,{waitUntil:'domcontentloaded'}))?.status()).toBe(200);
 await expect(page.locator('#qa-login-form')).toBeVisible({timeout:25000});
 await page.locator('#qa-login-alias').fill('s01b-cashier');
 await page.locator('#qa-login-password').fill(process.env.OILSTATION_QA_REVIEW_PASSWORD);
 await page.locator('#qa-login-form button[type="submit"]').click();
 await expect(page.locator('[data-ws-screen="overview"]:visible')).toBeVisible({timeout:30000});
 const token=await page.evaluate(()=>{
  for(const k of Object.keys(localStorage)){
   if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
   try{const t=JSON.parse(localStorage.getItem(k));if(t?.access_token)return t.access_token;}catch{}
  }return null;
 });
 expect(token).toBeTruthy();
 const who=await page.request.get(BASE+'/api/me',{headers:{authorization:'Bearer '+token}});
 expect(who.status()).toBe(200);
 const scopes=(await who.json()).memberships;
 expect(scopes).toHaveLength(1);
 expect(scopes[0].role).toBe('cashier');
 expect(scopes[0].stationId).toBe(STATION);
 console.log('QA_CASE '+CASE+' AUTH_PASS: only s01b cashier');

 const tile=page.locator('[data-ws-screen="overview"] [data-ws-go="pump"]:visible').first();
 await expect(tile).toBeVisible({timeout:14000});
 await tile.click();
 const panel=page.locator('#station-pump-workspace');
 const form=panel.locator('#scan-form');
 await expect(form).toBeVisible({timeout:15000});
 const qr=form.locator('#scan-payload');
 await expect(qr).toBeVisible();
 await expect(qr).toHaveAttribute('required','');
 await expect(panel.locator('#start-camera')).toBeVisible();
 await expect(panel.locator('#coupon-inspection')).toBeHidden();
 console.log('QA_CASE '+CASE+' SCANNER_PASS: QR required and camera control available');

 await expect(qr).toHaveValue('');
 await form.locator('button[type="submit"]').click();
 expect(await qr.evaluate(el=>el.validity.valueMissing),'native blank-QR validation').toBe(true);
 await expect(panel.locator('#coupon-inspection')).toBeHidden();
 expect(writes,'blank QR must not initiate inspection/fueling').toEqual([]);
 console.log('QA_CASE '+CASE+' REQUIRED_PASS: empty QR rejected before network');

 const plate=panel.locator('#pump-plate-photo');
 const meter=panel.locator('#pump-meter-file');
 const receipt=panel.locator('#fuel-receipt-file');
 for(const file of [plate,meter,receipt]){
  await expect(file).toHaveAttribute('type','file');
  await expect(file).toHaveAttribute('required','');
  await expect(file).toHaveAttribute('accept','image/jpeg,image/png');
 }
 await expect(plate).toHaveAttribute('capture','environment');
 await expect(meter).toHaveAttribute('capture','environment');
 await expect(receipt).toHaveAttribute('capture','environment');
 await expect(panel.locator('#coupon-inspection')).toBeHidden();
 expect(writes).toEqual([]);
 expect(errors).toEqual([]);
 console.log('QA_CASE '+CASE+' PHOTO_ONLY_FIELDS_PASS: plate, meter, receipt mandatory JPEG/PNG camera files');
 console.log('QA_CASE '+CASE+' RESULT: AUTH_PASS + SCANNER_PASS + REQUIRED_PASS + PHOTO_ONLY_FIELDS_PASS + NO_WRITES');
});
