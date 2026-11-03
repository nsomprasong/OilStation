import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fuel, QrCode, Wallet, CalendarDays, MapPin, UserPlus, TicketCheck } from 'lucide';
import { siGoogle, siFacebook } from 'simple-icons';
import { makeIcon, makeBrandIcon, decorateIcons } from '../../src/client/icons.js';

test('Lucide named exports and Simple Icons brand paths are available from installed dependencies',()=>{
  assert.equal(typeof createElement,'function');
  for(const icon of [Fuel,QrCode,Wallet,CalendarDays,MapPin,UserPlus,TicketCheck])assert.ok(icon);
  for(const brand of [siGoogle,siFacebook]){
    assert.match(brand.path,/^[0-9A-Za-z, .-]+$/);
  }
  assert.equal(typeof makeIcon,'function');
  assert.equal(typeof makeBrandIcon,'function');
  assert.equal(typeof decorateIcons,'function');
});
test('icon library releases are pinned in project dependencies',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {fileURLToPath}=await import('node:url');
  const {resolve,dirname}=await import('node:path');
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
  const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
  assert.match(manifest.dependencies.lucide,/^\d+\.\d+\.\d+$/);
  assert.match(manifest.dependencies['simple-icons'],/^\d+\.\d+\.\d+$/);
});

test('all functional submenu icon names are explicitly mapped to a supported Lucide export',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {fileURLToPath}=await import('node:url');
 const {resolve,dirname}=await import('node:path');
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
 const source=await readFile(resolve(root,'src/client/functional-submenus.js'),'utf8');
 const icons=await readFile(resolve(root,'src/client/icons.js'),'utf8');
 const keys=[...icons.matchAll(/(?:[,{]\s*)(?:'([a-z-]+)'|([a-z-]+))\s*:\s*[A-Z][A-Za-z0-9]+/g)]
  .map(m=>m[1]||m[2]);
 const supported=new Set(keys);
 const menu=[...source.matchAll(/\bicon:'([a-z-]+)'/g)].map(m=>m[1]);
 const arrays=[...source.matchAll(/\bicons:\[([^\]]+)\]/g)]
  .flatMap(m=>[...m[1].matchAll(/'([a-z-]+)'/g)].map(x=>x[1]));
 for(const name of [...menu,...arrays]){
  assert.ok(supported.has(name),'unsupported functional submenu icon: '+name);
 }
 assert.ok(menu.includes('map-pin'),'HR GPS icon must be present');
 assert.match(icons,/\bMapPin\b/);
});
