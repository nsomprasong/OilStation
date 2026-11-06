/** Pure entitlement preview. No grants/revocations or subscription writes. */
const DATE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const instant=(s)=>{if(typeof s!=='string'||!DATE.test(s)||!Number.isFinite(Date.parse(s)))throw new TypeError('invalid UTC instant');return Date.parse(s);};
const modules=(value)=>{if(!Array.isArray(value)||value.length>2||value.some(x=>!['qr','hr'].includes(x))||new Set(value).size!==value.length)throw new TypeError('invalid modules');return Object.freeze([...value].sort());};
export function previewSaasEntitlementCutover({effectiveAtUtc,nowUtc,currentModules,nextModules}){
 const boundary=instant(effectiveAtUtc),now=instant(nowUtc);
 const old=modules(currentModules),next=modules(nextModules);
 return Object.freeze({mode:'READ_ONLY',atBoundary:now===boundary,
  activeModules:now<boundary?old:next,
  activationSource:now<boundary?'existing_plan':'replacement_plan',
  effectiveAtUtc:new Date(boundary).toISOString()});
}
