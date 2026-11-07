// Pure presentation model for the authorized station rows returned by API.
// Do not infer owner invitations from module flags: that requires a distinct
// server-backed workflow and must never be presented as a verified status.
const clean=value=>String(value??'').trim();
export function stationEnabledModules(station){
 const modules=station?.modules||{};
 return ['qr_coupon','hr_payroll'].filter(key=>modules[key]==='enabled');
}
export function stationServiceStatus(station){
 return stationEnabledModules(station).length?'enabled':'inactive';
}
export function filterStationDirectory(rows=[],{query='',filter='all'}={}){
 const search=clean(query).toLocaleLowerCase('th-TH');
 return rows.filter(row=>{
  const active=stationEnabledModules(row);
  const matches=filter==='all'
   ||(filter==='enabled'&&active.length>0)
   ||(filter==='inactive'&&active.length===0)
   ||(filter==='qr'&&active.includes('qr_coupon'))
   ||(filter==='hr'&&active.includes('hr_payroll'));
  if(!matches)return false;
  if(!search)return true;
  return [row.stationName,row.organizationName,row.brandName,row.brandCode]
   .some(part=>clean(part).toLocaleLowerCase('th-TH').includes(search));
 });
}
