import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const preview=readFileSync(new URL('../../.github/workflows/production-preview.yml',import.meta.url),'utf8');
const config=JSON.parse(readFileSync(new URL('../../wrangler.jsonc',import.meta.url),'utf8'));

test('push-triggered production preview must remain fail-closed',()=>{
  assert.equal(config.vars.OILSTATION_API_ENABLED,'false');
  assert.equal(config.vars.OILSTATION_DEPLOY_TARGET,'production');
  assert.match(preview,/branches:\s*\[main\]/);
  assert.match(preview,/Validate preview-only runtime flags before deploying/);
  assert.match(preview,/OILSTATION_API_ENABLED/);
  assert.match(preview,/OILSTATION_PREVIEW_LOGIN_ENABLED/);
  assert.match(preview,/OILSTATION_PREVIEW_OPERATIONS_ENABLED/);
});

test('preview deploy checks readiness is HTTP 503 and never claims business readiness',()=>{
  assert.match(preview,/\/api\/health/);
  assert.match(preview,/\/api\/ready/);
  assert.match(preview,/test "\$ready_code" = 503/);
  assert.match(preview,/\.service == "oilstation" and \.ready == false/);
  assert.match(preview,/\/api\/billing\/payment-intent/);
  assert.match(preview,/\/api\/coupons/);
});
