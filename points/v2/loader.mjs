import {CONTRACT,CACHE_KEY,CACHE_MS,MAX_BYTES,HISTORICAL_ONLY,HISTORICAL_REVISION,HISTORICAL_SHA256,HISTORICAL_PATH} from './config.mjs';
import {validateV2} from './validate.mjs';
const RELEASE_RE=/^\/points\/data\/v2\/releases\/r[0-9]{3,8}\.json$/;
const HEX=/^[0-9a-f]{64}$/;
const utf8=new TextDecoder('utf-8',{fatal:true});
const bytesHex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export async function hashBytes(bytes){return bytesHex(await crypto.subtle.digest('SHA-256',bytes));}
async function bounded(response){
 if(!response.ok)throw Error('HTTP_'+response.status);
 const declared=response.headers.get('content-length');if(declared && Number(declared)>MAX_BYTES)throw Error('OVERSIZE_HEADER');
 if(response.body?.getReader){const reader=response.body.getReader();const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Error('OVERSIZE_BODY');}chunks.push(value)}
  const data=new Uint8Array(size);let at=0;for(const c of chunks){data.set(c,at);at+=c.byteLength;}return data;
 }
 const data=new Uint8Array(await response.arrayBuffer());if(data.byteLength>MAX_BYTES)throw Error('OVERSIZE_BODY');return data;
}
export function verifySelection(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||s.contractVersion!==CONTRACT||typeof s.revision!=='string'||!/^r[0-9]{3,8}$/.test(s.revision)||!HEX.test(s.sha256))throw Error('INVALID_SELECTION');
 if(s.path!==`/points/data/v2/releases/${s.revision}.json`||!RELEASE_RE.test(s.path))throw Error('INVALID_SELECTION_PATH');
 if(!s.lastKnownGood||typeof s.lastKnownGood!=='object'||!/^r[0-9]{3,8}$/.test(s.lastKnownGood.revision)||!HEX.test(s.lastKnownGood.sha256)||s.lastKnownGood.path!==`/points/data/v2/releases/${s.lastKnownGood.revision}.json`||Number(s.lastKnownGood.revision.slice(1))>Number(s.revision.slice(1)))throw Error('INVALID_FALLBACK');
 if(!HISTORICAL_ONLY || s.revision!==HISTORICAL_REVISION || s.sha256!==HISTORICAL_SHA256 || s.path!==HISTORICAL_PATH || s.lastKnownGood.revision!==HISTORICAL_REVISION || s.lastKnownGood.sha256!==HISTORICAL_SHA256 || s.lastKnownGood.path!==HISTORICAL_PATH)throw Error('HISTORICAL_ONLY_SELECTOR_REQUIRED');
 return s;
}
function cacheGet(){try{const v=localStorage.getItem(CACHE_KEY);return v?JSON.parse(v):null}catch{return null}}
function cachePut(v){try{localStorage.setItem(CACHE_KEY,JSON.stringify(v))}catch{/* Storage disabled: no promotion */}}
function bind(entry,choice){return entry?.revision===choice.revision&&entry?.sha256===choice.sha256;}
async function accepted(raw,expected){
 if(!raw||typeof raw!=='object'||!bind(raw,expected)||!Number.isFinite(raw.savedAt)||raw.savedAt>Date.now()+1000)return null;
 const body=new TextEncoder().encode(raw.text);
 if(body.length>MAX_BYTES||await hashBytes(body)!==expected.sha256)return null;
 try{const doc=JSON.parse(raw.text);validateV2(doc);return doc}catch{return null}
}
async function request(url,deadline){
 if(!url.startsWith('/points/data/v2/'))throw Error('BAD_PREFIX');
 const a=new AbortController();const timer=setTimeout(()=>a.abort(),deadline);
 try{const r=await fetch(url,{method:'GET',mode:'same-origin',credentials:'omit',cache:'no-store',signal:a.signal});return bounded(r)}finally{clearTimeout(timer)}
}
async function download(choice){const data=await request(choice.path,15000);const sum=await hashBytes(data);if(sum!==choice.sha256)throw Error('CHECKSUM_MISMATCH');const text=utf8.decode(data);const doc=JSON.parse(text);validateV2(doc);cachePut({revision:choice.revision,sha256:choice.sha256,text,savedAt:Date.now()});return doc;}
export async function loadV2(){
 // Always pin the approved r000, even if selector is unavailable or tampered.
 const pinned=Object.freeze({revision:HISTORICAL_REVISION,sha256:HISTORICAL_SHA256,path:HISTORICAL_PATH,lastKnownGood:Object.freeze({revision:HISTORICAL_REVISION,sha256:HISTORICAL_SHA256,path:HISTORICAL_PATH})});
 let selection=pinned;let selectorVerified=false;
 try{const raw=await request('/points/data/v2/selection.json',15000);selection=verifySelection(JSON.parse(utf8.decode(raw)));selectorVerified=true;}catch{/* Only exact approved pinned r000 may be used. */}
 const cached=cacheGet();
 if(cached&&bind(cached,selection)&&Date.now()-cached.savedAt<CACHE_MS){const doc=await accepted(cached,selection);if(doc)return {state:selectorVerified?'current-cache':'last-available',data:doc,revision:selection.revision,source:selectorVerified?'browser-cache':'pinned-cache'}}
 try{const doc=await download(selection);return {state:selectorVerified?'primary':'last-available',data:doc,revision:selection.revision,source:selectorVerified?'primary':'pinned-r000'}}catch{}
 const fallback=selection.lastKnownGood;
 try{const doc=await download(fallback);return {state:'last-available',data:doc,revision:fallback.revision,source:'static-lkg'}}catch{}
 if(cached&&(bind(cached,selection)||bind(cached,fallback))){const expected=bind(cached,selection)?selection:fallback;const doc=await accepted(cached,expected);if(doc)return {state:'last-available',data:doc,revision:expected.revision,source:'browser-lkg'}}
 return {state:'unavailable',data:null,reason:'sources'};
}
