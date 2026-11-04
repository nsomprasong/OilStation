/**
 * Frozen OilStation QA role matrix for manual owner review only.
 * Exactly 98 synthetic, email-confirmed accounts, in run QA-20261031-PLATFORM-001.
 * Never discover or target arbitrary real accounts from user input.
 */
const stationAliases=['s01a','s01b','s02a','s02b'];
const stationRoles=[
 ['owner','station_owner'],
 ['manager','manager'],
 ['cashier','cashier'],
 ['attendant','attendant'],
 ['pump','pump_staff'],
 ['hr','hr_manager'],
 ['finance','finance_manager'],
];
const corporateRoles=[
 ['admin','corporate_admin'],
 ['accountant','accountant'],
 ['issuer','coupon_issuer'],
 ['driver','driver'],
 ['finance','finance_manager'],
];
const rows=[
 ...['sales01','sales02'].map(alias=>({alias,scopeType:'platform',role:'platform_sales'})),
 ...Array.from({length:4},(_,i)=>{
   const prefix='o'+String(i+1).padStart(2,'0');
   return [
    {alias:prefix+'-owner',scopeType:'organization',role:'organization_owner'},
    {alias:prefix+'-billing',scopeType:'organization',role:'billing_manager'},
   ];
 }).flat(),
 ...stationAliases.flatMap(prefix=>stationRoles.map(([suffix,role])=>({
   alias:prefix+'-'+suffix,scopeType:'station',role,
 }))),
 ...Array.from({length:12},(_,i)=>{
   const prefix='c'+String(i+1).padStart(2,'0');
   return corporateRoles.map(([suffix,role])=>({
     alias:prefix+'-'+suffix,scopeType:'corporate_company',role,
   }));
 }).flat(),
];
if(rows.length!==98||new Set(rows.map(r=>r.alias)).size!==98)
 throw Error('Frozen QA role matrix is incomplete or contains duplicates');
export const QA_REVIEW_IDENTITIES=Object.freeze(rows.map(x=>Object.freeze(x)));
