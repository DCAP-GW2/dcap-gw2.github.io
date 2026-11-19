import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const ROOT='http://127.0.0.1:8765', API='https://script.google.com/macros/s/TEST_ONLY/exec';
const CACHE='dcap.points.public.v2.production.1.continuous',PARAM='dcapV2Review=private';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=read('points/v2/live-config.mjs');
const selection=JSON.parse(read('points/data/v2/selection.json'));
const delta=JSON.parse(read('points/data/v2/releases/r001.json'));
const feed=()=>{const {revision,kind,...fields}=structuredClone(delta);
 return {...fields,kind:'CONTINUING_PUBLIC_AWARDS_FEED'};};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const result=[],run=async(name,fn)=>{
 try{await fn();result.push({name,pass:true});console.log('PASS',name);}
 catch(e){result.push({name,pass:false,error:String(e?.stack||e)});console.error('FAIL',name,e)}
};
async function env(width=1280,live=true){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 let payload=feed(),status=200,count=0;
 if(live){
  const replacement=config.replace('LIVE_FEED_ENABLED = false','LIVE_FEED_ENABLED = true')
    .replace("LIVE_FEED_URL = ''","LIVE_FEED_URL = '"+API+"'");
  assert(replacement.includes('LIVE_FEED_ENABLED = true'));
  await ctx.route('**/points/v2/live-config.mjs',r=>r.fulfill({
   status:200,contentType:'text/javascript',body:replacement
  }));
  await ctx.route(API,r=>{
   count++;
   return r.fulfill({status,headers:{'content-type':'application/json','access-control-allow-origin':'*'},
    body:status===200?JSON.stringify(payload):'unavailable'});
  });
 }
 const page=await ctx.newPage(),errors=[],requestPaths=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>requestPaths.push(r.url()));
 return {ctx,page,errors,requestPaths,
  setFeed:x=>{payload=x},setStatus:x=>{status=x},requests:()=>count,close:()=>ctx.close()};
}
const url=p=>ROOT+p+(p.includes('?')?'&':'?')+PARAM;
async function visit(e,path='/points/',revision='live'){
 await e.page.goto(url(path),{waitUntil:'load'});
 await e.page.waitForFunction(rev=>window.DCAP_V2_STATUS?.revision===rev,revision,{timeout:20000});
 const st=await e.page.evaluate(()=>window.DCAP_V2_STATUS);
 assert.equal(st.revision,revision);
 assert.equal(st.rewards,false);
 assert.equal(await e.page.locator('main .dcap-v2-production').count(),1);
 return {state:st,text:await e.page.locator('main').innerText()};
}
const views=['/points/','/points/leaderboard/','/points/members/','/points/statistics/','/points/how-points-work/','/points/rewards/'];
const noReleaseCalls=e=>assert(!e.requestPaths.some(x=>/\/releases\/r00[1-9]\.json/.test(x)));

