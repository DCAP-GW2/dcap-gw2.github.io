/**
 * Browser refreshes a single read-only v2 public feed, just like v1.
 * No r001/r002 manifest or GitHub deployment is involved in routine awards.
 * No live endpoint is configured or contacted until a separately approved cutover.
 */
import {loadV2 as loadHistorical} from './loader.mjs';
import {validateLiveFeed,combineLiveFeed} from './live-feed.mjs';
import {CACHE_KEY} from './config.mjs';
import {LIVE_FEED_ENABLED,LIVE_FEED_URL,LIVE_CACHE_MS,LIVE_TIMEOUT_MS,LIVE_MAX_BYTES} from './live-config.mjs';

const STORAGE_KEY=CACHE_KEY+'.continuous';
const utf8=new TextDecoder('utf-8',{fatal:true});
const bytesFrom=s=>new TextEncoder().encode(s);
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
  const doc=JSON.parse(c.text);validateLiveFeed(doc,base);
  return {feed:doc,merged:combineLiveFeed(base,doc),savedAt:c.savedAt};
 }catch{return null}
}
function previousAwardsPreserved(previous,current){
 if(!previous)return true;
 if(current.awards.length<previous.awards.length)return false;
 const next=new Map(current.awards.map(a=>[a.id,a]));
 return previous.awards.every(old=>{
  const currentAward=next.get(old.id);
  return currentAward&&JSON.stringify(currentAward)===JSON.stringify(old);
 });
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
  validateLiveFeed(doc,baseline);
  if(cache&&!previousAwardsPreserved(cache.feed,doc))throw Error('NON_MONOTONIC_PUBLIC_AWARDS');
  const merged=combineLiveFeed(baseline,doc);
  saveCache({text,savedAt:Date.now()});
  return {state:'primary',source:'approved-read-only-feed',revision:'live',data:merged};
 }catch{
  // Rejected/offline feeds never appear, and no private diagnostics are logged.
  if(cache)return {state:'last-available',source:'browser-last-available',revision:'live',data:cache.merged};
  return {state:'last-available',source:'pinned-historical-r000',revision:'r000',data:baseline};
 }
}
