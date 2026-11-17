import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { FIXTURES } from '../../js/points/dev2/fixtures.js';
import { contentHash, derive, validate } from '../../js/points/dev2/feed.mjs';

const root=resolve(new URL('../../',import.meta.url).pathname);
const out=resolve(process.env.QA_OUTPUT_DIR || 'work/chromium');
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try {
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path.endsWith('/'))path+='index.html';
  const file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep))throw Error();
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const version=browser.version();
const complete=JSON.parse(await readFile(resolve(root,'tests/fixtures/dev2/complete.json')));
const v1=await readFile(resolve(root,'tests/fixtures/points-v1.json'),'utf8');
const paths=['','leaderboard/','members/','members/profile/','statistics/','how-points-work/','rewards/'];
const widths=[320,390,768,1024,1440];
const results=[],errors=[],consoleErrors=[],requests=[];
const sha=s=>createHash('sha256').update(s).digest('hex');
const seal=p=>{p.validation.contentHash=contentHash(p,sha);assert.equal(validate(p,sha).valid,true);return p;};
const url=(path='',fixture='complete')=>`${base}/points/${path}?pointsPreview=ratified&fixture=${fixture}&member=m-1111111111111111`;
async function context(opts={}){
 const c=await browser.newContext({viewport:{width:390,height:900},...opts});
 await c.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin===base)return route.continue();
   requests.push(u.origin);
   // Stub only the existing v1 feed. All preview fetches must stay on loopback.
   if(u.hostname==='script.google.com')return route.fulfill({contentType:'application/json',body:v1});
   return route.abort('blockedbyclient');
 });
 c.on('page',p=>{
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 });
 return c;
}
async function ready(p){await p.waitForSelector('main[data-points-state]');await p.waitForFunction(()=>document.querySelector('main').getAttribute('aria-busy')!=='true');}
async function check(name,fn){
 const start=Date.now();try{await fn();results.push({name,status:'PASS',ms:Date.now()-start});console.log('PASS',name);}
 catch(e){results.push({name,status:'FAIL',error:e.message,stack:e.stack});console.error('FAIL',name,e.message);}
}
async function layout(p){
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'document horizontal overflow');
 assert.equal(await p.locator('main').getByText(/undefined|NaN/).count(),0);
}
async function rows(p){return p.locator('section').filter({has:p.getByRole('heading',{name:'Recent historical awards',exact:true})}).locator('tbody tr').count();}
async function navigate(p,label){await p.getByRole('navigation',{name:'Points navigation',exact:true}).getByRole('link',{name:label,exact:true}).click();await ready(p);}

