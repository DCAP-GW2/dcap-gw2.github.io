import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ROOT='https://dcap-gw2.github.io';
const ENDPOINT='https://script.google.com/macros/s/AKfycbyQv6tisEz0zF6Jv-s0iMGJsL5CxplWyi_tpUle4XD3CK1HLuSjxwJFjDrTedFXDuMH/exec';
const routes=['/points/','/points/leaderboard/','/points/members/',
 '/points/statistics/','/points/how-points-work/','/points/rewards/'];
const configResponse=await fetch(ROOT+'/points/v2/live-config.mjs',{cache:'no-store'});
assert.equal(configResponse.status,200,'Pages must publish the live-config file');
const configText=await configResponse.text();
assert(configText.includes('LIVE_FEED_ENABLED = true'));
assert(configText.includes('LIVE_FEED_URL = '+String.fromCharCode(39)+ENDPOINT));
console.log('PASS public GitHub Pages is serving enabled v2 live config');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const errors=[],requests=[],results=[];
const ctx=await browser.newContext({viewport:{width:390,height:850},reducedMotion:'reduce'});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>requests.push(r.url()));
for(const path of routes){
 await page.goto(ROOT+path,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:25000});
 const {state,rewards}=await page.evaluate(()=>window.DCAP_V2_STATUS);
 const body=await page.locator('main').innerText();
 assert.equal(rewards,false);
 assert(body.includes('Approved contributions through 2026-10-26'));
 if(path==='/points/'){
  assert(body.includes('1,886 v2 points'));
  assert(body.includes('611 approved awards'));
  assert(body.includes('37 public profiles'));
 }
 if(path==='/points/rewards/')assert(body.includes('Rewards are disabled'));
 assert.equal(await page.locator('.dcap-v2-production').count(),1);
 results.push(path);
 console.log('PASS production-origin live v2 '+path+' ('+state+')');
}
await page.goto(ROOT+'/points/members/profile/?member=m-07906d14a72fc674',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:25000});
assert((await page.locator('main').innerText()).includes('Seb'));
console.log('PASS real production member profile');
assert.deepEqual(errors,[]);
assert(!requests.some(x=>/\/points\/data\/v2\/releases\/r00[1-9]/.test(x)));
console.log('PASS no browser exceptions and no continuing release fetches');
await ctx.close();
const offline=await browser.newContext({viewport:{width:390,height:850}});
const offlinePage=await offline.newPage();
await offline.route('https://script.google.com/macros/s/**',r=>r.abort());
await offlinePage.goto(ROOT+'/points/',{waitUntil:'domcontentloaded',timeout:30000});
await offlinePage.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='r000',{timeout:25000});
const fallback=await offlinePage.locator('main').innerText();
assert(fallback.includes('1,694'));
assert(fallback.includes('Historical snapshot'));
console.log('PASS production-origin first-visit API outage displays immutable r000 historical data');
await offline.close();await browser.close();
console.log('DCAP_V2_PRODUCTION_CUTOVER_SMOKE '+JSON.stringify({
 state:'PASS',publicPages:results.length,profile:true,
 productionPoints:1886,productionContributions:611,
 historicalFallbackPoints:1694,rewards:false,noNumberedReleases:true
}));
