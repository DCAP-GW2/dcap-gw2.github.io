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
assert(valid.awards>0&&valid.points>0,'Continuing feed must contain approved awards');
assert.equal(merged.population.candidatePoints,baseline.population.candidatePoints+valid.points);
assert.equal(merged.population.awardCandidateCount,baseline.population.awardCandidateCount+valid.awards);
assert.equal(merged.members.length,valid.publicMembers);assert.equal(merged.rewardsEnabled,false);
assert.deepEqual(merged.rules.filter(rule=>rule.eventId==='dbs').map(rule=>[rule.roleId,rule.points]).sort(),[
 ['commander',2],['derv-escort',2],['doordash-feed',2]
]);
assert.equal(merged.rules.find(rule=>rule.roleId==='other-commander')?.points,null);
const expectedPoints=merged.population.candidatePoints,expectedAwards=merged.population.awardCandidateCount;
// Accept v2.1 only when all four owner-final effective-dated versions reach the live feed.
for(const [id,eventId,roleId,points] of [
 ['V21-01','bfla','squad-4',1],['V21-02','all-events','map-spammer',2],
 ['V2-02','triple-trouble','map-spammer',4],['V2-15','gyala-delve','map-spammer',2]
]){
 assert(merged.rules.some(r=>r.id===id&&r.eventId===eventId&&r.roleId===roleId&&
  r.points===points&&r.effectiveFrom==='2026-11-04'),id+' v2.1 rule not active on public feed');
}
// Static loading copy stays visitor-friendly while the verified feed is pending.
for(const path of ['leaderboard','members','members/profile','statistics','how-points-work','rewards']){
 const html=read('points/'+path+'/index.html');
 assert(html.includes('Loading DCAP Points…'),path+' should show simple loading copy');
 assert(/data-(leaderboard|member|statistics|rules|rewards)-links hidden/.test(html),path+' must hide fallback links');
}
const fmt=n=>new Intl.NumberFormat('en-NZ').format(n);
record('real anonymous public feed validates to '+expectedPoints+' points / '+expectedAwards+' awards / '+valid.publicMembers+' profiles');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const cacheKey='dcap.points.public.v2.production.1.continuous';
const expected='live';
async function context(width=390,hasTouch=false){
 const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce',hasTouch});
 const page=await ctx.newPage(),errors=[],numbered=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',request=>{if(/\/points\/data\/v2\/releases\/r00[1-9]/.test(request.url()))numbered.push(request.url())});
 return{ctx,page,errors,numbered};
}
const e=await context(390,true);
try{
 const page=e.page;
 const route=path=>start+path+(path.includes('?')?'&':'?')+'dcapV2Review=private';
 for(const path of paths){
  await page.goto(route(path),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
  const status=await page.evaluate(()=>window.DCAP_V2_STATUS),main=await page.locator('main').innerText();
  assert.equal(status.rewards,false);
  assert(main.includes('Latest contributions: '+valid.throughDate),'Latest date derives from verified feed');
  assert(!main.includes('Data source:')&&!main.includes('Refreshed when the page is opened'),'No redundant technical copy');
  if(path==='/points/'){
   const hero=page.locator('.points-hero');
   assert.equal(await hero.locator('[data-points-period]').innerText(),'Latest contributions: '+valid.throughDate);
   assert.equal(await hero.locator('[data-points-season]').innerText(),merged.season.displayLabel);
   assert.equal(new URL(await hero.getByRole('link',{name:/Rule 2\.1/}).getAttribute('href')).pathname,'/points/how-points-work/');
   assert.deepEqual(await page.locator('.points-kpi-card dd').allTextContents(),[fmt(expectedPoints),fmt(expectedAwards),fmt(valid.publicMembers),'2.1']);
   assert.equal(await page.locator('.points-kpi-card dt').nth(1).innerText(),'Contributions');
   assert.equal(await page.locator('.points-kpi-grid').first().evaluate(x=>getComputedStyle(x).marginBottom),'24px');
   assert(!/original v1 historical points|excluded;|missing public identity states|Explore role contributions/.test(main));
  }
  if(path==='/points/leaderboard/'){
   assert(!/Ranks are partial|No unverified member routes/.test(main));
   assert.equal(await page.getByRole('button',{name:'Current Season',exact:true}).getAttribute('aria-pressed'),'true');
   const readRows=()=>page.locator('.dcap-v2-production tbody tr').evaluateAll(trs=>trs.map(tr=>{
    const link=tr.querySelector('a');
    return [[...tr.cells].map(cell=>cell.innerText),new URL(link.href).searchParams.get('member')];
   }));
   assert.equal(await page.locator('.dcap-v2-production thead').innerText().then(x=>x.includes('Contributions')),true);
   const current=merged.awards.filter(a=>a.cycleId===merged.season.rawCycleId);
   const byMember=new Map();
   for(const a of current){const old=byMember.get(a.memberId)||{points:0,count:0};old.points+=a.points;old.count++;byMember.set(a.memberId,old)}
   const currentRanked=merged.members.map(m=>({m,...(byMember.get(m.id)||{points:0,count:0})})).filter(x=>x.points>0).sort((a,b)=>b.points-a.points||a.m.id.localeCompare(b.m.id));
   assert.deepEqual(await readRows(),currentRanked.map(x=>[[String(1+currentRanked.filter(y=>y.points>x.points).length),x.m.displayName,fmt(x.points),fmt(x.count)],x.m.id]));
   await page.getByRole('button',{name:'All Time',exact:true}).tap();
   assert.equal(await page.getByRole('button',{name:'All Time',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await page.getByRole('button',{name:'Current Season',exact:true}).getAttribute('aria-pressed'),'false');
   const ranked=[...merged.members].filter(m=>m.candidatePoints>0).sort((a,b)=>b.candidatePoints-a.candidatePoints||a.id.localeCompare(b.id));
   assert.deepEqual(await readRows(),ranked.map(m=>[[String(m.partialRank),m.displayName,fmt(m.candidatePoints),fmt(m.awardCandidateCount)],m.id]));
   await page.getByRole('button',{name:'Current Season',exact:true}).press('Space');
   assert.equal(await page.getByRole('button',{name:'Current Season',exact:true}).getAttribute('aria-pressed'),'true');

  }
  if(path==='/points/rewards/')assert.equal((await page.locator('.points-rewards-status-card').innerText()).trim(),'Coming Soon');
  assert.equal(await page.locator('.dcap-v2-production').count(),1);
  assert.equal(await page.locator('.points-hero').count(),1,'v1 hero retained');
  assert.equal(await page.locator('.points-nav').count(),1,'v1 points navigation retained');
  assert.equal(await page.locator('.points-nav a').count(),6,'all six points navigation links retained');
  const previewLinks=await page.locator('a[href]').evaluateAll(links=>links.filter(a=>new URL(a.href).origin===location.origin&&new URL(a.href).pathname.startsWith('/points/')&&!a.getAttribute('href').startsWith('#')).map(a=>a.href));
  assert(previewLinks.every(href=>new URL(href).searchParams.get('dcapV2Review')==='private'),'local Points links retain the preview');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'no page-wide overflow');
  if(['/points/','/points/leaderboard/','/points/members/','/points/how-points-work/'].includes(path)){
   const tableFits=await page.locator('.dcap-v2-scroll').evaluate(panel=>panel.scrollWidth<=panel.clientWidth);
   assert(tableFits,path+' should show every column without horizontal scrolling');
  }
  if(path==='/points/statistics/'){
   assert.equal(await page.locator('.points-daily-chart svg').count(),1);
   assert.equal(await page.locator('.points-stat-bar-fill').count(),merged.aggregates.eventTotals.length);
   assert.equal(await page.getByRole('heading',{name:'Recent contributions',exact:true}).count(),1);
   assert.equal(await page.getByRole('heading',{name:'By role',exact:true}).count(),0);
  }
  if(path==='/points/how-points-work/'){
   assert.equal(await page.getByRole('heading',{name:'DCAP Points Rules',exact:true}).count(),1);
   const rows=await page.locator('.dcap-v2-production tbody tr').evaluateAll(trs=>trs.map(tr=>[...tr.querySelectorAll('th,td')].map(c=>c.textContent.trim())));
   assert.deepEqual(rows.filter(row=>row[0]==='DBS'),[['DBS','Commander','2']]);
   assert(rows.some(row=>row[0]==='Other Events'&&row[1]==='Commander'&&row[2]==='TBD'));
   const hasV21=true;
   const trailer=hasV21?[['All Events','Map Spammer','2'],['All Events','Student','2'],['Other Events','Commander','TBD']]:
    [['All Events','Student','2'],['Other Events','Commander','TBD']];
   assert.deepEqual(rows.slice(-trailer.length),trailer);
   if(hasV21){
    assert(rows.some(row=>row[0]==='BFLA'&&row[1]==='Squad 4'&&row[2]==='1'));
    assert(rows.some(row=>row[0]==='Triple Trouble'&&row[1]==='Map Spammer'&&row[2]==='4'));
    assert(rows.some(row=>row[0]==='Gyala Delve'&&row[1]==='Map Spammer'&&row[2]==='2'));
   }
   const specific=rows.slice(0,-trailer.length).map(row=>row[0]);
   assert.deepEqual(specific,[...specific].sort((a,b)=>a.localeCompare(b,'en-NZ')));
  }
  if(path==='/points/members/'){
   assert.equal(await page.locator('input[type=search]').getAttribute('placeholder'),'Search member names');
   assert((await page.locator('.dcap-v2-production thead').innerText()).includes('Contributions'));
  }
  record('real HTTPS endpoint renders '+path+' with v1 visual shell');
 }
 const name=baseline.members[0].id;
 await page.goto(route('/points/members/profile/?member='+name),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
 assert((await page.locator('main').innerText()).includes(baseline.members[0].displayName));
 record('live historical member profile preserved');
 const historyDate=page.locator('#dcap-v2-profile-history tbody th').first();
 assert.equal(await historyDate.evaluate(cell=>getComputedStyle(cell).whiteSpace),'nowrap','mobile history dates stay on one line');
 const personalCount=merged.awards.filter(a=>a.memberId===name).length;
 if(personalCount>5){
  await page.getByRole('button',{name:'Show more',exact:true}).click();
  assert.equal(await page.locator('#dcap-v2-profile-history tbody tr').count(),personalCount);
  await page.getByRole('button',{name:'Show fewer',exact:true}).click();
  assert.equal(await page.locator('#dcap-v2-profile-history tbody tr').count(),5);
 }
 await page.getByRole('link',{name:'← Back to Members',exact:true}).click();
 await page.waitForSelector('.dcap-v2-production input');
 await page.getByRole('searchbox').fill('nEpHz');
 assert.equal(await page.locator('.dcap-v2-production tbody tr').count(),1);
 await page.getByRole('link',{name:'Nephz',exact:true}).click();
 assert.equal(new URL(page.url()).searchParams.get('member'),'m-6a45288ea1cbb878');
 for(const section of ['Overview','Leaderboard','Members','Statistics','How Points Work','Rewards']){
  await page.getByRole('navigation',{name:'Points navigation',exact:true}).getByRole('link',{name:section,exact:true}).click();
  await page.waitForSelector('.dcap-v2-production');
  assert.equal(new URL(page.url()).searchParams.get('dcapV2Review'),'private');
 }
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 record('private navigation, member search, complete history and mobile menu work');
 // Keep the existing member-profile accessibility acceptance on the profile route.
 await page.goto(route('/points/members/profile/?member='+name),{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.dcap-v2-production');
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
 assert(last.includes(fmt(expectedPoints)));assert(last.includes('Last available validated data'));
 assert.equal(await page.locator('.dcap-v2-warning').count(),1);
 record('network failure retains previously verified public '+expectedPoints+' point payload');
}finally{await e.ctx.close()}
// Wide viewport sanity check without extra infrastructure.
const wide=await context(1440);
try{
 await wide.page.goto(start+'/points/?dcapV2Review=private',{waitUntil:'domcontentloaded'});
 await wide.page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='live',{timeout:30000});
 assert.equal(await wide.page.locator('.points-hero').count(),1);
 assert.equal(await wide.page.locator('.points-nav').count(),1);
 assert.equal(await wide.page.locator('.points-kpi-card').count(),4);
 assert.equal(await wide.page.locator('.points-dashboard-grid > section').count(),2);
 record('desktop overview retains hero, navigation and four branded KPI cards');
 for(const width of [768,320]){
  await wide.page.setViewportSize({width,height:900});
  for(const path of [...paths,'/points/members/profile/?member=m-6a45288ea1cbb878']){
   await wide.page.goto(start+path+(path.includes('?')?'&':'?')+'dcapV2Review=private',{waitUntil:'domcontentloaded'});
   await wide.page.waitForSelector('.dcap-v2-production');
   assert(await wide.page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),path+' overflows at '+width);
   if(path==='/points/leaderboard/'){
    const tableFits=await wide.page.locator('#dcap-v2-leaderboard-results .dcap-v2-scroll').evaluate(panel=>panel.scrollWidth<=panel.clientWidth);
    assert(tableFits,'Leaderboard scores and contributions must fit at '+width);
   }
  }
 }
 record('all seven views fit tablet 768px and small mobile 320px');
}finally{await wide.ctx.close()}
const unavailable=await context(390);
try{
 await unavailable.ctx.route('**/points/data/v2/**',route=>route.abort());
 await unavailable.page.goto(start+'/points/leaderboard/?dcapV2Review=private',{waitUntil:'domcontentloaded'});
 await unavailable.page.waitForFunction(()=>window.DCAP_V2_STATUS?.state==='unavailable',{timeout:30000});
 const msg=await unavailable.page.locator('.dcap-v2-production').innerText();
 assert(msg.includes('Unable to load DCAP Points')&&msg.includes('Please refresh the page'));
 assert.equal(await unavailable.page.locator('.dcap-v2-production a').count(),0);
 record('no validated source shows simple failure message without fallback links');
}finally{await unavailable.ctx.close()}
const brokenClient=await context(390);
try{
 let releaseModule;
 const pending=new Promise(resolve=>{releaseModule=resolve});
 let requestedLegacy=false;
 brokenClient.page.on('request',request=>{
  if(new URL(request.url()).pathname.startsWith('/js/points/'))requestedLegacy=true;
 });
 await brokenClient.ctx.route('**/points/v2/page.mjs',async route=>{await pending;await route.abort();});
 try{
  await brokenClient.page.goto(start+'/points/leaderboard/?dcapV2Review=private',{waitUntil:'commit'});
  await brokenClient.page.getByText('Loading DCAP Points…',{exact:true}).waitFor();
  assert.equal(await brokenClient.page.getByRole('link',{name:/Previous DCAP Points site/}).count(),0);
 }finally{releaseModule()}
 await brokenClient.page.waitForFunction(()=>window.DCAP_V2_STATUS?.state==='unavailable');
 const panel=brokenClient.page.locator('.dcap-v2-error');
 assert.equal(await panel.getByRole('heading',{name:'Unable to load DCAP Points'}).count(),1);
 assert.match(await panel.innerText(),/Please refresh the page and try again/);
 assert.equal(await panel.getByRole('link').count(),0);
 assert.equal(requestedLegacy,false);
 const membersLink=brokenClient.page.getByRole('navigation',{name:'Points navigation'}).getByRole('link',{name:'Members'});
 assert.equal(new URL(await membersLink.getAttribute('href')).searchParams.get('dcapV2Review'),'private');
 assert.equal(await brokenClient.page.getByRole('button',{name:'Open navigation',exact:true}).isVisible(),true);
 record('delayed and failed v2 module shows simple status and never starts v1');
}finally{await brokenClient.ctx.close()}
const fresh=await context(320);
try{
 await fresh.ctx.route('https://script.google.com/macros/s/**',r=>r.abort());
 await fresh.page.goto(start+'/points/?dcapV2Review=private',{waitUntil:'domcontentloaded'});
 await fresh.page.waitForFunction(()=>window.DCAP_V2_STATUS?.revision==='r000',{timeout:30000});
 const text=await fresh.page.locator('main').innerText();
 assert(text.includes(fmt(baseline.population.candidatePoints)));
 assert(text.includes('Historical snapshot'));
 assert.match(await fresh.page.locator('.dcap-v2-warning').innerText(),/current contributions are unavailable/);
 record('first-visit outage falls back to frozen r000 / '+baseline.population.candidatePoints+' points');
}finally{await fresh.ctx.close()}
await browser.close();
mkdirSync('test-results',{recursive:true});
writeFileSync('test-results/points-v2-cutover-browser.json',JSON.stringify({
 state:'PASSED',source:'public-json-and-browser',tests:results,
 realContinuing:{awards:valid.awards,points:valid.points},
 combined:{points:expectedPoints,awards:expectedAwards,profiles:valid.publicMembers},
 rewards:false,
 numberedContinuingReleases:0
},null,2));
console.log('DCAP_V2_CUTOVER_BROWSER_ACCEPTANCE '+JSON.stringify({
 tests:results.length,passed:results.every(x=>x.passed),totalPoints:expectedPoints,totalAwards:expectedAwards,
 historicalFallback:baseline.population.candidatePoints,rewardsEnabled:false
}));
