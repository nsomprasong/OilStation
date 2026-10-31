import test from 'node:test';
import assert from 'node:assert/strict';
import {humanizeApiError} from '../../src/client/ui-status.js';
test('QA Sales limit is a safe actionable Thai validation message',()=>{
 const text=humanizeApiError('sales_station_limit_reached');
 assert.match(text,/Sales/);
 assert.match(text,/2/);
 assert.match(text,/3/);
 assert.notEqual(text,'ทำรายการไม่สำเร็จ กรุณาลองใหม่');
 assert.equal(humanizeApiError('unknown_api_issue'),'ทำรายการไม่สำเร็จ กรุณาลองใหม่');
});
