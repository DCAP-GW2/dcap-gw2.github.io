import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';
const raw=readFileSync(new URL('../points/data/v2/releases/r000.json',import.meta.url),'utf8'),base=JSON.parse(raw);
const feedUrl='https://script.google.com/macros/s/AKfycbyQv6tisEz0zF6Jv-s0iMGJsL5CxplWyi_tpUle4XD3CK1HLuSjxwJFjDrTedFXDuMH/exec';
const response=await fetch(feedUrl,{cache:'no-store',redirect:'follow'});
assert.equal(response.status,200);
assert.equal(new URL(response.url).hostname,'script.googleusercontent.com');
const sourceText=await response.text();
assert(sourceText.length<2_000_000);
for(const field of ['ownerDecisionRef','candidateKey','sourceMessageId','approvalDigest','rowDigest'])assert(!sourceText.includes('"'+field+'"'),'private data escaped');
const publicFeed=JSON.parse(sourceText);
const v=validateOwnerFeed(publicFeed,base),combined=combineOwnerFeed(base,publicFeed);
assert.equal(v.awards,151);
assert.equal(v.points,469);
assert.equal(v.throughDate,'2026-11-03');
assert.equal(combined.population.candidatePoints,2163);
assert.equal(combined.population.awardCandidateCount,702);
assert.equal(combined.members.length,37);
assert.equal(combined.rewardsEnabled,false);
console.log('PASS public app JSON schema, anonymity, total 702 awards / 2163 points / 37 members');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:844}});
const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
for(const path of ['/points/','/points/leaderboard/','/points/members/','/points/statistics/']){
 await page.goto('https://dcap-gw2.github.io'+path,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
 const body=await page.locator('main').innerText();
 assert(body.includes('2026-11-03'),'new through-date missing on '+path);
 assert.equal(await page.locator('.dcap-v2-production').count(),1);
 if(path==='/points/'){
  assert(body.includes('2,163 v2 points'));
  assert(body.includes('702 approved awards'));
  assert(body.includes('37 public profiles'));
 }
 console.log('PASS real Pages '+path);
}
assert.deepEqual(errors,[]);
await browser.close();
console.log('DCAP_V2_8_DAY_POSTWRITE_ACCEPTANCE '+JSON.stringify({state:'PASS',newAwards:91,newPoints:277,continuingAwards:151,continuingPoints:469,combinedAwards:702,combinedPoints:2163,profiles:37,rewards:false}));
