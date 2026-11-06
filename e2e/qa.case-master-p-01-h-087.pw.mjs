import {masterCase,qaLogin,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='P-01-H';
masterCase({id:MASTER_UAT_ID,description:'authorized-QA-home-and-role-dock',alias:'sales01',role:'platform_sales',scopeType:'platform',
 check:async({page,auth,headers,expect,BASE})=>{
// QA-password logins prove role-scoped Home; actual Google OAuth callback still pending.
const assertMenu=async(p,expected,forbidden)=>{
 await expect(p.locator('[data-ws-screen="overview"]:visible')).toBeVisible();
 const home=p.locator('[data-ws-screen="overview"]');
 for(const key of expected)await expect(home.locator('[data-ws-go="'+key+'"]:visible').first()).toBeVisible();
 for(const key of forbidden)expect(await p.locator('[data-ws-go="'+key+'"]').count()).toBe(0);
 await expect(p.locator('.os-mobile-dock-inner')).toHaveCount(1);
 const slots=await p.locator('.os-mobile-dock-inner').locator(':scope > *').count();expect(slots).toBe(5);
};
await assertMenu(page,['sales','stations','activity'],['customers','hr','payroll','corporate']);
const browser=page.context().browser();expect(browser).toBeTruthy();
for(const spec of [
 {alias:'sales02',role:'platform_sales',scope:'platform',id:null,visible:['sales','stations'],blocked:['customers','payroll','corporate']},
 {alias:'s02b-owner',role:'station_owner',scope:'station',id:STATION_S02B,visible:['customers','plan','fuel'],blocked:['sales','stations','activity','corporate']}
]){
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 try{const p=await ctx.newPage();await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await qaLogin(p,spec.alias,spec.role,spec.scope,spec.id);
 await assertMenu(p,spec.visible,spec.blocked);
 }finally{await ctx.close();}
}
console.log('MASTER_CASE P-01-H THREE_QA_ROLE_SCOPED_HOME_AND_FIVE_SLOT_DOCK_PASS; OAuth/admin/support pending separate');
}});
