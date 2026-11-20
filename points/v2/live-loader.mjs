/**
 * Browser refreshes a single read-only v2 public feed, just like v1.
 * No r001/r002 manifest or GitHub deployment is involved in routine awards.
 * Production read-only endpoint is enabled only by the explicitly approved cutover.
 */
import {loadV2 as loadHistorical} from './loader.mjs';

import {validateOwnerFeed,combineOwnerFeed,OWNER_FEED_KIND} from './owner-feed.mjs';
import {CACHE_KEY} from './config.mjs';
import {LIVE_FEED_ENABLED,LIVE_FEED_URL,LIVE_CACHE_MS,LIVE_TIMEOUT_MS,LIVE_MAX_BYTES} from './live-config.mjs';

const STORAGE_KEY=CACHE_KEY+'.continuous';
const utf8=new TextDecoder('utf-8',{fatal:true});
const bytesFrom=s=>new TextEncoder().encode(s);
const validateFeed=(doc,base)=>{if(doc?.kind!==OWNER_FEED_KIND)throw Error('UNEXPECTED_PUBLIC_FEED');return validateOwnerFeed(doc,base)};
const combineFeed=(base,doc)=>combineOwnerFeed(base,doc);
const safeEndpoint=url=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
function readCache(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');return x&&typeof x==='object'&&!Array.isArray(x)?x:null}catch{return null}
}
function saveCache(x){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(x))}catch{/* Browser privacy modes may block storage */}}
async function acceptedCache(base){
 const c=readCache();
 if(!c||typeof c.text!=='string'||bytesFrom(c.text).byteLength>LIVE_MAX_BYTES||
    !Number.isFinite(c.savedAt)||c.savedAt<0||c.savedAt>Date.now()+1000)return null;
 try{
  const doc=JSON.parse(c.text);validateFeed(doc,base);
  return {feed:doc,merged:combineFeed(base,doc),savedAt:c.savedAt};
 }catch{return null}
}
function previousAwardsPreserved(previous,current){
 if(!previous)return true;
 if(previous.kind!==current.kind||current.awards.length<previous.awards.length)return false;
 const next=new Map(current.awards.map(a=>[a.id,a]));
 if(!previous.awards.every(old=>{const x=next.get(old.id);return x&&JSON.stringify(x)===JSON.stringify(old);}))return false;
 if(previous.kind===OWNER_FEED_KIND){
  // Public source must remain cumulative: no silently retracted members, event IDs or rule versions.
  for(const key of ['members','events','ruleVersions']){
   const m=new Map(current[key].map(x=>[x.id,x]));
   if(!previous[key].every(x=>{const next=m.get(x.id);if(!next)return false;return key==='members' ? x.approvedFrom===next.approvedFrom : JSON.stringify(x)===JSON.stringify(next)}))return false;
  }
 }
 return true;
}
async function boundedResponse(response){
 if(!response.ok)throw Error('LIVE_HTTP');
 const header=response.headers.get('content-length');
 if(header&&(Number(header)>LIVE_MAX_BYTES||Number(header)<0))throw Error('LIVE_LENGTH');
 if(response.body?.getReader){
  const reader=response.body.getReader(),parts=[];let count=0;
  for(;;){const {done,value}=await reader.read();if(done)break;
   count+=value.byteLength;if(count>LIVE_MAX_BYTES){await reader.cancel();throw Error('LIVE_OVERSIZE');}parts.push(value);
  }
  const bytes=new Uint8Array(count);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  return bytes;
 }
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.byteLength>LIVE_MAX_BYTES)throw Error('LIVE_OVERSIZE');
 return bytes;
}
async function requestFeed(){
 const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),LIVE_TIMEOUT_MS);
 try{
  const response=await fetch(LIVE_FEED_URL,{
   method:'GET',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',
   referrerPolicy:'no-referrer',signal:stop.signal
  });
  const bytes=await boundedResponse(response),doc=JSON.parse(utf8.decode(bytes));
  return {doc,text:utf8.decode(bytes)};
 }finally{clearTimeout(timer)}
}
export async function loadV2(){
 const hist=await loadHistorical();
 if(!hist.data)return hist;
 const baseline=hist.data;
 if(!LIVE_FEED_ENABLED||!safeEndpoint(LIVE_FEED_URL))return hist;

 const cache=await acceptedCache(baseline);
 if(cache&&Date.now()-cache.savedAt<LIVE_CACHE_MS&&Date.now()>=cache.savedAt){
  return {state:'current-cache',source:'browser-cache',revision:'live',
   data:cache.merged};
 }
 try{
  const {doc,text}=await requestFeed();
  validateFeed(doc,baseline);
  if(cache&&!previousAwardsPreserved(cache.feed,doc))throw Error('NON_MONOTONIC_PUBLIC_AWARDS');
  const merged=combineFeed(baseline,doc);
  saveCache({text,savedAt:Date.now()});
  return {state:'primary',source:'approved-read-only-feed',revision:'live',data:merged};
 }catch{
  // Rejected/offline feeds never appear, and no private diagnostics are logged.
  if(cache)return {state:'last-available',source:'browser-last-available',revision:'live',data:cache.merged};
  return {state:'last-available',source:'pinned-historical-r000',revision:'r000',data:baseline};
 }
}
