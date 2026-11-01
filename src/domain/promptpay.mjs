/** Thai QR Payment Standard (BOT): PromptPay credit transfer, not a bank receipt. */
const tlv=(id,value)=>id+String(value.length).padStart(2,'0')+value;
export function normalizePromptPay(kind,value){
 if(typeof value!=='string')throw new TypeError('invalid recipient');
 const digits=value.replace(/[ -]/g,'');
 if(kind==='promptpay_phone'){
  if(!/^0[689][0-9]{8}$/.test(digits))throw new RangeError('invalid Thai PromptPay phone');
  return {subtag:'01',value:'0066'+digits.slice(1),masked:'0••-•••-'+digits.slice(-4)};
 }
 if(kind==='promptpay_national_id'){
  if(!/^[0-9]{13}$/.test(digits))throw new RangeError('invalid PromptPay national ID');
  return {subtag:'02',value:digits,masked:'•••••••••'+digits.slice(-4)};
 }
 throw new RangeError('unsupported PromptPay type');
}
export function promptPayCrc(input){
 let crc=0xffff;
 for(const c of input){
  crc^=c.charCodeAt(0)<<8;
  for(let i=0;i<8;i++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;
 }
 return crc.toString(16).toUpperCase().padStart(4,'0');
}
export function buildPromptPayPayload({type,recipient,amountSatang}){
 const payee=normalizePromptPay(type,recipient);
 if(!Number.isSafeInteger(amountSatang)||amountSatang<1||amountSatang>999_999_999_999)
  throw new RangeError('invalid amount');
 const amount=(Math.floor(amountSatang/100))+'.'+String(amountSatang%100).padStart(2,'0');
 const merchant=tlv('00','A000000677010111')+tlv(payee.subtag,payee.value);
 const base=tlv('00','01')+tlv('01','12')+tlv('29',merchant)+
  tlv('58','TH')+tlv('53','764')+tlv('54',amount)+'6304';
 return base+promptPayCrc(base);
}
export function maskManualAccount(type,raw){
 if(type!=='bank_account'||typeof raw!=='string'||!/^[0-9]{7,16}$/.test(raw.replace(/[ -]/g,'')))
  throw new RangeError('invalid bank account');
 const digits=raw.replace(/[ -]/g,'');
 return '••••'+digits.slice(-4);
}
