/**
 * PUBLIC READ-ONLY ENDPOINT DIAGNOSTIC.
 * Intentionally runs in GitHub Actions with no credentials and no writes.
 * Logs only scalar pass/fail measurements; never source IDs, raw JSON or PII.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';
const endpoint=process.env.DCAP_V2_PUBLIC_READONLY_URL;
assert(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint||''),
 'Only an explicitly selected public Google Apps Script /exec URL may be read');
const baseline=JSON.parse(readFileSync(new URL('../points/data/v2/releases/r000.json',import.meta.url),'utf8'));
const report={stage:'DCAP_V2_READONLY_ENDPOINT_REAL_HTTPS_CORS',checks:{},publicData:null};
const check=(label,condition,detail)=>{report.checks[label]={passed:!!condition,...(detail?{detail}: {})};return condition};
let payload;
try{
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 let response;
 try{
  response=await fetch(endpoint,{method:'GET',redirect:'follow',cache:'no-store',
   headers:{'accept':'application/json'},signal:controller.signal});
 }finally{clearTimeout(timeout)}
 check('https_status',response.ok,{status:response.status});
 check('redirect_destination',new URL(response.url).protocol==='https:');
 report.responseMetadata={finalHostname:new URL(response.url).hostname,
  mimeType:(response.headers.get('content-type')||'').split(';')[0],
  redirected:response.redirected};
 const text=await response.text();
 if(text.trim().startsWith('<')){
  const title=text.match(/<title[^>]*>([^<]{0,120})<\/title>/i)?.[1]||null;
  report.responseMetadata.htmlTitle=title;
  report.responseMetadata.signInHint=/sign in|sign-in|accounts.google|login/i.test(text);
  report.responseMetadata.errorHint=/script function not found|page not found|authorization required|access denied|file you have requested/i.test(text);
 }
 report.responseMetadata.length=text.length;
 check('response_size',text.length<2000000);
 if(response.ok && text.length<2000000){
  try{payload=JSON.parse(text)}catch{check('parse_json',false)}
 }else check('parse_json',false);
 if(payload)check('parse_json',true);
 if(payload){
  check('response_kind',payload.kind==='CONTINUING_PUBLIC_OWNER_FEED');
  check('schema_version',payload.schemaVersion===2);
  check('sanitised_shape',!['ownerDecisionRef','candidateKey','approvedBy','sourceMessageId','sourceReference',
   'spreadsheetId','journalId','registryId'].some(k=>text.includes('"'+k+'"')));
  try{
   const validated=validateOwnerFeed(payload,baseline);
   const merged=combineOwnerFeed(baseline,payload);
   report.publicData={
    continuingAwards:validated.awards,continuingPoints:validated.points,
    totalAwards:merged.population.awardCandidateCount,
    totalPoints:merged.population.candidatePoints,
    publicProfiles:merged.members.length,
    rewardsEnabled:merged.rewardsEnabled
   };
   check('contract_and_points',validated.awards===60&&validated.points===192 &&
    merged.population.awardCandidateCount===611&&
    merged.population.candidatePoints===1886&&
    merged.members.length===37&&merged.rewardsEnabled===false);
  }catch(e){check('contract_and_points',false,{reason:String(e?.message||e).slice(0,85)})}
 }
}catch(e){check('node_https_fetch',false,{reason:String(e?.name||'FETCH_FAILED').slice(0,40)})}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function browserProbe(origin,label){
 const context=await browser.newContext();
 const page=await context.newPage();
 try{
  const nav=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:25000});
  if(!check(label+'_navigation',Boolean(nav?.ok()),{status:nav?.status()??0}))return;
  const result=await page.evaluate(async url=>{
   const stopper=new AbortController();
   const timeout=setTimeout(()=>stopper.abort(),22000);
   try{
    const response=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
     redirect:'follow',referrerPolicy:'no-referrer',signal:stopper.signal});
    let text=await response.text();
    let obj=null;try{obj=JSON.parse(text)}catch{}
    return {ok:response.ok,validShape:obj?.kind==='CONTINUING_PUBLIC_OWNER_FEED',
     status:response.status,exposed:typeof text==='string'&&text.length<2000000};
   }catch(e){return{ok:false,reason:e?.name||'CORS_OR_NETWORK_FAILED'}}
   finally{clearTimeout(timeout)}
  },endpoint);
  check(label+'_cors',result.ok&&result.validShape&&result.exposed,{
   status:result.status??null,...(result.reason?{reason:result.reason}: {})
  });
 }catch(e){check(label+'_navigation',false,{reason:e?.name||'NAVIGATION_FAILED'})}
 finally{await context.close()}
}
await browserProbe('http://127.0.0.1:8765/points/','localhost_origin');
await browserProbe('https://dcap-gw2.github.io/','production_origin');
await browser.close();
console.log('DCAP_V2_PUBLIC_HTTPS_CORS_REPORT '+JSON.stringify(report));
if(Object.values(report.checks).some(x=>!x.passed))process.exitCode=1;
