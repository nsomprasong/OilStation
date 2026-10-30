/** Thai SaaS Payment Element workspace. Test mode only.
 * Frontend never sets the invoice amount or marks a payment as settled.
 */
const money=value=>{
 if(!/^(?:0|[1-9]\d{0,14})$/.test(String(value??'')))return '—';
 const amount=BigInt(value);
 return (amount/100n).toLocaleString('th-TH')+'.'+(amount%100n).toString().padStart(2,'0');
};
let loadingStripe=null;
function stripeJs(){
 if(typeof window.Stripe==='function')return Promise.resolve(window.Stripe);
 if(loadingStripe)return loadingStripe;
 loadingStripe=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://js.stripe.com/v3/';
  script.async=true;
  script.addEventListener('load',()=>typeof window.Stripe==='function'?
    resolve(window.Stripe):reject(new Error('stripe_js_missing')),{once:true});
  script.addEventListener('error',()=>reject(new Error('stripe_js_failed')),{once:true});
  document.head.appendChild(script);
 }).catch(e=>{loadingStripe=null;throw e;});
 return loadingStripe;
}
export function mountBillingWorkspace({target,token,organizationId,publishableKey}){
 if(!target)return;
 target.replaceChildren();
 const section=document.createElement('section');section.className='billing-panel';
 const title=document.createElement('h3');title.textContent='ใบแจ้งหนี้ค่าสมาชิก SaaS';
 const description=document.createElement('p');
 description.className='hint';
 description.textContent='แยกจากเงินเติมเครดิตปั๊ม · การชำระยังอยู่ในโหมดทดสอบเท่านั้น';
 const refresh=document.createElement('button');refresh.type='button';
 refresh.className='button secondary';refresh.textContent='โหลดใบแจ้งหนี้';
 const list=document.createElement('div');list.className='billing-invoice-list';
 const payment=document.createElement('div');payment.className='billing-payment-element';
 const status=document.createElement('p');status.setAttribute('role','status');
 section.append(title,description,refresh,list,payment,status);
 target.appendChild(section);
 const enabled=typeof publishableKey==='string'&&/^pk_test_[A-Za-z0-9_]{12,}$/.test(publishableKey);
 const request=async(path,body=null)=>{
  const opts={cache:'no-store',headers:{authorization:'Bearer '+token}};
  if(body!==null){
   opts.method='POST';opts.headers['content-type']='application/json';opts.body=JSON.stringify(body);
  }
  const response=await fetch(path,opts);
  if(!response.ok)throw new Error('billing_request_failed');
  return response.json();
 };
 let activeElement=null;
 function clearElement(){
  activeElement?.unmount?.();activeElement?.destroy?.();
  activeElement=null;payment.replaceChildren();
 }
 async function pay(invoice){
  if(!enabled)return;
  clearElement();status.textContent='กำลังโหลดช่องทางชำระเงินทดสอบ…';
  refresh.disabled=true;
  try{
   const data=await request('/api/billing/payment-intent',{
    invoiceId:invoice.invoiceId,paymentMethod:invoice.paymentMethod,
   });
   const Stripe=await stripeJs();
   const stripe=Stripe(publishableKey);
   const elements=stripe.elements({clientSecret:data.clientSecret});
   const field=document.createElement('div');payment.appendChild(field);
   const element=elements.create('payment');
   activeElement=element;
   element.mount(field);
   const form=document.createElement('form');
   const submit=document.createElement('button');submit.type='submit';
   submit.className='button primary';submit.textContent='ยืนยันการชำระเงินในโหมดทดสอบ';
   const notice=document.createElement('p');notice.setAttribute('role','status');
   form.append(submit,notice);payment.appendChild(form);
   form.addEventListener('submit',async e=>{
    e.preventDefault();submit.disabled=true;
    notice.textContent='กำลังตรวจสอบข้อมูลการชำระเงิน…';
    try{
     const result=await stripe.confirmPayment({elements,confirmParams:{
      return_url:new URL('/',location.origin).href},redirect:'if_required'});
     notice.textContent=result.error?
       'ยังชำระไม่สำเร็จ: '+(result.error.message||'กรุณาตรวจสอบข้อมูล'):
       'ส่งคำขอชำระแล้ว · รอ Stripe Webhook ยืนยันก่อนอัปเดตใบแจ้งหนี้';
    }catch{notice.textContent='ชำระเงินไม่สำเร็จ กรุณาตรวจสอบอีกครั้ง';}
    finally{submit.disabled=false;}
   });
   status.textContent='Payment Element (Stripe Test Mode) · ยอดยืนยันจากใบแจ้งหนี้เท่านั้น';
  }catch{
   status.textContent='เปิดการชำระเงินไม่ได้ โปรดตรวจสอบใบแจ้งหนี้และการตั้งค่า Stripe Test';
   clearElement();
  }finally{refresh.disabled=false;}
 }
 async function load(){
  refresh.disabled=true;clearElement();list.replaceChildren();
  status.textContent='กำลังโหลดใบแจ้งหนี้…';
  try{
   const result=await request('/api/billing/invoices?organizationId='+encodeURIComponent(organizationId));
   status.textContent='';
   if(!result.invoices?.length){
    status.textContent='ยังไม่มีใบแจ้งหนี้ที่ออกแล้ว';return;
   }
   for(const invoice of result.invoices){
    const card=document.createElement('article');card.className='billing-invoice-card';
    const name=document.createElement('strong');
    name.textContent=String(invoice.invoiceNumber||'ใบแจ้งหนี้')+' · '+String(invoice.billingGroupName||'');
    const meta=document.createElement('p');meta.className='hint';
    meta.textContent='ยอด '+money(invoice.amountSatang)+' บาท · '+String(invoice.status||'')+
     ' · '+(invoice.paymentMethod==='promptpay'?'PromptPay':'บัตร');
    card.append(name,meta);
    if(['issued','pending','overdue'].includes(invoice.status)){
     const btn=document.createElement('button');btn.type='button';btn.className='button secondary';
     btn.textContent=enabled?'ชำระด้วย Stripe (ทดสอบ)':'การชำระเงินจริงยังไม่เปิดใช้งาน';
     btn.disabled=!enabled||!['card','promptpay'].includes(invoice.paymentMethod);
     btn.addEventListener('click',()=>pay(invoice));
     card.append(btn);
    }
    list.appendChild(card);
   }
  }catch{status.textContent='โหลดใบแจ้งหนี้ไม่สำเร็จ กรุณาตรวจสิทธิ์องค์กร';}
  finally{refresh.disabled=false;}
 }
 refresh.addEventListener('click',load);
 load().catch(()=>{status.textContent='โหลดใบแจ้งหนี้ไม่สำเร็จ';});
}
