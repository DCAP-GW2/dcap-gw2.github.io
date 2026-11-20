import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const baseline=JSON.parse(read('points/data/v2/releases/r000.json'));
const config=read('points/v2/live-config.mjs');
const endpoint='https://script.google.com/macros/s/AKfycbyQv6tisEz0zF6Jv-s0iMGJsL5CxplWyi_tpUle4XD3CK1HLuSjxwJFjDrTedFXDuMH/exec';
assert(config.includes('LIVE_FEED_ENABLED = true'));
assert(config.includes("LIVE_FEED_URL = '"+endpoint+"'"));
assert.equal(JSON.parse(read('points/data/v2/selection.json')).revision,'r000');
const start='http://127.0.0.1:8765';
const paths=['/points/','/points/leaderboard/','/points/members/',
 '/points/statistics/','/points/how-points-work/','/points/rewards/'];
const results=[],record=(name,detail)=>{results.push({name,passed:true,...(detail||{})});console.log('PASS',name)};
const response=await fetch(endpoint,{method:'GET',redirect:'follow',cache:'no-store'});
assert.equal(response.status,200,'Public web app must be anonymously reachable');
assert.equal(new URL(response.url).hostname,'script.googleusercontent.com');
const publicPayload=await response.json();
const valid=validateOwnerFeed(publicPayload,baseline);
const merged=combineOwnerFeed(baseline,publicPayload);
assert.equal(valid.awards,60);assert.equal(valid.points,192);
assert.equal(merged.population.candidatePoints,1886);
assert.equal(merged.population.awardCandidateCount,611);
assert.equal(merged.members.length,37);assert.equal(merged.rewardsEnabled,false);
record('real anonymous public feed validates to 1886 points / 611 awards / 37 profiles');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const cacheKey='dcap.points.public.v2.production.1.continuous';
const expected='live';
async function context(width=390){
 const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[],numbered=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',request=>{if(/\/points\/data\/v2\/releases\/r00[1-9]/.test(request.url()))numbered.push(request.url())});
 return{ctx,page,errors,numbered};
}
const e=await context(390);
try{
 const page=e.page;
 const route=path=>start+path+(path.includes('?')?'&':'?')+'dcapV2Review=private';
 for(const path of paths){
  await page.goto(route(path),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
  const status=await page.evaluate(()=>window.DCAP_V2_STATUS),main=await page.locator('main').innerText();
  assert.equal(status.rewards,false);
  assert(main.includes('Approved contributions through 2026-10-26')||main.includes('Approved contributions through 26 Oct'),'Public continuing status');
  if(path==='/points/')assert(main.includes('1,886 v2 points')&&main.includes('611 approved awards')&&main.includes('37 public profiles'));
  if(path==='/points/rewards/')assert(main.includes('Rewards are disabled'));
  assert.equal(await page.locator('.dcap-v2-production').count(),1);
  record('real HTTPS endpoint renders '+path);
 }
 const name=baseline.members[0].id;
 await page.goto(route('/points/members/profile/?member='+name),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
 assert((await page.locator('main').innerText()).includes(baseline.members[0].displayName));
 record('live historical member profile preserved');
 assert.deepEqual(e.errors,[]);assert.equal(e.numbered.length,0);
 record('no JS page errors and no new r001/r002 HTTP requests');
 const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 const severe=a.violations.filter(x=>x.impact==='critical'||x.impact==='serious');
 assert.equal(severe.length,0,JSON.stringify(severe.map(x=>({id:x.id,impact:x.impact}))));
 record('mobile member profile has no serious/critical axe findings');
 // Expire the browser cache and sever only the public endpoint; verified previous public results must survive.
 await page.evaluate(key=>{const entry=JSON.parse(localStorage.getItem(key));entry.savedAt=Date.now()-70_000;localStorage.setItem(key,JSON.stringify(entry));},cacheKey);
 await e.ctx.route('https://script.google.com/macros/s/**',r=>r.abort());
 await page.goto(route('/points/'),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.DCAP_V2_STATUS?.state==='last-available',{timeout:30000});
 const last=await page.locator('main').innerText();
 assert(last.includes('1,886 v2 points'));assert(last.includes('Last available validated data'));
 record('network failure retains previously verified public 1886 point payload');
}finally{await e.ctx.close()}
const fresh=await context(320);
try{
 await fresh.ctx.route('https://script.google.com/macros/s/**',r=>r.abort());
 await fresh.page.goto(start+'/points/?dcapV2Review=private',{waitUntil:'domcontentloaded'});
 await fresh.page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='r000',{timeout:30000});
 const text=await fresh.page.locator('main').innerText();
 assert(text.includes('1,694 historical v2 points')||text.includes('1,694 v2 points'));
 assert(text.includes('Historical snapshot'));
 record('first-visit outage falls back to frozen r000 / 1694 points');
}finally{await fresh.ctx.close()}
await browser.close();
mkdirSync('test-results',{recursive:true});
writeFileSync('test-results/points-v2-cutover-browser.json',JSON.stringify({
 state:'PASSED',source:'public-json-and-browser',tests:results,
 realContinuing:{awards:valid.awards,points:valid.points},
 combined:{points:1886,awards:611,profiles:37},
 rewards:false,
 numberedContinuingReleases:0
},null,2));
console.log('DCAP_V2_CUTOVER_BROWSER_ACCEPTANCE '+JSON.stringify({
 tests:results.length,passed:results.every(x=>x.passed),totalPoints:1886,totalAwards:611,
 historicalFallback:1694,rewardsEnabled:false
}));
