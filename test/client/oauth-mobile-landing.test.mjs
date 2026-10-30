import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalLandingAfterOAuth} from '../../src/client/oauth-landing.js';
const main=readFileSync(new URL('../../src/client/main.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');

test('first successful OAuth callback navigates to root once, without a manual refresh',()=>{
 const token={access_token:'persisted-session-token'};
 assert.equal(canonicalLandingAfterOAuth('/auth/callback',token),'/');
 assert.equal(canonicalLandingAfterOAuth('/',token),null);
 assert.equal(canonicalLandingAfterOAuth('/setup',token),null);
 assert.equal(canonicalLandingAfterOAuth('/invite/invite-code',token),null);
 assert.equal(canonicalLandingAfterOAuth('/c/opaque-coupon',token),null);
});
test('no redirect until Supabase has completed PKCE and persisted an authenticated session',()=>{
 assert.equal(canonicalLandingAfterOAuth('/auth/callback',null),null);
 assert.equal(canonicalLandingAfterOAuth('/auth/callback',{}),null);
 assert.equal(canonicalLandingAfterOAuth('/auth/callback',{access_token:''}),null);
 assert.equal(canonicalLandingAfterOAuth('/auth/callback',{access_token:0}),null);
 assert.match(main,/flowType:'pkce',detectSessionInUrl:true,persistSession:true/);
 const callback=main.indexOf('canonicalLandingAfterOAuth(location.pathname,session)');
 assert.ok(main.indexOf('await authClient.auth.getSession()')<callback);
 assert.ok(callback<main.lastIndexOf("getApi('/api/me',session.access_token)"));
 assert.match(main.slice(callback,callback+190),/if \(landing\) \{\s*location\.replace\(landing\);\s*return;/);
});
test('the canonical root can still render home and does not cause a loop',()=>{
 const testSession={access_token:'ok'};
 const first=canonicalLandingAfterOAuth('/auth/callback',testSession);
 assert.equal(first,'/');
 assert.equal(canonicalLandingAfterOAuth(first,testSession),null);
 assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
 assert.match(main,/if \(!session\) return setup \? platformSetupView\(\) : guestView\(Boolean\(invite\)\)/);
});
test('pending owner invitation and bootstrap survive the callback boundary',()=>{
 const start=main.indexOf('const landing=canonicalLandingAfterOAuth');
 const end=main.indexOf("const result = await getApi('/api/me',session.access_token)",start);
 const segment=main.slice(start,end);
 assert.match(segment,/if \(setup\)/);
 assert.match(segment,/if \(invite\)/);
 assert.doesNotMatch(segment,/sessionStorage\.clear\(/);
 assert.doesNotMatch(segment,/signOut\(\)/);
});
