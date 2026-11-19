import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const ROOT='http://127.0.0.1:8765', API='https://script.google.com/macros/s/TEST_OWNER_ONLY/exec';
const CACHE='dcap.points.public.v2.production.1.continuous';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=read('points/v2/live-config.mjs');
const old=JSON.parse(read('points/data/v2/releases/r001.json'));
const seed={id:'dbs-commander-initial-2026-10-22',ruleId:'N5E-DBS-COMMANDER-2',eventId:'dbs',roleId:'commander',points:2,effectiveFrom:'2026-10-22'};
const memberID='m-000000000000cafe';
const data=()=>{
 const {revision,kind,ruleAmendments,...rest}=structuredClone(old);
 return {...rest,kind:'CONTINUING_PUBLIC_OWNER_FEED',schemaVersion:2,
  members:[],events:[],ruleVersions:[structuredClone(seed)]};
};
const newMember=(f)=>{
 f.members.push({id:memberID,displayName:'New Commander',approvedFrom:'2026-11-19'});
 f.events.push({id:'legendary-ley-line-anomaly',label:'Legendary Ley-Line Anomaly'});
 f.awards.push({id:'a-c-000000000000000000000001',memberId:memberID,
  eventId:'legendary-ley-line-anomaly',roleId:'other-commander',ruleId:null,
  eventDate:'2026-11-19',cycleId:0,points:4,provenanceType:'OWNER_MANUAL_OTHER_COMMANDER'});
 f.source.throughDate='2026-11-19';return f;
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[];
const run=async(name,fn)=>{
 try{const extra=await fn();cases.push({name,passed:true,extra:extra||null});console.log('PASS',name)}
 catch(e){cases.push({name,passed:false,error:String(e?.stack||e)});console.error('FAIL',name,e)}
};
async function env(width=1280,live=true){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 let payload=data(),status=200;
 if(live){
  const simulated=config.replace('LIVE_FEED_ENABLED = false','LIVE_FEED_ENABLED = true')
   .replace("LIVE_FEED_URL = ''","LIVE_FEED_URL = '"+API+"'");
  await ctx.route('**/points/v2/live-config.mjs',r=>r.fulfill({status:200,contentType:'text/javascript',body:simulated}));
  await ctx.route(API,r=>r.fulfill({status,body:status===200?JSON.stringify(payload):'unavailable',
   headers:{'content-type':'application/json','access-control-allow-origin':'*'}}));
 }
 const page=await ctx.newPage(),errors=[],releases=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',req=>{if(/\/points\/data\/v2\/releases\/r00[1-9]/.test(req.url()))releases.push(req.url())});
 return {ctx,page,errors,releases,setPayload:p=>payload=p,setStatus:s=>status=s,close:()=>ctx.close()};
}
const route=path=>ROOT+path+(path.includes('?')?'&':'?')+'dcapV2Review=private';
async function visit(e,path='/points/',expected='live'){
 await e.page.goto(route(path),{waitUntil:'load'});
 await e.page.waitForFunction(x=>window.DCAP_V2_STATUS?.revision===x,expected,{timeout:20000});
 const state=await e.page.evaluate(()=>window.DCAP_V2_STATUS);
 assert.equal(state.revision,expected);assert.equal(state.rewards,false);
 return {state,text:await e.page.locator('main').innerText()};
}
const main=['/points/','/points/leaderboard/','/points/members/','/points/statistics/','/points/how-points-work/','/points/rewards/'];
await run('unchanged selector and disabled live config show pinned r000',async()=>{
 assert(config.includes('LIVE_FEED_ENABLED = false'));
 const selection=JSON.parse(read('points/data/v2/selection.json'));
 assert.equal(selection.revision,'r000');
 const e=await env(1280,false);
 try{const {text}=await visit(e,'/points/','r000');
  assert(text.includes('1,694 v2 points'));assert.deepEqual(e.errors,[])
 }finally{await e.close()}
});
for(const width of [320,390,768,1024,1440]){
 await run('v2 owner registry six public views on '+width+'px',async()=>{
  const e=await env(width);
  try{
   for(const path of main){
    const {text}=await visit(e,path);
    assert(text.includes('Rewards: DISABLED'));
    assert(!text.includes('Committee-approved v2.0 rules'));
    const doc=await e.page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert(doc.scroll<=doc.width+2,'overflow on '+path);
   }
   assert.deepEqual(e.errors,[]);assert.deepEqual(e.releases,[]);
  }finally{await e.close()}
 });
}
await run('55 old and five DBS awards still give 1886 / 611 / 37',async()=>{
 const e=await env();try{
  const {text}=await visit(e);
  for(const s of ['1,886 v2 points','611 approved awards','37 public profiles',
    '2,371 original v1 historical points preserved'])assert(text.includes(s),s);
 }finally{await e.close()}
});
await run('38th dynamic member and manual Other Commander show on all relevant pages',async()=>{
 const e=await env();try{
  e.setPayload(newMember(data()));
  const {text}=await visit(e);
  assert(text.includes('1,890 v2 points'));assert(text.includes('612 approved awards'));assert(text.includes('38 public profiles'));
  await visit(e,'/points/members/');
  assert.equal(await e.page.locator('main tbody tr').count(),38);
  await visit(e,'/points/members/profile/?member='+memberID);
  const profile=await e.page.locator('main').innerText();
  assert(profile.includes('4 points from 1 awards'));
  assert(profile.includes('Owner-assigned Other Commander'));
  assert(profile.includes('Legendary Ley-Line Anomaly'));
  await visit(e,'/points/statistics/');
  const stat=await e.page.locator('main').innerText();
  assert(stat.includes('Legendary Ley-Line Anomaly'));
  assert.deepEqual(e.errors,[]);assert.deepEqual(e.releases,[]);
 }finally{await e.close()}
});
await run('4-point owner rule only applies prospectively in displayed rules',async()=>{
 const e=await env();try{
  const f=data();f.ruleVersions.push({id:'tt-commander-2026-11-19',ruleId:'V2-05',eventId:'triple-trouble',
   roleId:'commander',points:4,effectiveFrom:'2026-11-19'});
  f.awards.push({id:'a-c-000000000000000000000002',memberId:JSON.parse(read('points/data/v2/releases/r000.json')).members[0].id,
   eventId:'triple-trouble',roleId:'commander',ruleId:'V2-05',
   eventDate:'2026-11-19',cycleId:0,points:4,provenanceType:'APPROVED_RULE'});
  f.source.throughDate='2026-11-19';e.setPayload(f);
  await visit(e,'/points/how-points-work/');
  const txt=await e.page.locator('main').innerText();
  assert(txt.includes('Owner-approved v2.0 rules'));
  assert(txt.includes('Other Commander has no default points'));
  assert(txt.includes('Triple Trouble'));
  assert.deepEqual(e.errors,[]);
 }finally{await e.close()}
});
await run('invalid manual award over an existing commander rule fails closed to r000',async()=>{
 const e=await env();try{
  const f=data();
  f.awards.push({id:'a-c-000000000000000000000002',memberId:JSON.parse(read('points/data/v2/releases/r000.json')).members[0].id,
   eventId:'triple-trouble',roleId:'other-commander',ruleId:null,
   eventDate:'2026-11-19',cycleId:0,points:4,provenanceType:'OWNER_MANUAL_OTHER_COMMANDER'});
  f.source.throughDate='2026-11-19';e.setPayload(f);
  const {text,state}=await visit(e,'/points/','r000');
  assert.equal(state.state,'last-available');assert(text.includes('1,694 v2 points'));
 }finally{await e.close()}
});
await run('new owner member cannot disappear from a previously validated cached feed',async()=>{
 const e=await env();try{
  e.setPayload(newMember(data()));
  await visit(e);
  await e.page.evaluate(k=>{const c=JSON.parse(localStorage.getItem(k));c.savedAt-=120000;localStorage.setItem(k,JSON.stringify(c))},CACHE);
  e.setPayload(data());
  const {state,text}=await visit(e);
  assert.equal(state.state,'last-available');assert(text.includes('38 public profiles'));
 }finally{await e.close()}
});
for(const path of main){
 await run('axe serious/critical dynamic feed '+path,async()=>{
  const e=await env();try{
   e.setPayload(newMember(data()));
   await visit(e,path);
   const result=await new AxeBuilder({page:e.page}).include('main .dcap-v2-production').analyze();
   assert.deepEqual(result.violations.filter(x=>['serious','critical'].includes(x.impact)).map(x=>x.id),[]);
  }finally{await e.close()}
 });
}
await browser.close();
mkdirSync('test-results',{recursive:true});
const report={suite:'DCAP v2 owner-dynamic offline Chromium suite',total:cases.length,
 passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,cases};
writeFileSync('test-results/points-v2-owner-browser.json',JSON.stringify(report,null,2)+'\n');
console.log('OWNER_BROWSER_SUMMARY',JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
if(report.failed)process.exitCode=1;
