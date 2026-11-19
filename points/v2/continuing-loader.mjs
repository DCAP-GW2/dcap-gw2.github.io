/* Continuing season is an additive public delta. Historical r000 remains verified by loader.mjs. */
import {loadV2 as loadHistorical,hashBytes} from './loader.mjs';
import {combineContinuing,validateContinuing} from './continuing.mjs';
import {CONTRACT,CACHE_KEY,MAX_BYTES,HISTORICAL_REVISION,HISTORICAL_SHA256,HISTORICAL_PATH,CACHE_MS} from './config.mjs';
const CACHE_DELTA_KEY=CACHE_KEY+'.continuing';
// Only a release digest embedded in the reviewed client can authenticate an offline cache.
// Add the digest of each newly approved public release here at publication time.
const TRUSTED_OFFLINE_SHA256=Object.freeze({r001:'c7f3478b530e589807a10aeb2501b8543036d7ed8227f61cbbe4f4549ce060f4'});
const HEX=/^[0-9a-f]{64}$/;
const RELEASE=/^r[0-9]{3,8}$/;
const utf8=new TextDecoder('utf-8',{fatal:true});
const rank=r=>Number(r.slice(1));
function readCache(){try{const x=JSON.parse(localStorage.getItem(CACHE_DELTA_KEY)||'null');return x&&typeof x==='object'?x:null}catch{return null}}
function saveCache(c){try{localStorage.setItem(CACHE_DELTA_KEY,JSON.stringify(c))}catch{/* Private browsing still works. */}}
async function getBytes(path){
 if(!path.startsWith('/points/data/v2/')||path.includes('..'))throw Error('BAD_URL');
 const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),15000);
 try{
  const response=await fetch(path,{method:'GET',mode:'same-origin',credentials:'omit',cache:'no-store',signal:stop.signal});
  if(!response.ok)throw Error('HTTP_'+response.status);
  const len=response.headers.get('content-length');
  if(len&&Number(len)>MAX_BYTES)throw Error('OVERSIZE_HEADER');
  if(response.body?.getReader){
   const reader=response.body.getReader(),parts=[];let total=0;
   for(;;){const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw Error('OVERSIZE_DATA');}
    parts.push(value);
   }
   const bytes=new Uint8Array(total);let offset=0;
   for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
   return bytes;
  }
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>MAX_BYTES)throw Error('OVERSIZE_DATA');
  return bytes;
 }finally{clearTimeout(timer)}
}
async function verifiedText(bytes,sha){if(await hashBytes(bytes)!==sha)throw Error('CHECKSUM_MISMATCH');return utf8.decode(bytes)}
export function verifyContinuingSelection(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).sort().join('|')!==['contractVersion','revision','path','sha256','lastKnownGood'].sort().join('|')||s.contractVersion!==CONTRACT||typeof s.revision!=='string'||!RELEASE.test(s.revision)||typeof s.sha256!=='string'||!HEX.test(s.sha256)||s.path!=='/points/data/v2/releases/'+s.revision+'.json')throw Error('INVALID_SELECTION');
 const good=s.lastKnownGood;
 if(!good||Object.keys(good).sort().join('|')!==['revision','path','sha256'].sort().join('|')||good.revision!==HISTORICAL_REVISION||good.path!==HISTORICAL_PATH||good.sha256!==HISTORICAL_SHA256)throw Error('BAD_HISTORICAL_FALLBACK');
 if(s.revision===HISTORICAL_REVISION&&(s.sha256!==HISTORICAL_SHA256||s.path!==HISTORICAL_PATH))throw Error('BASELINE_PIN_CHANGED');
 if(rank(s.revision)<rank(HISTORICAL_REVISION))throw Error('ROLLBACK');
 return s;
}
async function cachedDelta(base,expected=null){
 const c=readCache();
 if(!c||typeof c.text!=='string'||typeof c.revision!=='string'||!RELEASE.test(c.revision)||!HEX.test(c.sha256)||c.text.length>MAX_BYTES||!Number.isFinite(c.savedAt)||c.savedAt>Date.now()+1000)return null;
 const trusted=expected
  ? c.revision===expected.revision&&c.sha256===expected.sha256
  : TRUSTED_OFFLINE_SHA256[c.revision]===c.sha256;
 if(!trusted)return null;
 try{
  const text=await verifiedText(new TextEncoder().encode(c.text),c.sha256),delta=JSON.parse(text);
  if(delta.revision!==c.revision)throw Error('CACHE_REVISION');
  validateContinuing(delta,base);
  return {data:combineContinuing(base,delta),revision:c.revision,savedAt:c.savedAt};
 }catch{return null}
}
export async function loadV2(){
 const historical=await loadHistorical();
 if(!historical.data)return historical;
 const baseline=historical.data;
 let selection=null;
 try{selection=verifyContinuingSelection(JSON.parse(utf8.decode(await getBytes('/points/data/v2/selection.json'))))}catch{}
 // The network selector is authoritative for controlled rollback. With an outage,
 // accept only an offline-cache digest pinned in this reviewed client.
 const cache=selection?.revision===HISTORICAL_REVISION?null:await cachedDelta(baseline,selection);
 if(selection?.revision===HISTORICAL_REVISION){
  return {state:historical.state,source:historical.source,revision:HISTORICAL_REVISION,data:baseline};
 }
 if(!selection){
  if(cache)return {state:'last-available',source:'browser-last-available',revision:cache.revision,data:cache.data};
  return {state:'last-available',source:historical.source,revision:HISTORICAL_REVISION,data:baseline};
 }
 if(cache&&cache.revision===selection.revision&&Date.now()-cache.savedAt<CACHE_MS){
  return {state:'current-cache',source:'browser-cache',revision:cache.revision,data:cache.data};
 }
 try{
  const text=await verifiedText(await getBytes(selection.path),selection.sha256);
  const delta=JSON.parse(text);
  if(delta.revision!==selection.revision)throw Error('REVISION_MISMATCH');
  validateContinuing(delta,baseline);
  const merged=combineContinuing(baseline,delta);
  saveCache({text,revision:delta.revision,sha256:selection.sha256,savedAt:Date.now()});
  return {state:'primary',source:'verified-public-delta',revision:delta.revision,data:merged};
 }catch{}
 if(cache)return {state:'last-available',source:'browser-last-available',revision:cache.revision,data:cache.data};
 return {state:'last-available',source:historical.source,revision:HISTORICAL_REVISION,data:baseline};
}
