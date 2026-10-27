import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validate, validateAsync, contentHash, awardId, derive, stable } from '../js/points/dev2/feed.mjs';
import { createV2Loader, V2_CACHE } from '../js/points/dev2/cache.js';
import { FIXTURES, previewContext } from '../js/points/dev2/fixtures.js';
import { previewContract } from '../js/points/preview.js';
import { validateV2 as validateDev1 } from '../js/points/v2/validation.js';
const fixtures = Object.fromEntries(Object.keys(FIXTURES).map(name => [name,
  JSON.parse(readFileSync(new URL(`./fixtures/dev2/${name}.json`, import.meta.url)))]));
const fixture = fixtures.complete;
const sha = s => createHash('sha256').update(s).digest('hex');
const clone = p => structuredClone(p);
const rehash = p => { p.validation.contentHash = contentHash(p, sha); return p; };
const store = () => { const values = new Map(); return {values, getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,v)}; };
const response = p => new Response(JSON.stringify(p));
const options = (storage = store()) => ({storage, expectedRevision:fixture.migration.revision,
  expectedHash:fixture.validation.contentHash, fetcher:async()=>response(fixture)});
for (const [name, p] of Object.entries(fixtures)) test(`DEV.2 reviewed fictional ${name} schema, semantics and immutable binding`, async () => {
  assert.deepEqual(validate(p, sha), {valid:true}); assert.equal(await validateAsync(p), true);
  assert.deepEqual(FIXTURES[name], {revision:p.migration.revision, hash:p.validation.contentHash});
  const n = p.population;
  assert.equal(n.sourceCount, n.approvedRuleCount+n.ratifiedExceptionCount+n.confirmedIneligibleCount+n.unresolvedCount+n.suppressedCount);
  assert.equal(p.awards.length+n.withheldAwardCount, n.awardCandidateCount);
});
test('DEV.2 dispatch keeps v1 default, exact versions and loopback-only activation', async () => {
  for (const host of ['dcap-gw2.github.io','example.org','localhost.example.org'])
    for (const mode of ['synthetic','ratified']) assert.equal(previewContract(new URL(`https://${host}/?pointsPreview=${mode}`)), null);
  for (const host of ['localhost','127.0.0.1','[::1]']) {
    assert.equal(previewContract(new URL(`http://${host}/?pointsPreview=ratified`)), '2.0.0-dev.2');
    assert.equal(previewContract(new URL(`http://${host}/?pointsPreview=synthetic`)), '2.0.0-dev.1');
  }
  for (const q of ['','?pointsPreview=unknown','?pointsPreview=__proto__','?pointsPreview=ratified&pointsPreview=synthetic'])
    assert.equal(previewContract(new URL('http://localhost/'+q)), null);
  assert.equal(await validateDev1(fixture), false);
  const old = JSON.parse(readFileSync(new URL('./fixtures/schema-v2-synthetic.json', import.meta.url)));
  assert.equal(await validateAsync(old), false);
});
test('DEV.2 strict shape rejects private fields, malformed dates, types, versions and bounds', async () => {
  for (const mutate of [p=>p.contractVersion='2.0.0-dev.1', p=>delete p.population,
    p=>p.population.sourceCount='31', p=>p.privateNotes='private',p=>p.members[0].canonicalKey='private',
    p=>p.awards[0].eventDate='2026-02-30',p=>p.source.observedAt='yesterday',
    p=>p.publication.approvedForProduction=true,p=>p.population.sourceCount=Number.MAX_SAFE_INTEGER+1,
    p=>p.rules[0].points=99,p=>p.members[0].displayName='<img onerror=x>',
    p=>p.awards[0].eventId='invented-event', p=>p.pendingSummary=[{status:'proposed_ineligible',count:1}],
    p=>p.awards=Array(10001).fill(p.awards[0]),p=>p.padding='x'.repeat(2_100_000)]) {
    const p=clone(fixture);mutate(p);assert.equal(await validateAsync(rehash(p)),false);
  }
  const deep=clone(fixture);let tail=deep;for(let i=0;i<100;i++)tail=tail.nested={};
  assert.equal(await validateAsync(deep), false);
  for (const p of [null,{},[],undefined]) assert.equal(await validateAsync(p), false);
});
test('DEV.2 validates arithmetic, all aggregate grains, IDs, member references and order', async () => {
  for (const mutate of [p=>p.population.confirmedIneligibleCount++,p=>p.population.unresolvedCount++,
    p=>p.population.withheldPoints++,p=>p.members.push(clone(p.members[0])),
    p=>p.awards[1].id=p.awards[0].id,p=>p.awards[0].memberId='m-ffffffffffffffff',
    p=>p.awards.reverse(),p=>p.recentAwardIds.reverse(),
    ...['members','eventTotals','roleTotals','eventRoleTotals','dailyTotals','cycleTotals','provenanceTotals']
      .map(k=>p=>p[k][0].candidatePoints++)]) {
    const p=clone(fixture);mutate(p);assert.equal(await validateAsync(rehash(p)),false);
  }
});
test('DEV.2 requires exact exception provenance and never creates a universal Other Commander rule', async () => {
  const idx=fixture.awards.findIndex(a=>a.provenanceType==='RATIFIED_HISTORICAL_EXCEPTION');
  for (const mutate of [p=>p.historicalExceptions=[],p=>p.historicalExceptions.push(clone(p.historicalExceptions[0])),
    p=>p.historicalExceptions[0].scope='ALL_FUTURE_CONTRIBUTIONS',p=>p.historicalExceptions[0].authority='UNKNOWN',
    p=>p.historicalExceptions[0].eventInstance='another',p=>p.historicalExceptions[0].approvalDate='2000-01-01',
    p=>p.awards[idx].ruleId='V2-01',p=>p.awards[idx].exceptionRef=null,
    p=>p.awards[idx].points=4,p=>p.awards[idx].provenanceType='APPROVED_RULE']) {
    const p=clone(fixture);mutate(p);assert.equal(await validateAsync(rehash(p)),false);
  }
  assert.equal(fixture.rules.find(r=>r.roleId==='other-commander').points,null);
  assert.equal(fixtures.pending.population.unresolvedCount,1);
  assert.equal(fixtures.pending.awards.some(a=>a.points===0),false);
});
test('DEV.2 rejects duplicate source tuples and all three non-stacking violations', async () => {
  for (const eventId of ['bfla','dragons-end','cm-convergence']) {
    const p=clone(fixture), base=p.awards.find(a=>a.provenanceType==='APPROVED_RULE');
    const pair=['commander','sub-lane-lead'].map(roleId=>{
      const r=p.rules.find(r=>r.eventId===eventId&&r.roleId===roleId);
      const a={...base,eventId,roleId,ruleId:r.id,points:r.points,eventInstance:'nonstack-test'};
      a.id=awardId(a,sha);return a;
    });
    p.awards.push(...pair);p.awards.sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id));
    p.population.sourceCount+=2;p.population.awardCandidateCount+=2;p.population.projectedAwardCount+=2;p.population.approvedRuleCount+=2;
    const pts=pair.reduce((s,a)=>s+a.points,0);
    for (const k of ['candidatePoints','projectedPoints','approvedRulePoints'])p.population[k]+=pts;
    Object.assign(p,derive(p.awards,p.members));assert.equal(await validateAsync(rehash(p)),false);
  }
  const p=clone(fixture), a={...p.awards[0],cycleId:p.awards[0].cycleId+10};a.id=awardId(a,sha);p.awards.push(a);
  assert.equal(await validateAsync(rehash(p)),false);
});
test('DEV.2 checksum awaits WebCrypto, preserves canonical array order, and fails without crypto', async () => {
  const p=clone(fixture);p.validation.contentHash='0'.repeat(64);assert.equal(await validateAsync(p),false);
  assert.equal(stable({b:2,a:1}),stable({a:1,b:2}));assert.notEqual(stable([1,2]),stable([2,1]));
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try {Object.defineProperty(globalThis,'crypto',{value:undefined,configurable:true});assert.equal(await validateAsync(fixture),false);}
  finally {Object.defineProperty(globalThis,'crypto',descriptor);}
});
test('DEV.2 namespaces and cache admission isolate v1, DEV.1, invalid and future-dated caches', async () => {
  const s=store();let requests=0;
  s.setItem('dcap.points.public.v1','unchanged');s.setItem('dcap.points.public.v2.preview.dev.1','unchanged');
  const loader=createV2Loader({...options(s),fetcher:async()=>{requests++;return response(fixture);}});
  assert.equal((await loader.load()).state,'live');assert.equal((await loader.load()).state,'cached');assert.equal(requests,1);
  assert.equal(s.getItem('dcap.points.public.v1'),'unchanged');assert.equal(s.getItem('dcap.points.public.v2.preview.dev.1'),'unchanged');
  for (const raw of ['{bad',JSON.stringify({version:'2.0.0-dev.1',cachedAt:1000,data:fixture}),
    JSON.stringify({version:V2_CACHE.cacheVersion,cachedAt:1001,data:fixture}),
    JSON.stringify({version:V2_CACHE.cacheVersion,cachedAt:1000,data:{...fixture,contractVersion:'unknown'}})]) {
    s.setItem(V2_CACHE.storageKey,raw);
    assert.equal((await createV2Loader({...options(s),now:()=>1000,fetcher:async()=>{throw Error();}}).load()).state,'unavailable');
  }
});
test('DEV.2 expired matching data falls back; different revision or same revision/different hash cannot promote', async () => {
  for(const change of [p=>p.migration.revision='dev-ratified-'+'f'.repeat(24),p=>p.members[0].displayName='Changed Fictional Name']) {
    const s=store(),p=clone(fixture);change(p);rehash(p);assert.equal(await validateAsync(p),true);
    s.setItem(V2_CACHE.storageKey,JSON.stringify({version:V2_CACHE.cacheVersion,cachedAt:1000,data:fixture}));
    const result=await createV2Loader({...options(s),now:()=>61000,fetcher:async()=>response(p)}).load();
    assert.equal(result.state,'fallback');assert.equal(result.data.validation.contentHash,fixture.validation.contentHash);
    s.setItem(V2_CACHE.storageKey,JSON.stringify({version:V2_CACHE.cacheVersion,cachedAt:61000,data:p}));
    assert.equal((await createV2Loader({...options(s),now:()=>61000,fetcher:async()=>{throw Error();}}).load()).state,'unavailable');
  }
});
test('DEV.2 in-memory pin rejects mid-session revision changes without explicit expected pin',async()=>{
  let now=1000,p=fixture;const loader=createV2Loader({storage:store(),now:()=>now,fetcher:async()=>response(p)});
  assert.equal((await loader.load()).state,'live');now+=60000;p=clone(fixture);p.members[0].displayName='Another Fictional Name';rehash(p);
  assert.equal((await loader.load()).state,'fallback');
});
test('DEV.2 invalid, HTTP, UTF-8, bounded streaming and storage failures are safe', async () => {
  for (const fetcher of [async()=>new Response('{bad'),async()=>new Response('x'.repeat(2_100_000)),
    async()=>new Response(new Uint8Array([255])),async()=>new Response('',{status:503}),async()=>{throw Error();},
    async()=>response({...fixture,contractVersion:'2.0.0-dev.1'})]) {
    assert.equal((await createV2Loader({...options(),fetcher}).load()).state,'unavailable');
  }
  const broken={getItem(){throw Error();},setItem(){throw Error();}};
  const loader=createV2Loader(options(broken));assert.equal((await loader.load()).state,'live');assert.equal((await loader.load()).state,'cached');
});
test('DEV.2 concurrent loads share a bounded request; timeout aborts and suppresses late promotion', async () => {
  const s=store();let done,abortSignal,calls=0,fire;
  const loader=createV2Loader({...options(s),fetcher:({signal})=>{calls++;abortSignal=signal;return new Promise(r=>done=r);},
    schedule:cb=>{fire=cb;return 1;},cancel:()=>{}});
  const first=loader.load(),second=loader.load();await new Promise(r=>setImmediate(r));
  fire();assert.equal((await first).state,'unavailable');assert.equal((await second).state,'unavailable');
  assert.equal(calls,1);assert.equal(abortSignal.aborted,true);done(response(fixture));await new Promise(r=>setTimeout(r,10));
  assert.equal(s.values.size,0);
});
test('DEV.2 invalid navigation context never silently selects a different fixture or revision',()=>{
  const base='http://localhost/?pointsPreview=ratified';
  for(const q of ['&fixture=unknown','&fixture=__proto__','&fixture=complete&fixture=pending','&previewRevision=bad','&previewHash=bad'])
    assert.equal(previewContext(new URL(base+q)),null);
  assert.equal(previewContext(new URL(base)).name,'complete');
});
test('DEV.2 partially specified expected binding cannot admit a feed',async()=>{
  for(const pin of [{expectedHash:null},{expectedRevision:null}])assert.equal((await createV2Loader({...options(),...pin}).load()).state,'unavailable');
});
test('DEV.2 executable schema equals accepted JSON Schema',async()=>{
 const { SCHEMA }=await import('../js/points/dev2/schema.mjs');
 assert.deepEqual(SCHEMA,JSON.parse(readFileSync(new URL('../docs/schema-v2-dev2.schema.json',import.meta.url))));
});
