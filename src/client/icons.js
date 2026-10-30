import {
  createElement, Fuel, UsersRound, Wallet, CalendarDays, QrCode,
  LogOut, ShieldCheck, Mail, ClipboardList, ScanLine, TicketCheck,
  Building2, UserPlus, ReceiptText, Camera, CheckCircle2, Settings2, Menu, House, Power,
} from 'lucide';
import { siGoogle, siFacebook } from 'simple-icons';

// Explicit allowlists keep the app bundle tree-shakeable and avoid untrusted SVG.
const UI = Object.freeze({
  fuel:Fuel, users:UsersRound, wallet:Wallet, calendar:CalendarDays,
  qr:QrCode, logout:LogOut, shield:ShieldCheck, mail:Mail,
  clipboard:ClipboardList, scan:ScanLine, ticket:TicketCheck,
  building:Building2, 'user-plus':UserPlus, receipt:ReceiptText,
  camera:Camera, check:CheckCircle2, settings:Settings2, menu:Menu, home:House, power:Power,
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
  const path=document.createElementNS(SVG_NS,'path');
  path.setAttribute('fill','currentColor');
  path.setAttribute('d',brand.path);
  svg.appendChild(path);
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
