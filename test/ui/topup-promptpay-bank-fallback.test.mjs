import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../../src/api/station-topup-bank.mjs',import.meta.url),'utf8');
const migration=readFileSync(new URL('../../supabase/migrations/20261106191000_station_topup_fixed_amounts.sql',import.meta.url),'utf8');
test('corporate topup amount is select-only; no free text input',()=>{
 assert.match(ui,/<select id="topup-amount" required><\/select>/);
 assert.doesNotMatch(ui,/<input id="topup-amount"/);
 assert.match(ui,/\/api\/topup\/amount-options/);
 assert.match(ui,/\/api\/topup\/payment-instructions/);
});
test('PromptPay QR is rendered from server payload, bank-only station shows true bank name and account',()=>{
 assert.match(ui,/QRCode\.toCanvas\(canvas,p\.qrPayload/);
 assert.match(ui,/p\.method==='promptpay'/);
 assert.match(ui,/p\.method==='bank_transfer'/);
 assert.match(ui,/p\.accountNumber/);
 assert.match(ui,/promptpayBanks\.length\?promptpayBanks:res\.data\.banks/);
});
test('station settings allow PromptPay phone or national ID and bank fallback',()=>{
 assert.match(ui,/\['promptpay','พร้อมเพย์/);
 assert.match(ui,/\['bank','บัญชีธนาคารจริง/);
 assert.match(ui,/station\/topup\/amount-options/);
 assert.match(api,/normalizePromptPay/);
 assert.match(api,/buildPromptPayPayload/);
 assert.match(api,/promptpay_qr_only/);
});
test('server enforces selected amount for both quote and topup request insertion',()=>{
 assert.match(api,/await db\.canUploadTopup\(/);
 assert.match(migration,/authorize_corporate_topup_preset_upload/);
 assert.match(migration,/BEFORE INSERT ON public\.topup_requests/);
 assert.match(migration,/station_topup_request_preset_guard/);
 assert.doesNotMatch(migration,/GRANT EXECUTE ON FUNCTION.* TO (?:anon|authenticated)/);
});
