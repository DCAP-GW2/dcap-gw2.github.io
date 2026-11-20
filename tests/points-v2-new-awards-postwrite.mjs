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
assert.equal(v.awards,169);
assert.equal(v.points,516);
assert.equal(v.throughDate,'2026-11-03');
assert.equal(combined.population.candidatePoints,2210);
assert.equal(combined.population.awardCandidateCount,720);
assert.equal(combined.members.length,40);
assert.equal(combined.rewardsEnabled,false);
for(const [name,memberId,expectedPoints] of [
 ['Gabril','m-d47da88542827987',4],
 ['Roma','m-58d0da951add8039',2],
 ['Princess','m-c112e021ebfe6f2d',2],
 ['Keety','m-4906dde82e46a395',6]
]){
 const member=combined.members.find(m=>m.id===memberId);
 assert(member, 'missing '+name+' public profile');
 assert.equal(member.displayName,name,'unexpected display name');
 assert.equal(member.candidatePoints,expectedPoints,'unexpected points '+name);
}
console.log('PASS public app JSON schema, anonymity, total 720 awards / 2210 points / 40 members');
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
  assert(body.includes('2,210 v2 points'));
  assert(body.includes('720 approved awards'));
  assert(body.includes('40 public profiles'));
 }
 console.log('PASS real Pages '+path);
}

await page.goto('https://dcap-gw2.github.io/points/members/profile/?member=m-d47da88542827987',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
assert((await page.locator('main').innerText()).includes('Gabril'),'new member profile missing');
console.log('PASS actual new Gabril public profile');
assert.deepEqual(errors,[]);
await browser.close();
console.log('DCAP_V2_8_DAY_POSTWRITE_ACCEPTANCE '+JSON.stringify({state:'PASS',newAwards:5,newPoints:11,continuingAwards:169,continuingPoints:516,combinedAwards:720,combinedPoints:2210,profiles:40,rewards:false}));
