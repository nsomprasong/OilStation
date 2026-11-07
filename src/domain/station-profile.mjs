// Server-side validation shared by platform station profile routes.
// All fields are provided on every save, so browsers cannot mass-assign
// station organization, owner, brand, paid plan, status, or tax invoices.
export const profileTextLimits={
 stationName:160,address:750,latitude:20,longitude:20,contactName:120,
 stationPhone:30,stationEmail:254,postalCode:10,invoiceIssuerName:200,
 invoiceTaxId:13,invoiceBranchCode:5,invoiceAddress:750,
 invoicePhone:30,invoiceEmail:254,
};
export function normalizeStationProfile(input){
 if(!input||Array.isArray(input)||typeof input!=='object')return null;
 const keys=Object.keys(profileTextLimits);
 if(Object.keys(input).length!==keys.length+1||!Object.hasOwn(input,'vatRegistered')
  ||typeof input.vatRegistered!=='boolean'
  ||Object.keys(input).some(key=>key!=='vatRegistered'&&!keys.includes(key)))return null;
 const cleaned={};
 for(const key of keys){
  const value=input[key];
  if(typeof value!=='string'||value.length>profileTextLimits[key])return null;
  cleaned[key]=value.trim();
 }
 cleaned.vatRegistered=input.vatRegistered;
 if(cleaned.stationName.length<2||cleaned.stationName.length>160)return null;
 const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 for(const name of ['stationEmail','invoiceEmail'])
  if(cleaned[name]&&!email.test(cleaned[name]))return null;
 if(cleaned.postalCode&&!/^[0-9]{5}$/.test(cleaned.postalCode))return null;
 if(cleaned.invoiceTaxId&&!/^[0-9]{13}$/.test(cleaned.invoiceTaxId))return null;
 if(cleaned.invoiceBranchCode&&!/^[0-9]{5}$/.test(cleaned.invoiceBranchCode))return null;
 for(const [name,min,max] of [['latitude',-90,90],['longitude',-180,180]]){
  const value=cleaned[name];
  if(value&&!(/^-?[0-9]{1,3}(?:\.[0-9]{1,7})?$/.test(value)&&
    Number(value)>=min&&Number(value)<=max))return null;
 }
 if(cleaned.vatRegistered&&(!cleaned.invoiceIssuerName||!cleaned.invoiceTaxId
  ||!cleaned.invoiceBranchCode||!cleaned.invoiceAddress))return null;
 return cleaned;
}
