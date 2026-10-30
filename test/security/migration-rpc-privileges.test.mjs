import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const dir=new URL('../../supabase/migrations/',import.meta.url);
const migrations=readdirSync(dir).filter(name=>name.endsWith('.sql')).sort();
test('all developer migrations are ordered, uniquely timestamped SQL files',()=>{
 assert.ok(migrations.length>=45);
 assert.ok(migrations.every(name=>/^\d{14}_[a-z0-9_]+\.sql$/.test(name)));
 assert.equal(new Set(migrations.map(n=>n.slice(0,14))).size,migrations.length);
});
test('every function has explicit public/anonymous/authenticated execute restriction',()=>{
 for(const file of migrations){
  const sql=readFileSync(new URL(file,dir),'utf8');
  const matches=[...sql.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi)];
  for(const m of matches){
   const name=m[1];
   const revoke=new RegExp('REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.'+name+'\\s*\\(','i');
   assert.match(sql,revoke,file+':'+name+' has no explicit revoke');
  }
 }
});
test('all privileged migration RPC functions pin empty search_path',()=>{
 for(const file of migrations){
  const sql=readFileSync(new URL(file,dir),'utf8');
  const starts=[...sql.matchAll(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+[\w.]+\s*\(/gi)];
  for(let i=0;i<starts.length;i++){
   const end=sql.indexOf('AS $',starts[i].index);
   const header=sql.slice(starts[i].index,end===-1?starts[i].index+750:end);
   if(!/SECURITY\s+DEFINER/i.test(header))continue;
   assert.match(header,/SET\s+search_path\s*=\s*''/i,file+': SECURITY DEFINER search_path not fixed');
  }
 }
});
test('high-value financial entrypoints are not directly callable by Worker service_role',()=>{
 const sql=migrations.map(file=>readFileSync(new URL(file,dir),'utf8')).join('\n');
 for(const name of ['start_reserved_fuel_session','finish_reserved_fuel_session','review_corporate_topup']){
  const literal=new RegExp('REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.'+name+
    '\\s*\\([\\s\\S]*?\\)\\s*FROM\\s+PUBLIC,anon,authenticated,service_role','i');
  assert.match(sql,literal,name+' service role grant not revoked');
 }
});
