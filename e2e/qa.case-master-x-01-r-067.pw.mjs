import {masterCase,STATION_B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN enforced by shared protected browser helper.
const MASTER_UAT_ID='X-01-R';
masterCase({id:MASTER_UAT_ID,description:'browser-has-no-privileged-service-key',alias:'s01b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_B,
 check:async({page,auth,headers,expect,BASE})=>{
const result=await page.request.get(BASE+'/api/public-config');expect(result.status()).toBe(200);
const config=await result.json();
expect(Object.keys(config).sort()).toEqual(['qaFinanceSimEnabled','qaModeEnabled','stripePublishableKey','supabaseAnonKey','supabaseUrl']);
expect(config.supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
expect(typeof config.supabaseAnonKey).toBe('string');
expect(config.stripePublishableKey).toBeNull();
expect(config.qaFinanceSimEnabled).toBe(false);
const raw=JSON.stringify(config);
expect(raw).not.toMatch(/sb_secret_|service_role|SERVICE_ROLE|COUPON_SIGNING_KEY|STRIPE_SECRET_KEY|stripeSecretKey/);
const unsafeStorage=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/service.role|service[_-]?key|secret[_-]?key/i.test(k)));
expect(unsafeStorage).toEqual([]);
console.log('MASTER_CASE X-01-R NO_BROWSER_PRIVILEGED_SERVICE_KEY_PASS');
}});
