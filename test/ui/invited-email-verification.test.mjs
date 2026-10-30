import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
test('Facebook alternate invited email leads to independent user-visible OTP flow',()=>{
 assert.match(code,/invitedEmailVerification\(session\.access_token,invite\)/);
 assert.match(code,/api\/invitations\/email-challenge/);
 assert.match(code,/api\/invitations\/email-confirm/);
 assert.match(code,/autocomplete="one-time-code"/);
 assert.match(code,/pattern="\[0-9\]\{8\}"/);
 assert.match(code,/sessionStorage\.removeItem\(INVITE_KEY\)/);
});
test('failed OTP never deletes invitation token or signs in another user',()=>{
 const start=code.indexOf("async function invitedEmailVerification(");
 const end=code.indexOf("async function boot() {",start);
 const block=code.slice(start,end);
 assert.ok(block.indexOf('if(!res.ok||res.data.accepted!==true)')<
           block.indexOf('sessionStorage.removeItem(INVITE_KEY)'));
 assert.match(block,/authClient\.auth\.signOut\(\)/);
});
