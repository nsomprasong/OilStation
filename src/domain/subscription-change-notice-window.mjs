/** Pure notice policy preview; no external notification is sent here. */
const TIME=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const epoch=x=>{if(typeof x!=='string'||!TIME.test(x)||!Number.isFinite(Date.parse(x)))throw new TypeError('invalid notice instant');return Date.parse(x);};
export function assessSaasSwitchNotice({effectiveAtUtc,noticeAcknowledgedAtUtc,minNoticeHours=24}){
 if(!Number.isInteger(minNoticeHours)||minNoticeHours<0||minNoticeHours>720)
  throw new RangeError('invalid notice requirement');
 const effective=epoch(effectiveAtUtc);
 if(noticeAcknowledgedAtUtc===null)return Object.freeze({ready:false,reason:'owner_acknowledgment_missing'});
 const approved=epoch(noticeAcknowledgedAtUtc);
 if(approved>effective)return Object.freeze({ready:false,reason:'acknowledgment_after_switch'});
 if(effective-approved<minNoticeHours*3600000)
  return Object.freeze({ready:false,reason:'insufficient_notice'});
 return Object.freeze({ready:true,reason:'notice_precondition_met_not_activation'});
}
