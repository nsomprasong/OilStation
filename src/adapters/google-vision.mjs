/** Google Cloud Vision OCR. API key must exist only as an encrypted Worker secret. */
export function createGoogleVisionRecognizer(apiKey,{fetchImpl=fetch}={}){
  return async ({bytes,contentType})=>{
    if(typeof apiKey!=='string'||apiKey.length<12)throw new Error('ocr_not_configured');
    if(!(bytes instanceof Uint8Array)||bytes.byteLength<64||bytes.byteLength>5*1024*1024||
       !['image/png','image/jpeg'].includes(contentType))throw new Error('invalid_ocr_image');
    // Chunks are multiples of three, so base64 has no midstream padding.
    let image='';
    for(let i=0;i<bytes.length;i+=8190)
      image+=btoa(String.fromCharCode(...bytes.subarray(i,i+8190)));
    const response=await fetchImpl('https://vision.googleapis.com/v1/images:annotate',{
      method:'POST',headers:{'content-type':'application/json','x-goog-api-key':apiKey},
      body:JSON.stringify({requests:[{
        image:{content:image},features:[{type:'DOCUMENT_TEXT_DETECTION',maxResults:1}],
        imageContext:{languageHints:['th','en']},
      }]}),signal:AbortSignal.timeout(10_000),
    });
    if(!response.ok)throw new Error('ocr_provider_unavailable');
    const data=await response.json();
    const result=data?.responses?.[0];
    if(!result||result.error)throw new Error('ocr_provider_unavailable');
    const full=result.fullTextAnnotation;
    const words=(full?.pages||[]).flatMap(p=>(p.blocks||[])
      .flatMap(b=>(b.paragraphs||[]).flatMap(par=>par.words||[])));
    // Missing provider confidence is *never* considered high confidence.
    const confidence=words.length&&words.every(w=>typeof w.confidence==='number'&&
      w.confidence>=0&&w.confidence<=1)
      ?Math.min(...words.map(w=>w.confidence)):null;
    return {text:full?.text||'',confidence};
  };
}
