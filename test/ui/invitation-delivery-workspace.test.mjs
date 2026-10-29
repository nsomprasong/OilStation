import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../../src/adapters/supabase.mjs',import.meta.url),'utf8');
test('both normal and first corporate admin invitations use optional delivery',()=>{
 assert.equal((adapter.match(/sendInvitationEmail\(/g)||[]).length,2);
 assert.equal((app.match(/invitation\.delivery==='email_accepted'/g)||[]).length,2);
});
test('UI states provider accepted, not inbox delivery, and exposes manual recovery',()=>{
 assert.match(app,/ยังไม่ยืนยันการส่งถึงผู้รับ/);
 assert.match(app,/กรุณาคัดลอกและส่งให้ผู้รับ/);
 assert.match(app,/กรุณาส่งลิงก์ให้ผู้รับ/);
});
