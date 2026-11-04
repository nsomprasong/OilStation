import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQaReviewPassword} from '../../src/domain/qa-review-password.mjs';

test('QA review secret accepts exactly 8 easy ASCII letters and digits',()=>{
  for(const value of ['12345678','abcdefgh','ABCDEFGH','OilQA826','Qa123456']){
    assert.equal(normalizeQaReviewPassword(value),value);
  }
  assert.equal(normalizeQaReviewPassword(' 12345678 '),'12345678');
  assert.equal(normalizeQaReviewPassword('\nOilQA826\r'),'OilQA826');
});

test('QA review password validator rejects malformed, short and long values',()=>{
  for(const value of [null,undefined,0,'','1234567','123456789','with space','1234-678','abcdefghij','รหัส1234','abcd\u0000efg']){
    assert.equal(normalizeQaReviewPassword(value),null);
  }
});
