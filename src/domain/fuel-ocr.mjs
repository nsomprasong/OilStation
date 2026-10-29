/** OCR only drafts numeric values for HUMAN comparison to the private photo.
 * Never turn this into settlement proof or auto-approve.
 */
const THAI_DIGITS='๐๑๒๓๔๕๖๗๘๙';
function normalizeText(input){
 if(typeof input!=='string'||input.length>10000)return '';
 return input.normalize('NFKC').replace(/[๐-๙]/g,x=>String(THAI_DIGITS.indexOf(x)));
}
function one(list){
 const unique=[...new Set(list)];return unique.length===1?unique[0]:null;
}
function liters(raw){
 const re=/(?<![0-9])([0-9]{1,7}(?:\.[0-9]{1,3})?)\s*(?:ลิตร|LITERS?|L)(?![A-Z0-9])/giu;
 const vals=[];
 for(const match of raw.matchAll(re)){
  const s=match[1];
  if(!/^\d{1,7}(?:\.\d{1,3})?$/.test(s))continue;
  const [whole,fraction='']=s.split('.');
  const thousandths=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));
  if(thousandths>0n&&thousandths<=9_999_999_000n)
    vals.push(whole+'.'+fraction.padEnd(3,'0'));
 }
 return one(vals);
}
function gross(raw){
 const re=/(?<![0-9])((?:[0-9]{1,7}|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?)\s*(?:บาท|฿|THB)(?![A-Z0-9])/giu;
 const vals=[];
 for(const match of raw.matchAll(re)){
  const s=match[1].replace(/,/g,'');
  const [baht,coins='']=s.split('.');
  if(!/^\d{1,12}$/.test(baht))continue;
  const satang=BigInt(baht)*100n+BigInt(coins.padEnd(2,'0'));
  if(satang>=0n&&satang<=999_999_999_999n)vals.push(satang.toString());
 }
 return one(vals);
}
export function parseFuelOcrPreview({kind,text,confidence}){
 if(!['pump_display','receipt'].includes(kind))throw new TypeError('invalid evidence kind');
 const raw=normalizeText(text);
 const score=typeof confidence==='number'&&Number.isFinite(confidence)&&confidence>=0&&confidence<=1
   ?confidence:null;
 return {
  kind,liters:kind==='pump_display'?liters(raw):null,
  grossSatang:gross(raw),confidence:score,
  status:'needs_human_review',verified:false,
 };
}
