import {test,expect} from '@playwright/test';
import {BASE,STATION_A,STATION_B,qaLogin} from '../scripts/qa/master-six-harness.mjs';

// PKG-CHG-01: first *read-only* acceptance for current subscription.
// This does NOT prove positive plan replacement or future activation.
test('PKG-CHG-01 owner sees actual term; foreign owner denied; legacy switch remains closed @qa-saas-term',async({browser})=>{
 test.setTimeout(110000);
 test.skip(!process.env.OILSTATION_QA_REVIEW_PASSWORD,'protected reviewer secret missing');
 const a=await browser.newContext(),b=await browser.newContext();
 try{
  const p=await a.newPage();
  await p.goto(BASE,{waitUntil:'domcontentloaded'});
  const owner=await qaLogin(p,'s01a-owner','station_owner','station',STATION_A);
  const api=await p.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers:owner.headers});
  expect(api.status()).toBe(200);
  const result=(await api.json()).result;
  expect(result.stationName).toBe('QA-S01-A');
  const term=result.subscription;
  expect(term.status).toBe('trialing');
  expect(term.planId).toBe('5237ae67-317f-450f-b174-1a3ea1890684');
  expect(term.frequency).toBe('monthly');
  expect(Date.parse(term.startsAt)).toBe(Date.parse('2026-11-01T00:00:00Z'));
  expect(Date.parse(term.periodEnd)).toBe(Date.parse('2026-12-01T00:00:00Z'));
  expect(result.plans.some(x=>x.id===term.planId)).toBe(true);
  const legacy=await p.request.post(BASE+'/api/station/billing/select',{
   headers:{...owner.headers,origin:BASE,'content-type':'application/json'},
   data:{stationId:STATION_A,planId:term.planId,paymentMethod:'card',startsAt:'2026-12-01T00:00:00Z'}});
  expect(legacy.status()).toBe(400);
  expect(await legacy.json()).toEqual({error:'invalid_plan_selection'});
  await p.locator('[data-ws-screen="overview"] [data-ws-go="plan"]:visible').first().click();
  const panel=p.locator('#station-saas-plan-workspace');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.owner-plan-current-term')).toContainText('แพ็กเกจปัจจุบัน',{timeout:25000});
  await expect(panel.locator('.owner-plan-current-term')).toContainText('Standard รายเดือน');
  await expect(panel.locator('.owner-plan-current-term')).toContainText('2569');
  await expect(panel.getByRole('button',{name:'ยืนยันแพ็กเกจและวิธีชำระเงิน'})).toBeDisabled();
  await expect(panel.locator('[role="status"]')).toContainText('การเปลี่ยนแพ็กเกจต้องกำหนดวันเริ่มใหม่');
  const other=await b.newPage();
  await other.goto(BASE,{waitUntil:'domcontentloaded'});
  const foreign=await qaLogin(other,'s01b-owner','station_owner','station',STATION_B);
  const blocked=await other.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers:foreign.headers});
  expect(blocked.status()).toBe(403);
  expect(await blocked.json()).toEqual({error:'permission_denied'});
  const unchanged=await p.request.get(BASE+'/api/station/billing/options?stationId='+STATION_A,{headers:owner.headers});
  expect(unchanged.status()).toBe(200);
  expect((await unchanged.json()).result.subscription).toEqual(term);
  console.log('PKG_CHG_01_ACTUAL_SUBSCRIPTION_TERM_UI_AND_FOREIGN_ROLE_DENIAL_PASS + ZERO_ACCEPTED_WRITES');
 }finally{await Promise.all([a.close(),b.close()]);}
});
