/** Conservative Thai licence plate OCR decision. Never compare substrings. */
const thaiDigits='๐๑๒๓๔๕๖๗๘๙';
export function normalizePlate(value){
  if(typeof value!=='string'||value.length>80)return null;
  const compact=value.normalize('NFKC').toUpperCase()
    .replace(/[๐-๙]/g,ch=>String(thaiDigits.indexOf(ch)))
    .replace(/[\s\-–—.,/]+/g,'');
  return /^[ก-ฮA-Z0-9]{2,16}$/u.test(compact)?compact:null;
}
export function extractPlateCandidates(text){
  if(typeof text!=='string'||text.length>10000)return [];
  const found=new Set();
  // Never infer a plate from an arbitrary numeric substring.
  const pattern=/(?:^|[^\p{L}0-9๐-๙])([1-9]?[ก-ฮ]{1,3}|[A-Z]{1,3})[\s\-]*([0-9๐-๙]{1,4})(?![\p{L}0-9๐-๙])/gu;
  for(const match of text.toUpperCase().matchAll(pattern)){
    const candidate=normalizePlate(match[1]+match[2]);
    if(candidate)found.add(candidate);
  }
  return [...found];
}
export function evaluatePlateOcr({text,confidence,expectedPlate}){
  const candidates=extractPlateCandidates(text);
  const expected=expectedPlate==null?null:normalizePlate(expectedPlate);
  const confident=typeof confidence==='number'&&Number.isFinite(confidence)&&confidence>=0.92&&confidence<=1;
  const single=candidates.length===1?candidates[0]:null;
  const matched=single!==null&&(expected===null||single===expected);
  return {observedPlate:single,verified:confident&&matched,
    reason:candidates.length>1?'ambiguous':!single?'unreadable':
      expected!==null&&single!==expected?'plate_mismatch':
      !confident?'low_confidence':'matched'};
}
