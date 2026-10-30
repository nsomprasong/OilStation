import {
  createElement, Fuel, UsersRound, Wallet, CalendarDays, QrCode,
  LogOut, ShieldCheck, Mail, ClipboardList, ScanLine, TicketCheck,
  Building2, UserPlus, ReceiptText, Camera, CheckCircle2, Settings2, Menu, House, Power, Pencil, Plus,
} from 'lucide';
import { siGoogle, siFacebook } from 'simple-icons';

// Explicit allowlists keep the app bundle tree-shakeable and avoid untrusted SVG.
const UI = Object.freeze({
  fuel:Fuel, users:UsersRound, wallet:Wallet, calendar:CalendarDays,
  qr:QrCode, logout:LogOut, shield:ShieldCheck, mail:Mail,
  clipboard:ClipboardList, scan:ScanLine, ticket:TicketCheck,
  building:Building2, 'user-plus':UserPlus, receipt:ReceiptText,
  camera:Camera, check:CheckCircle2, settings:Settings2, menu:Menu, home:House, power:Power, edit:Pencil, plus:Plus,
});
const BRANDS = Object.freeze({ google:siGoogle, facebook:siFacebook });
const SVG_NS='http://www.w3.org/2000/svg';

export function makeIcon(name) {
  const node=UI[name];
  if (!node) throw new Error('unsupported_ui_icon');
  return createElement(node, {
    class:['app-icon'], width:19,height:19,'stroke-width':1.9,
    'aria-hidden':'true',focusable:'false',
  });
}
export function makeBrandIcon(name) {
  const brand=BRANDS[name];
  if (!brand) throw new Error('unsupported_brand_icon');
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('width','19');svg.setAttribute('height','19');
  svg.setAttribute('class','app-icon brand-symbol');
  svg.setAttribute('role','presentation');svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  if(name==='google'){
    // Google's authentic four-color G mark; no recoloring through currentColor.
    const shapes=[
      ['#4285F4','M21.35 12.24c0-.76-.07-1.49-.20-2.20H12v4.16h5.23a4.47 4.47 0 0 1-1.94 2.93v2.40h3.14c1.83-1.69 2.92-4.17 2.92-7.29z'],
      ['#34A853','M12 21.73c2.62 0 4.82-.87 6.43-2.36l-3.14-2.40c-.87.59-1.98.94-3.29.94-2.53 0-4.67-1.71-5.44-4H3.33v2.50A9.73 9.73 0 0 0 12 21.73z'],
      ['#FBBC05','M6.56 13.91a5.88 5.88 0 0 1-.31-1.91c0-.66.11-1.30.31-1.91v-2.50H3.33A9.72 9.72 0 0 0 2.25 12c0 1.57.38 3.05 1.08 4.41l3.23-2.50z'],
      ['#EA4335','M12 6.08c1.42 0 2.69.49 3.70 1.46l2.78-2.78A9.56 9.56 0 0 0 12 2.27c-3.91 0-7.28 2.24-8.67 5.50l3.23 2.50c.77-2.29 2.91-4.19 5.44-4.19z'],
    ];
    for(const [fill,d] of shapes){
      const path=document.createElementNS(SVG_NS,'path');
      path.setAttribute('fill',fill);path.setAttribute('d',d);svg.appendChild(path);
    }
  }else{
    const path=document.createElementNS(SVG_NS,'path');
    path.setAttribute('fill','#1877F2');
    path.setAttribute('d',brand.path);svg.appendChild(path);
  }
  return svg;
}
// Converts only explicitly authored placeholders, not user-supplied strings.
export function decorateIcons(container) {
  if (!container || typeof container.querySelectorAll!=='function') return;
  for (const node of container.querySelectorAll('[data-ui-icon]')) {
    const name=node.getAttribute('data-ui-icon');
    if (Object.hasOwn(UI,name)) node.replaceWith(makeIcon(name));
  }
  for (const node of container.querySelectorAll('[data-brand-icon]')) {
    const name=node.getAttribute('data-brand-icon');
    if (Object.hasOwn(BRANDS,name)) node.replaceWith(makeBrandIcon(name));
  }
}
