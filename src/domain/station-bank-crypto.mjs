/** Server-only AES-256-GCM for receiving station bank accounts.
 * Secret must be 32 random bytes, supplied via an encrypted Worker secret.
 * Never log plaintext, ciphertext or key material.
 */
const base64=bytes=>btoa(String.fromCharCode(...bytes));
const unbase64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function accountKey(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))
  throw new Error('bank_encryption_not_configured');
 const raw=unbase64(value);
 if(raw.length!==32)throw new Error('bank_encryption_not_configured');
 return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function encryptStationBankNumber(number,secret){
 if(typeof number!=='string'||!/^[0-9]{8,20}$/.test(number))
  throw new TypeError('invalid_bank_number');
 const key=await accountKey(secret);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},
  key,new TextEncoder().encode(number)));
 return {ciphertext:'aes256gcm:v1:'+base64(iv)+':'+base64(ciphertext),
  masked:'••••'+number.slice(-4)};
}
export async function decryptStationBankNumber(ciphertext,secret){
 if(typeof ciphertext!=='string')throw new TypeError('invalid_ciphertext');
 const match=/^aes256gcm:v1:([A-Za-z0-9+/]{16}):([A-Za-z0-9+/]{24,80}={0,2})$/.exec(ciphertext);
 if(!match)throw new TypeError('invalid_ciphertext');
 const key=await accountKey(secret);
 const value=new TextDecoder('utf-8',{fatal:true}).decode(
  await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(match[1])},
   key,unbase64(match[2])));
 if(!/^[0-9]{8,20}$/.test(value))throw new TypeError('invalid_ciphertext');
 return value;
}
