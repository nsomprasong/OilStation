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
if(!content.includes('--mid-page:#040D3F')||!content.includes('--mid-card:#1D2552')||!content.includes('--mid-cyan:#0D8091'))
 throw Error('Midnight Banking tokens not canonical');
const root=postcss.parse(content,{from:'public/oilstation.css'});
let ruleCount=0,declarations=0;const seen=new Set();
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
 rule.walkDecls(d=>{
  declarations++;
  const key=context(rule)+'|'+rule.selector+'|'+d.prop+'|'+Boolean(d.important);
  if(seen.has(key))throw Error('Duplicate CSS declaration: '+key);
  seen.add(key);
 });
});
const retained=['.ws-screen-head','.os-mobile-bottom','.os-functional-nav','.os-auth-card',
 '.os-sales-panel','.os-plan-card','.fuel-row','.attendance-workspace','.os-station-card'];
for(const name of retained)if(!content.includes(name))throw Error('Missing operational selector '+name);
console.log('CSS audit PASS: 1 stylesheet, '+ruleCount+' rules, '+declarations+' declarations, '+Buffer.byteLength(content)+' bytes');
