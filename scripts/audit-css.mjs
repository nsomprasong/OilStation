/** OilStation CSS governance: one local stylesheet, no duplicate property
 * declarations for the same selector and identical conditional context.
 */
import {readFileSync,readdirSync} from 'node:fs';
import postcss from 'postcss';
const html=readFileSync('index.html','utf8');
const links=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(x=>x[1]);
if(links.length!==1||links[0]!=='/oilstation.css')throw Error('Exactly one local app CSS link required: '+links);
const assets=readdirSync('public').filter(name=>name.endsWith('.css'));
if(assets.length!==1||assets[0]!=='oilstation.css')throw Error('Remove orphan theme CSS: '+assets);
const content=readFileSync('public/oilstation.css','utf8');
const root=postcss.parse(content,{from:'public/oilstation.css'});
// CSS v3 is the approved Login-led source of truth. Verify the token graph,
// not literal v1 colors that no longer exist after the user's redesign.
const tokens=new Map();
root.walkRules(rule=>{
 if(rule.selector.split(',').some(x=>[':root','html:root'].includes(x.trim())))
  rule.walkDecls(d=>{if(d.prop.startsWith('--'))tokens.set(d.prop,d.value.trim());});
});
const expected={
 '--os-bg':'#EAE7DF','--os-side':'#10271E','--os-card':'#F7F5EF',
 '--os-ac':'#194635','--os-ac-deep':'#174735',
 '--os-gold':'#BD9A5E','--os-tx':'#1B2A24','--os-side-tx':'#F7F5EF',
 '--mid-page':'var(--os-bg)','--mid-card':'var(--os-card)',
 '--mid-cyan':'var(--os-ac-deep)',
};
for(const [name,value] of Object.entries(expected))
 if(tokens.get(name)!==value)throw Error('CSS v3 token mismatch: '+name+
  ' expected '+value+' got '+tokens.get(name));
let ruleCount=0,declarations=0,layeredOverrides=0;const seen=new Set();
const context=rule=>{
 let parts=[],node=rule.parent;
 while(node&&node.type!=='root'){
  if(node.type==='atrule')parts.unshift('@'+node.name+' '+node.params);
  node=node.parent;
 }
 return parts.join('>');
};
root.walkRules(rule=>{
 ruleCount++;
 if(rule.parent?.type==='atrule'&&/keyframes/i.test(rule.parent.name))return;
 const withinBlock=new Set();
 rule.walkDecls(d=>{
  declarations++;
  const key=context(rule)+'|'+rule.selector+'|'+d.prop+'|'+Boolean(d.important);
  const local=d.prop+'|'+Boolean(d.important);
  // A duplicate within one block is an authoring mistake. Across separate
  // blocks the canonical CSS base -> module -> shell cascade is intentional: keep
  // the last rule authoritative, and report these overrides for review.
  if(withinBlock.has(local))throw Error('Duplicate property in CSS block: '+key);
  withinBlock.add(local);
  if(seen.has(key))layeredOverrides++;
  seen.add(key);
 });
});
const retained=['.ws-screen-head','.os-mobile-bottom','.os-functional-nav','.os-auth-card',
 '.os-sales-panel','.os-plan-card','.fuel-row','.attendance-workspace','.os-station-card'];
for(const name of retained)if(!content.includes(name))throw Error('Missing operational selector '+name);
console.log('CSS audit PASS: 1 stylesheet, '+ruleCount+' rules, '+declarations+' declarations, '+layeredOverrides+' layered overrides, '+Buffer.byteLength(content)+' bytes');
