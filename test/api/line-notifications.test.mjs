import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLineMessage,createLinePush,drainLineNotifications} from '../../src/notifications/line.mjs';
const retryKey='22222222-2222-4222-8222-222222222222';
const recipientId='U'+'0123456789abcdef'.repeat(2);
const token='test-only-official-line-channel-access-token';
test('LINE notifications contain only generic Thai event text and login deep link',()=>{
 const msg=makeLineMessage('topup_pending');
 assert.match(msg.messages[0].text,/oilstation.goldensoft.cloud/);
 assert.doesNotMatch(msg.messages[0].text,/บัญชีธนาคาร|ยอดเงิน|ตัวเลขบัญชี/);
 assert.equal(makeLineMessage('unknown'),null);
});
test('push includes stable LINE retry key, accepts delivered or recognized duplicate',async()=>{
 const seen=[];
 const push=createLinePush({accessToken:token,fetchImpl:async(url,init)=>{
  seen.push({url,init});
  return new Response('{}',{status:409,headers:{'x-line-accepted-request-id':'accepted-001'}});
 }});
 assert.equal((await push({recipientId,retryKey,eventType:'topup_pending'})).accepted,true);
 assert.equal(seen[0].url,'https://api.line.me/v2/bot/message/push');
 assert.equal(seen[0].init.headers['x-line-retry-key'],retryKey);
 assert.equal(JSON.parse(seen[0].init.body).to,recipientId);
});
test('retry ambiguous provider failure with same idempotency and do not send unknown event',async()=>{
 const finished=[];
 const db={claimLineNotifications:async()=>[
   {id:retryKey,lineUserId:recipientId,eventType:'topup_pending'},
   {id:'33333333-3333-4333-8333-333333333333',lineUserId:recipientId,eventType:'private_bank_data'},
  ],finishLineNotification:async(id,decision)=>finished.push([id,decision])};
 let sends=0;
 const result=await drainLineNotifications({db,accessToken:token,fetchImpl:async()=>{
  sends++;throw new Error('timeout');
 }});
 assert.equal(sends,1);
 assert.deepEqual(finished.map(x=>x[1]),['retry','cancel']);
 assert.equal(result.failed,2);
});