try {
 // Every real page, fictional state and viewport; Recent Contributions is a Statistics surface.
 const c=await context(),p=await c.newPage();
 for(const fixture of Object.keys(FIXTURES))for(const path of paths) {
  await p.goto(url(path,fixture));await ready(p);
  for(const width of widths)await check(`DEV.2 ${fixture} ${path||'overview'} ${width}px`,async()=>{
   await p.setViewportSize({width,height:900});await layout(p);
   assert.equal(await p.locator('main').getAttribute('data-points-state')==='unavailable',false);
   await assertText(p,'Inactive historical preview');
   assert.equal(await p.locator('main tbody tr th:first-child').evaluateAll(cells=>cells.every(cell=>{
     const css=getComputedStyle(cell),width=cell.getBoundingClientRect().width-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
     return width>=100;
   })),true,'row labels have readable width');
   assert.ok(await p.locator('main table').count() || path==='rewards/');
   assert.equal(await p.locator('main table:not(:has(caption))').count(),0);
   assert.equal(await p.locator('main thead th:not([scope="col"])').count(),0);
   if(fixture==='pending')await assertText(p,'Pending: 1');
   if(fixture==='missing')await assertText(p,'Identity-withheld numerical awards: 1 / 3');
   if(fixture==='incomplete')await assertText(p,'LOCAL_INCOMPLETE');
   assert.equal(await p.locator('main').getByText(/Revision dev-ratified-/).count(),0);
  });
  await check(`200% text ${fixture} ${path||'overview'} 320px`,async()=>{
   await p.setViewportSize({width:320,height:900});
   await p.evaluate(()=>document.documentElement.style.fontSize='200%');await layout(p);
   await p.evaluate(()=>document.documentElement.style.fontSize='');
  });
  if(fixture==='complete')await check(`axe WCAG 2.2 AA ${path||'overview'}`,async()=>{
   const scan=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']).analyze();
   await writeFile(resolve(out,`axe-${path.replaceAll('/','-')||'overview'}.json`),JSON.stringify(scan.violations,null,2));
   assert.deepEqual(scan.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),[]);
  });
 }
 await c.close();
 // Real v1 and DEV.1 regressions: all pages, query fallback and public-domain gate.
 for(const mode of ['v1','synthetic'])await check(`${mode} seven actual page regressions`,async()=>{
  const c=await context(),p=await c.newPage();
  for(const path of paths){
   await p.goto(`${base}/points/${path}?member=${mode==='v1'?'member-fixture-a':'m-0123456789abcdef'}${mode==='synthetic'?'&pointsPreview=synthetic':''}`);await ready(p);
   await layout(p);assert.notEqual(await p.locator('main').getAttribute('data-points-state'),'unavailable');
   assert.equal(await p.locator('main').getByText('Inactive historical preview',{exact:false}).count(),0);
  }
  await c.close();
 });
 await check('public domain query gate uses v1 without DEV fixture requests',async()=>{
  const c=await context(),p=await c.newPage();let fixtureRequests=0;
  await c.route('https://dcap-gw2.github.io/**',async route=>{
   const u=new URL(route.request().url());if(u.pathname.includes('/tests/fixtures/'))fixtureRequests++;
   const file=resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));
   try{return route.fulfill({contentType:types[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404});}
  });
  for(const mode of ['ratified','synthetic']){await p.goto(`https://dcap-gw2.github.io/points/?pointsPreview=${mode}`);await ready(p);assert.equal(await p.locator('main .points-v2-warning').count(),0);}
  assert.equal(fixtureRequests,0);await c.close();
 });
 for(const mode of ['normal','disabled','getter-throws','methods-throw'])await check(`cross-page revision pin / ${mode}: overview, leaderboard, members, profile, reload, Back, offline`,async()=>{
  const c=await context();
  if(mode!=='normal')await c.addInitScript(mode=>{
   for(const name of ['sessionStorage','localStorage'])Object.defineProperty(window,name,{configurable:true,get(){
    if(mode==='getter-throws')throw new DOMException('blocked','SecurityError');
    if(mode==='disabled')return undefined;
    return {getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}};
   }});
  },mode);
  const p=await c.newPage();await p.goto(url());await ready(p);
  const binding=()=>{const u=new URL(p.url());return [u.searchParams.get('fixture'),u.searchParams.get('previewRevision'),u.searchParams.get('previewHash')];};
  if(mode==='normal')assert.deepEqual(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('dcap.points.dev2.session.complete'))),FIXTURES.complete);
  const expected=binding();assert.deepEqual(expected,['complete',FIXTURES.complete.revision,FIXTURES.complete.hash]);
  for(const label of ['Leaderboard','Members']){await navigate(p,label);assert.deepEqual(binding(),expected);}
  await p.locator('main tbody a').first().click();await ready(p);assert.deepEqual(binding(),expected);
  assert.ok(new URL(p.url()).searchParams.get('member').startsWith('m-'));
  await p.reload();await ready(p);assert.deepEqual(binding(),expected);
  await p.goBack();await ready(p);assert.deepEqual(binding(),expected);
  // Fail the fixture during navigation, leaving all source modules available locally.
  await c.route('**/tests/fixtures/dev2/*.json',r=>r.fulfill({status:503,body:'offline'}));
  await navigate(p,'Statistics');assert.deepEqual(binding(),expected);
  const state=await p.locator('main').getAttribute('data-points-state');
  assert.equal(state,mode==='normal'?'cached':'unavailable');
  if(mode!=='normal')assert.equal(await p.locator('main tbody').count(),0);
  await c.close();
 });
 await check('keyboard-only navigation across every Points view, profile, Back and shared Points links',async()=>{
  const c=await context(),p=await c.newPage();await p.goto(url());await ready(p);
  async function enter(target) {
   for(let n=0;n<120&&!await target.evaluate(e=>e===document.activeElement);n++)await p.keyboard.press('Tab');
   assert.equal(await target.evaluate(e=>e===document.activeElement),true);
   assert.notEqual(await target.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   await p.keyboard.press('Enter');await ready(p);
   assert.equal(new URL(p.url()).searchParams.get('previewHash'),FIXTURES.complete.hash);
  }
  const nav=label=>p.getByRole('navigation',{name:'Points navigation',exact:true}).getByRole('link',{name:label,exact:true});
  await enter(nav('Leaderboard'));await enter(nav('Members'));
  await enter(p.locator('main tbody a').first());await enter(p.getByRole('link',{name:'Back to members'}));
  for(const label of ['Statistics','How Points Work','Rewards','Overview'])await enter(nav(label));
  const shared=p.locator('header, footer').getByRole('link',{name:'Points',exact:true});
  for(const href of await shared.evaluateAll(links=>links.map(a=>a.href)))assert.equal(new URL(href).searchParams.get('previewHash'),FIXTURES.complete.hash);
  await enter(shared.first());await c.close();
 });
 await check('keyboard Enter/Space, focus ring, aria-expanded and five/ten profile history',async()=>{
  const c=await context(),p=await c.newPage();await p.goto(url('members/profile/'));await ready(p);
  assert.equal(await rows(p),5);
  // Reach the button with actual Tab keys, then activate with Enter and Space.
  for(let i=0;i<60&&await p.evaluate(()=>document.activeElement?.textContent)!=='Show more';i++)await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Show more');
  assert.equal(await p.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
  await p.keyboard.press('Enter');assert.equal(await rows(p),10);
  const b=p.getByRole('button',{name:'Show less'});assert.equal(await b.getAttribute('aria-expanded'),'true');assert.equal(await b.evaluate(e=>e===document.activeElement),true);
  await p.keyboard.press('Space');assert.equal(await rows(p),5);assert.equal(await p.getByRole('button',{name:'Show more'}).getAttribute('aria-expanded'),'false');
  await p.screenshot({path:resolve(out,'profile-390.png'),fullPage:true});await c.close();
 });
 await check('search, tied competition ranks, historical cycle controls and recent provenance labels',async()=>{
  const c=await context(),p=await c.newPage();await p.goto(url('members/'));await ready(p);
  await p.getByRole('searchbox',{name:'Search members'}).fill('Bram');await assertText(p,'Showing 1 of 3');
  assert.match(await p.locator('main tbody a').getAttribute('href'),/member=m-2222222222222222/);
  await p.getByRole('searchbox').fill('no matching fictional name');await assertText(p,'No members match your search.');
  await p.goto(url('leaderboard/','ties'));await ready(p);
  assert.deepEqual(await p.locator('main tbody tr th').allTextContents(),['1','1']);
  const cycle=p.getByRole('button',{name:'Historical cycle 1'});await cycle.focus();await p.keyboard.press('Space');assert.equal(await cycle.getAttribute('aria-pressed'),'true');
  await p.goto(url('statistics/'));await ready(p);await assertText(p,'Mothman');await assertText(p,'Rifts');await assertText(p,'ratified historical exception');
  await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:resolve(out,'statistics-1440.png'),fullPage:true});
  await navigate(p,'How Points Work');await assertText(p,'Other Commander remains TBD');
  assert.equal(await p.locator('main tbody tr').count(),25);
  await navigate(p,'Rewards');await assertText(p,'cannot establish reward eligibility');await c.close();
 });
 await check('unknown/missing IDs are safe and do not generate display-name routes',async()=>{
  const c=await context(),p=await c.newPage();for(const member of ['unknown','', 'Example Aria']){
   await p.goto(url('members/profile/').replace('m-1111111111111111',encodeURIComponent(member)));await ready(p);
   await assertText(p,member?'Member not found.':'Member not specified.');assert.equal(await p.locator('main table').count(),0);
  }await c.close();
 });
 for(const kind of ['invalid','unavailable','version','checksum','revision','same-revision-hash','corrupt-cache','wrong-cache-revision','expired-cache','bad-session','session-revision','session-hash','invalid-url','duplicate-fixture','unknown-fixture','timeout-late'])await check(`failure state ${kind}`,async()=>{
  const c=await context(),p=await c.newPage();let candidate=structuredClone(complete);
  if(kind==='invalid')candidate.population.candidatePoints++;
  if(kind==='version')candidate.contractVersion='2.0.0-dev.1';
  if(kind==='checksum')candidate.validation.contentHash='0'.repeat(64);
  if(kind==='revision'){candidate.migration.revision='dev-ratified-'+'f'.repeat(24);seal(candidate);}
  if(kind==='same-revision-hash'){candidate.members[0].displayName='Changed Fictional Name';seal(candidate);}
  const cacheKey='dcap.points.public.v2.preview.dev.2|complete';
  if(['corrupt-cache','wrong-cache-revision','expired-cache','bad-session','session-revision','session-hash'].includes(kind))await c.addInitScript(({kind,complete,cacheKey})=>{
   if(kind==='session-revision'||kind==='session-hash')sessionStorage.setItem('dcap.points.dev2.session.complete',JSON.stringify({revision:kind==='session-revision'?'dev-ratified-'+'f'.repeat(24):complete.migration.revision,hash:kind==='session-hash'?'0'.repeat(64):complete.validation.contentHash}));
   else if(kind==='bad-session')sessionStorage.setItem('dcap.points.dev2.session.complete','{bad');
   else if(kind==='corrupt-cache')localStorage.setItem(cacheKey,'{bad');
   else {const data=structuredClone(complete);if(kind==='wrong-cache-revision')data.migration.revision='dev-ratified-'+'f'.repeat(24);
    localStorage.setItem(cacheKey,JSON.stringify({version:'2.0.0-dev.2',cachedAt:Date.now()-61000,data}));}
  },{kind,complete,cacheKey});
  await c.route('**/tests/fixtures/dev2/*.json',async r=>{
   if(kind==='timeout-late'){await new Promise(r=>setTimeout(r,180));try{await r.fulfill({json:complete});}catch{}return;}
   if(['unavailable','corrupt-cache','wrong-cache-revision','expired-cache'].includes(kind))return r.fulfill({status:503});
   return r.fulfill({json:candidate});
  });
  // Accelerate the real loader timeout; actual abort + late response are still exercised.
  if(kind==='timeout-late')await c.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===15000?30:ms,...args);});
  let target=url();if(kind==='invalid-url')target+='&previewHash=bad';if(kind==='duplicate-fixture')target+='&fixture=pending';if(kind==='unknown-fixture')target=url('','unknown');
  await p.goto(target);await ready(p);
  const state=await p.locator('main').getAttribute('data-points-state');
  assert.equal(state,kind==='expired-cache'?'fallback':'unavailable');
  if(kind!=='expired-cache')assert.equal(await p.locator('main tbody').count(),0);
  if(kind==='timeout-late'){await p.waitForTimeout(250);assert.equal(await p.evaluate(k=>localStorage.getItem(k),cacheKey),null);}
  if(kind==='invalid-url'||kind==='duplicate-fixture'){
    await navigate(p,'Leaderboard');assert.equal(await p.locator('main').getAttribute('data-points-state'),'unavailable');
    await p.locator('header').getByRole('link',{name:'Points',exact:true}).click();await ready(p);
    assert.equal(await p.locator('main').getAttribute('data-points-state'),'unavailable');
  }
  await c.close();
 });
 await check('mid-session different revision and same-revision different hash retain verified fallback',async()=>{
  for(const kind of ['revision','hash']){
   const c=await context(),p=await c.newPage();await p.goto(url());await ready(p);
   await p.evaluate(()=>{const k='dcap.points.public.v2.preview.dev.2|complete',r=JSON.parse(localStorage.getItem(k));r.cachedAt-=61000;localStorage.setItem(k,JSON.stringify(r));});
   const candidate=structuredClone(complete);if(kind==='revision')candidate.migration.revision='dev-ratified-'+'f'.repeat(24);else candidate.members[0].displayName='Changed Fictional Name';seal(candidate);
   await c.route('**/tests/fixtures/dev2/*.json',r=>r.fulfill({json:candidate}));await navigate(p,'Leaderboard');
   assert.equal(await p.locator('main').getAttribute('data-points-state'),'fallback');await assertText(p,'Example Aria');assert.equal(await p.locator('main').getByText('Changed Fictional Name').count(),0);await c.close();
  }
 });
 // Derive public-safe test variations from the reviewed fictional fixture only.
 for(const count of [0,1,5,6,10,12])await check(`profile ${count} entries, long fictional name, validated test-only fixture`,async()=>{
  const candidate=structuredClone(complete),id=candidate.members[0].id;
  candidate.members[0].displayName='F'.repeat(80);
  const kept=new Set(candidate.awards.filter(a=>a.memberId===id).slice(0,count).map(a=>a.id));
  candidate.awards=candidate.awards.filter(a=>a.memberId!==id||kept.has(a.id));
  candidate.historicalExceptions=candidate.historicalExceptions.filter(e=>candidate.awards.some(a=>a.id===e.awardId));
  for(const [type,ck,pk] of [['APPROVED_RULE','approvedRuleCount','approvedRulePoints'],['RATIFIED_HISTORICAL_EXCEPTION','ratifiedExceptionCount','ratifiedExceptionPoints']]){
   const a=candidate.awards.filter(a=>a.provenanceType===type);candidate.population[ck]=a.length;candidate.population[pk]=a.reduce((n,a)=>n+a.points,0);
  }
  const n=candidate.population;n.awardCandidateCount=n.projectedAwardCount=candidate.awards.length;n.projectedPoints=n.candidatePoints=candidate.awards.reduce((n,a)=>n+a.points,0);n.sourceCount=n.awardCandidateCount+n.confirmedIneligibleCount+n.unresolvedCount+n.suppressedCount;
  Object.assign(candidate,derive(candidate.awards,candidate.members));seal(candidate);
  const c=await context({viewport:{width:320,height:900}}),p=await c.newPage();
  await c.route('**/tests/fixtures/dev2/complete.json',r=>r.fulfill({json:candidate}));
  await c.route('**/js/points/dev2/fixtures.js',async r=>{
   let source=await readFile(resolve(root,'js/points/dev2/fixtures.js'),'utf8');source=source.replace(FIXTURES.complete.hash,candidate.validation.contentHash);
   return r.fulfill({contentType:'text/javascript',body:source});
  });
  await p.goto(url('members/profile/'));await ready(p);assert.equal(await rows(p),Math.min(5,count));await layout(p);
  const button=p.getByRole('button',{name:'Show more'});assert.equal(await button.count(),count>5?1:0);
  if(count>5){await button.click();assert.equal(await rows(p),Math.min(10,count));await p.getByRole('button',{name:'Show less'}).click();assert.equal(await rows(p),5);}
  await p.evaluate(()=>document.documentElement.style.fontSize='200%');await layout(p);await c.close();
 });
 await check('loading state suppresses live placeholders until asynchronous checksum completes',async()=>{
  const c=await context(),p=await c.newPage();let release;
  const gate=new Promise(r=>release=r);
  await c.route('**/tests/fixtures/dev2/*.json',async r=>{await gate;await r.fulfill({json:complete});});
  await p.goto(url(),{waitUntil:'domcontentloaded'});
  await p.getByRole('status').filter({hasText:'Loading local historical preview'}).waitFor();
  assert.equal(await p.locator('main table').count(),0);assert.equal(await p.locator('main').getAttribute('aria-busy'),'true');
  release();await ready(p);await assertText(p,'Reconciled historical points');await c.close();
 });
 await check('table regions scroll horizontally with keyboard and retain readable row labels',async()=>{
  const c=await context({viewport:{width:320,height:900}}),p=await c.newPage();await p.goto(url('statistics/'));await ready(p);
  const region=p.getByRole('region',{name:'Latest ten historical awards'});await region.focus();
  assert.equal(await region.evaluate(e=>e===document.activeElement),true);
  assert.equal(await region.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
  await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);assert.ok(await region.evaluate(e=>e.scrollLeft)>0);
  await p.screenshot({path:resolve(out,'statistics-320.png'),fullPage:false});await c.close();
 });
 await check('rendered totals and latest ten derive exclusively from reviewed numerical awards',async()=>{
  const c=await context(),p=await c.newPage();
  await p.goto(url());await ready(p);
  const metric=label=>p.locator('main .points-kpi-card').filter({has:p.getByText(label,{exact:true})}).locator('dd').innerText();
  assert.equal(await metric('Reconciled historical points'),String(complete.population.candidatePoints));
  assert.equal(await metric('Numerical awards'),String(complete.population.awardCandidateCount));
  await navigate(p,'Statistics');
  const recent=p.getByRole('region',{name:'Latest ten historical awards'}).locator('tbody tr');
  assert.equal(await recent.count(),10);
  const actual=await recent.evaluateAll(rows=>rows.map(row=>[...row.cells].slice(1).map(cell=>cell.textContent)));
  const expected=complete.recentAwardIds.map(id=>{
    const a=complete.awards.find(a=>a.id===id),member=complete.members.find(m=>m.id===a.memberId),event=complete.events.find(e=>e.id===a.eventId),rule=complete.rules.find(r=>r.roleId===a.roleId);
    return [member.displayName,event.label,rule.roleLabel+(a.provenanceType==='RATIFIED_HISTORICAL_EXCEPTION'?' (ratified historical exception)':''),String(a.points)];
  });assert.deepEqual(actual,expected);
  await c.close();
 });
 await check('no JavaScript: seven page navigation, readable unavailable states and no invented data',async()=>{
  const c=await context({javaScriptEnabled:false}),p=await c.newPage();for(const path of paths){
   await p.goto(url(path));await layout(p);assert.ok(await p.locator('noscript').count());
   const nav=p.getByRole('navigation',{name:'Points navigation',exact:true});assert.ok(await nav.getByRole('link').count()>=5);
   await nav.getByRole('link',{name:'Members',exact:true}).click();await p.waitForURL('**/points/members/');
  }await p.screenshot({path:resolve(out,'no-javascript-390.png'),fullPage:true});await c.close();
 });
 await check('no uncaught browser errors and no external preview network dependency',async()=>{
  assert.deepEqual(errors,[]);
  assert.deepEqual([...new Set(requests.filter(x=>x!=='https://script.google.com'))],[]);
 });
} finally {
 const report={executedAt:new Date().toISOString(),chromium:version,environment:'Debian Linux, headless system Chromium via Playwright, loopback HTTP only',widths,
   counts:{passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,skipped:0},results,uncaughtErrors:errors,consoleErrors,externalOrigins:[...new Set(requests)]};
 await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.counts));await browser.close();await new Promise(r=>server.close(r));
 if(report.counts.failed)process.exitCode=1;
}
async function assertText(p,value){assert.ok((await p.locator('main').innerText()).includes(value),`missing text ${value}`);}
