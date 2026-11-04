import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_REVIEW_IDENTITIES} from '../../src/domain/qa-review-identities.mjs';

test('all 98 QA actors have a single frozen, role-scoped alias',()=>{
 assert.equal(QA_REVIEW_IDENTITIES.length,98);
 assert.equal(new Set(QA_REVIEW_IDENTITIES.map(x=>x.alias)).size,98);
 const byScope=Object.groupBy(QA_REVIEW_IDENTITIES,x=>x.scopeType);
 assert.equal(byScope.platform.length,2);
 assert.equal(byScope.organization.length,8);
 assert.equal(byScope.station.length,28);
 assert.equal(byScope.corporate_company.length,60);
 for(const x of QA_REVIEW_IDENTITIES){
  assert.match(x.alias,/^[a-z][a-z0-9-]{2,30}$/);
  assert.ok(['platform','organization','station','corporate_company'].includes(x.scopeType));
  assert.ok(x.role.length>0);
 }
});
test('driver, HR, station cashier, corporate accountant and each Sales are present',()=>{
 const lookup=new Map(QA_REVIEW_IDENTITIES.map(x=>[x.alias,x]));
 const cases=[
  ['sales01','platform_sales','platform'],
  ['sales02','platform_sales','platform'],
  ['c01-driver','driver','corporate_company'],
  ['c12-driver','driver','corporate_company'],
  ['c01-accountant','accountant','corporate_company'],
  ['c12-finance','finance_manager','corporate_company'],
  ['s01a-hr','hr_manager','station'],
  ['s02b-cashier','cashier','station'],
  ['o04-billing','billing_manager','organization'],
 ];
 for(const [alias,role,scopeType] of cases){
  assert.equal(lookup.get(alias)?.role,role,alias);
  assert.equal(lookup.get(alias)?.scopeType,scopeType,alias);
 }
});
