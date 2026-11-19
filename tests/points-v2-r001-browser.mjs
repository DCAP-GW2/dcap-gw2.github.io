import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const ROOT='http://127.0.0.1:8765';
const PARAM='dcapV2Review=private';
const CACHE='dcap.points.public.v2.production.1.continuing';
const HIST_SHA='2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73';
const stagedSelection=JSON.parse(readFileSync(new URL('../points/data/v2/selection.json',import.meta.url),'utf8'));
const deltaSha=createHash('sha256').update(readFileSync(new URL('../points/data/v2/releases/r001.json',import.meta.url))).digest('hex');
const selection={...stagedSelection,revision:'r001',path:'/points/data/v2/releases/r001.json',sha256:deltaSha};
assert.equal(stagedSelection.revision,'r000','staging must not activate r001 in its on-disk selection');
const originalV1Points=JSON.parse(readFileSync(new URL('../points/data/v2/releases/r000.json',import.meta.url),'utf8')).population.originalPoints;
const cases=[],browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failCase=(name,error)=>{cases.push({name,status:'FAIL',error:String(error?.stack||error)});console.error('FAIL',name,error)};
async function run(name,fn){
 try{const details=await fn();cases.push({name,status:'PASS',details:details||null});console.log('PASS',name)}
 catch(e){failCase(name,e)}
}
async function env(width=1280, simulateR001=true){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 // Simulate future selection solely in the browser; on-disk stage stays pinned to r000.
 if(simulateR001)await context.route('**/points/data/v2/selection.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(selection)}));
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 return {context,page,errors,close:()=>context.close()};
}
function route(path='/points/'){return ROOT+path+(path.includes('?')?'&':'?')+PARAM;}
async function current(page,path='/points/',revision='r001'){
 await page.goto(route(path),{waitUntil:'load'});
 await page.waitForFunction(rev=>window.DCAP_V2_STATUS?.revision===rev,revision,{timeout:20000});
 const state=await page.evaluate(()=>window.DCAP_V2_STATUS);
 assert.equal(state.revision,revision);
 assert.equal(state.rewards,false);
 assert.equal(await page.locator('main .dcap-v2-production').count(),1);
 return state;
}
async function unexpectedErrors(e){assert.deepEqual(e,[],'Uncaught JavaScript errors')}
const views=[
 ['/points/','overview'],
 ['/points/leaderboard/','leaderboard'],
 ['/points/members/','members'],
 ['/points/statistics/','statistics'],
 ['/points/how-points-work/','how'],
 ['/points/rewards/','rewards']
];
await run('staged static website defaults to r000 without selector override',async()=>{
 const e=await env(1280,false);
 try{
  const state=await current(e.page,'/points/','r000');
  assert.equal(state.revision,'r000');
  assert.match(await e.page.locator('main').innerText(),/1,694 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
for(const width of [320,390,768,1024,1440]){
 await run('responsive six views at '+width+'px',async()=>{
  const e=await env(width);
  try{
   for(const [path,view] of views){
    const st=await current(e.page,path);
    assert.equal(st.view,view);
    assert.match(await e.page.locator('main').innerText(),/Publication revision: r001/);
    const overflow=await e.page.evaluate(()=>({
     doc:document.documentElement.scrollWidth,view:innerWidth
    }));
    assert(overflow.doc <= overflow.view+2,'horizontal page overflow on '+view+': '+JSON.stringify(overflow));
   }
   await unexpectedErrors(e.errors);
   return {width,pages:views.length};
  }finally{await e.close()}
 });
}
await run('overview published totals, date-only label, v1 preservation and disabled rewards',async()=>{
 const e=await env();
 try{
  await current(e.page);
  const text=await e.page.locator('main').innerText();
  for(const x of ['1,886 v2 points','611 approved awards','37 public profiles',new Intl.NumberFormat('en-NZ').format(originalV1Points)+' original v1 historical points preserved','2026-10-26','Rewards: DISABLED'])
   assert(text.includes(x),'missing '+x);
  assert(!text.includes('private journal'));
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('leaderboard has 37 validated member rows and tied ranks',async()=>{
 const e=await env();
 try{
  await current(e.page,'/points/leaderboard/');
  const trs=e.page.locator('main .dcap-v2-table tbody tr');
  assert.equal(await trs.count(),37);
  const entries=await trs.evaluateAll(rows=>rows.map(row=>({
   rank:Number(row.cells[0]?.innerText),points:Number(row.cells[2]?.innerText.replace(/,/g,''))
  })));
  for(const a of entries)assert.equal(a.rank,1+entries.filter(b=>b.points>a.points).length);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('directory 37 profiles and search safely filters names',async()=>{
 const e=await env();
 try{
  await current(e.page,'/points/members/');
  const rows=e.page.locator('main .dcap-v2-table tbody tr');
  assert.equal(await rows.count(),37);
  await e.page.locator('main input[type="search"]').fill('___NO_SUCH_MEMBER___');
  assert.equal(await rows.count(),0);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('profile link preserves private preview route, member totals and history',async()=>{
 const e=await env();
 try{
  await current(e.page);
  const link=e.page.locator('main a[href*="/points/members/profile/"]').first();
  const href=await link.getAttribute('href');
  assert(href.includes('dcapV2Review=private'));
  assert(href.includes('member='));
  await link.click();
  await e.page.waitForFunction(()=>window.DCAP_V2_STATUS?.view==='profile',{timeout:20000});
  assert.equal(await e.page.locator('main h1').count(),1);
  const text=await e.page.locator('main').innerText();
  assert.match(text,/points from \d+ awards/);
  assert.match(text,/Publication revision: r001/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('rules preserve TBD Other Commander and the 2-point DBS Commander amendment',async()=>{
 const e=await env();
 try{
  await current(e.page,'/points/how-points-work/');
  const text=await e.page.locator('main').innerText();
  assert(text.includes('Other Commander'));
  assert(text.includes('TBD'));
  const rows=await e.page.locator('main .dcap-v2-table tbody tr').allTextContents();
  assert(rows.some(x=>x.includes('DBS')&&x.includes('Commander')&&x.includes('2')));
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('rewards page cannot display an entitlement',async()=>{
 const e=await env();
 try{
  await current(e.page,'/points/rewards/');
  assert.match(await e.page.locator('main').innerText(),/Rewards are disabled/);
  assert.equal(await e.page.locator('main button').count(),0);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('missing r001 payload with no cached delta shows last-known-good r000',async()=>{
 const e=await env();
 try{
  await e.page.route('**/points/data/v2/releases/r001.json',r=>r.fulfill({status:503,body:'unavailable'}));
  const state=await current(e.page,'/points/','r000');
  assert.equal(state.state,'last-available');
  assert.match(await e.page.locator('main').innerText(),/1,694 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('cached stale verified r001 remains visible when its endpoint fails',async()=>{
 const e=await env();
 try{
  await current(e.page);
  await e.page.evaluate(k=>{const c=JSON.parse(localStorage.getItem(k));c.savedAt=Date.now()-120000;localStorage.setItem(k,JSON.stringify(c))},CACHE);
  await e.page.route('**/points/data/v2/releases/r001.json',r=>r.fulfill({status:503,body:'unavailable'}));
  const state=await current(e.page);
  assert.equal(state.state,'last-available');
  assert.match(await e.page.locator('main').innerText(),/1,886 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('missing selector displays only a known pinned verified cached r001',async()=>{
 const e=await env();
 try{
  await current(e.page);
  await e.page.route('**/points/data/v2/selection.json',r=>r.fulfill({status:503,body:'unavailable'}));
  const state=await current(e.page);
  assert.equal(state.state,'last-available');
  assert.match(await e.page.locator('main').innerText(),/1,886 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('explicit selector rollback r001 to r000 defeats previously cached r001',async()=>{
 const e=await env();
 try{
  await current(e.page);
  const reverted={...selection,revision:'r000',path:'/points/data/v2/releases/r000.json',sha256:HIST_SHA};
  await e.page.route('**/points/data/v2/selection.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reverted)}));
  const state=await current(e.page,'/points/','r000');
  assert.match(await e.page.locator('main').innerText(),/1,694 v2 points/);
  assert.equal(state.revision,'r000');
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('bad selector digest never promotes an unverified r001',async()=>{
 const e=await env();
 try{
  const bad={...selection,sha256:'0'.repeat(64)};
  await e.page.route('**/points/data/v2/selection.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(bad)}));
  const state=await current(e.page,'/points/','r000');
  assert.equal(state.state,'last-available');
  assert.match(await e.page.locator('main').innerText(),/1,694 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('forged offline cache r999 cannot be self-authenticated',async()=>{
 const e=await env();
 try{
  await current(e.page);
  await e.page.evaluate(k=>{
   const c=JSON.parse(localStorage.getItem(k));
   c.revision='r999';
   localStorage.setItem(k,JSON.stringify(c));
  },CACHE);
  await e.page.route('**/points/data/v2/selection.json',r=>r.fulfill({status:503,body:'unavailable'}));
  const state=await current(e.page,'/points/','r000');
  assert.match(await e.page.locator('main').innerText(),/1,694 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
await run('corrupted cached r001 cannot override missing primary',async()=>{
 const e=await env();
 try{
  await current(e.page);
  await e.page.evaluate(k=>{
   const c=JSON.parse(localStorage.getItem(k));c.text+=' ';
   localStorage.setItem(k,JSON.stringify(c));
  },CACHE);
  await e.page.route('**/points/data/v2/releases/r001.json',r=>r.fulfill({status:503,body:'unavailable'}));
  const state=await current(e.page,'/points/','r000');
  assert.match(await e.page.locator('main').innerText(),/1,694 v2 points/);
  await unexpectedErrors(e.errors);
 }finally{await e.close()}
});
for(const [path,view] of views){
 await run('axe serious/critical accessibility: '+view,async()=>{
  const e=await env();
  try{
   await current(e.page,path);
   const result=await new AxeBuilder({page:e.page}).include('main .dcap-v2-production').analyze();
   const severity=['serious','critical'];
   const errors=result.violations.filter(v=>severity.includes(v.impact));
   assert.deepEqual(errors.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.length})),[]);
   await unexpectedErrors(e.errors);
   return {violations:result.violations.length, seriousOrCritical:errors.length};
  }finally{await e.close()}
 });
}
await browser.close();
mkdirSync('test-results',{recursive:true});
const report={
 suite:'DCAP r001 unpublished branch Chrome acceptance',
 timestamp:new Date().toISOString(),
 total:cases.length,
 passed:cases.filter(x=>x.status==='PASS').length,
 failed:cases.filter(x=>x.status==='FAIL').length,
 cases
};
writeFileSync('test-results/r001-browser-report.json',JSON.stringify(report,null,2)+'\n');
console.log('BROWSER_SUMMARY',JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
if(report.failed)process.exitCode=1;