await run('review-branch default has live endpoint disabled and r000 selected',async()=>{
 assert.equal(selection.revision,'r000');assert(config.includes('LIVE_FEED_ENABLED = false'));
 const e=await env(1280,false);try{
  const {text}=await visit(e,'/points/','r000');
  assert(text.includes('1,694 v2 points'));
  noReleaseCalls(e);assert.deepEqual(e.errors,[]);
 }finally{await e.close()}
});
for(const width of [320,390,768,1024,1440]){
 await run('six views responsive with mocked live API at '+width,async()=>{
  const e=await env(width);try{
   for(const path of views){
    const {text}=await visit(e,path);
    assert(text.includes('Approved contributions through 2026-10-26'));
    assert(text.includes('Rewards: DISABLED'));
    assert(!text.includes('Publication revision:'));
    const d=await e.page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert(d.scroll<=d.width+2,'horizontal overflow '+path);
   }
   assert(e.requests()>0);noReleaseCalls(e);assert.deepEqual(e.errors,[]);
  }finally{await e.close()}
 });
}
await run('live totals 1886 / 611 / 37 and original v1 history preserved',async()=>{
 const e=await env();try{
  const {text}=await visit(e);
  for(const term of ['1,886 v2 points','611 approved awards','37 public profiles',
   '2,371 original v1 historical points preserved','Approved public points feed'])assert(text.includes(term),term);
  assert(!text.includes('r001'));
 }finally{await e.close()}
});
await run('leaderboard shows 37 people and profile navigates correctly',async()=>{
 const e=await env();try{
  await visit(e,'/points/leaderboard/');
  assert.equal(await e.page.locator('main tbody tr').count(),37);
  const first=e.page.locator('main a[href*="/points/members/profile/"]').first();
  assert((await first.getAttribute('href')).includes('dcapV2Review=private'));
  await first.click();
  await e.page.waitForFunction(()=>window.DCAP_V2_STATUS?.view==='profile',{timeout:20000});
  assert.match(await e.page.locator('main').innerText(),/points from \d+ awards/);
  assert.deepEqual(e.errors,[]);
 }finally{await e.close()}
});
await run('65 extra approvals propagate after cache expiry without r002',async()=>{
 const e=await env();try{
  await visit(e);
  const x=feed();
  for(let i=0;i<65;i++)x.awards.push({...x.awards[i%60],
   id:'a-c-'+(i+1).toString(16).padStart(24,'0'),eventDate:'2026-10-27'});
  x.source.throughDate='2026-10-27';
  e.setFeed(x);
  await e.page.evaluate(k=>{const c=JSON.parse(localStorage.getItem(k));c.savedAt-=120000;localStorage.setItem(k,JSON.stringify(c))},CACHE);
  const {text}=await visit(e);
  const expected=1694+x.awards.reduce((s,a)=>s+a.points,0);
  assert(text.includes(expected.toLocaleString('en-NZ')+' v2 points'));
  assert(text.includes('676 approved awards'));
  assert(text.includes('2026-10-27'));
  noReleaseCalls(e);
 }finally{await e.close()}
});
await run('HTTP 503 without cache falls back to historic r000',async()=>{
 const e=await env();try{
  e.setStatus(503);
  const {text,state}=await visit(e,'/points/','r000');
  assert.equal(state.state,'last-available');assert(text.includes('1,694 v2 points'));
 }finally{await e.close()}
});
await run('HTTP 503 with stale, valid cache retains last approved totals',async()=>{
 const e=await env();try{
  await visit(e);
  await e.page.evaluate(k=>{const c=JSON.parse(localStorage.getItem(k));c.savedAt-=120000;localStorage.setItem(k,JSON.stringify(c))},CACHE);
  e.setStatus(503);
  const {text,state}=await visit(e);
  assert.equal(state.state,'last-available');assert(text.includes('1,886 v2 points'));
 }finally{await e.close()}
});
await run('tampered API amount is rejected and falls back to r000',async()=>{
 const e=await env();try{
  const x=feed();x.awards[0].points=777;e.setFeed(x);
  const {text}=await visit(e,'/points/','r000');
  assert(text.includes('1,694 v2 points'));
 }finally{await e.close()}
});
await run('API cannot silently retract earlier validated awards',async()=>{
 const e=await env();try{
  await visit(e);
  const x=feed();x.awards=x.awards.slice(0,59);e.setFeed(x);
  await e.page.evaluate(k=>{const c=JSON.parse(localStorage.getItem(k));c.savedAt-=120000;localStorage.setItem(k,JSON.stringify(c))},CACHE);
  const {text,state}=await visit(e);
  assert.equal(state.state,'last-available');assert(text.includes('1,886 v2 points'));
 }finally{await e.close()}
});
await run('rewards remain disabled on live data',async()=>{
 const e=await env();try{
  const {text}=await visit(e,'/points/rewards/');
  assert(text.includes('Rewards are disabled.'));
 }finally{await e.close()}
});
for(const path of views){
 await run('axe serious/critical accessibility '+path,async()=>{
  const e=await env();try{
   await visit(e,path);
   const scan=await new AxeBuilder({page:e.page}).include('main .dcap-v2-production').analyze();
   assert.deepEqual(scan.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);
  }finally{await e.close()}
 });
}
await browser.close();
mkdirSync('test-results',{recursive:true});
const report={suite:'DCAP v2 revision-free live feed mock browser QA',total:result.length,
 passed:result.filter(x=>x.pass).length,failed:result.filter(x=>!x.pass).length,result};
writeFileSync('test-results/points-v2-live-browser.json',JSON.stringify(report,null,2)+'\n');
console.log('LIVE_BROWSER_SUMMARY',JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
if(report.failed)process.exitCode=1;
