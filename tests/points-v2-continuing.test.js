import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';
import {validateV2} from '../points/v2/validate.mjs';
import {validateContinuing, combineContinuing} from '../points/v2/continuing.mjs';
import {verifyContinuingSelection, loadV2} from '../points/v2/continuing-loader.mjs';
import {HISTORICAL_SHA256, HISTORICAL_REVISION, CACHE_KEY} from '../points/v2/config.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url));
const historicalBytes = read('points/data/v2/releases/r000.json');
const deltaBytes = read('points/data/v2/releases/r001.json');
const selectionBytes = read('points/data/v2/selection.json');
const historical = JSON.parse(historicalBytes.toString('utf8'));
const delta = JSON.parse(deltaBytes.toString('utf8'));
// The staged publishing selector intentionally remains r000. Test r001 through a
// locally constructed, never-published selection; retain the real hold selector too.
const stagedSelection = JSON.parse(selectionBytes.toString('utf8'));
const selection = {...stagedSelection,revision:'r001',path:'/points/data/v2/releases/r001.json',sha256:createHash('sha256').update(deltaBytes).digest('hex')};
const clone = x => structuredClone(x);
const sha256 = x => createHash('sha256').update(x).digest('hex');
const sum = xs => xs.reduce((n,x) => n+x.points,0);
const DELTA_CACHE_KEY = CACHE_KEY+'.continuing';

test('immutable r000 and candidate r001 match their published SHA-256 pins', () => {
  assert.equal(sha256(historicalBytes), HISTORICAL_SHA256);
  assert.equal(sha256(deltaBytes), selection.sha256);
  assert.equal(selection.lastKnownGood.sha256, HISTORICAL_SHA256);
  assert.equal(selection.lastKnownGood.revision, HISTORICAL_REVISION);
  assert.equal(selection.revision,'r001');
  assert.equal(selection.path,'/points/data/v2/releases/r001.json');
});

test('staged release selector keeps r000 selected until separate owner cutover', () => {
  assert.equal(stagedSelection.revision,'r000');
  assert.equal(stagedSelection.lastKnownGood.revision,'r000');
  assert.equal(stagedSelection.sha256,HISTORICAL_SHA256);
  assert.equal(stagedSelection.path,'/points/data/v2/releases/r000.json');
});

test('both closed contracts validate independently', () => {
  assert.deepEqual(validateV2(historical),{valid:true,awards:551,points:1694,members:37});
  assert.deepEqual(validateContinuing(delta,historical),{valid:true,awards:60,points:192,memberCount:37,revision:'r001'});
  assert.equal(verifyContinuingSelection(selection),selection);
});

test('continuing release adds exactly 60 approved awards / 192 points / 18 known contributors', () => {
  assert.equal(delta.awards.length,60);
  assert.equal(sum(delta.awards),192);
  assert.equal(new Set(delta.awards.map(x=>x.memberId)).size,18);
  assert.equal(delta.awards.filter(x=>x.ruleId==='N5E-DBS-COMMANDER-2').length,5);
  assert(delta.awards.filter(x=>x.ruleId==='N5E-DBS-COMMANDER-2').every(x=>x.points===2));
  assert(delta.awards.every(x=>x.provenanceType==='APPROVED_RULE'&&x.cycleId===0));
  assert.equal(new Set(delta.awards.map(x=>x.id)).size,60);
  assert(!delta.awards.some(x=>historical.awards.some(y=>y.id===x.id)));
});

test('merge reconciles 1,886 points, 611 awards, 37 published profiles, historical provenance', () => {
  const before=JSON.stringify(historical);
  const result=combineContinuing(historical,delta);
  assert.equal(JSON.stringify(historical),before,'r000 must remain unchanged');
  assert.equal(result.population.candidatePoints,1886);
  assert.equal(result.population.awardCandidateCount,611);
  assert.equal(result.population.sourceCount,698);
  assert.equal(result.population.canonicalMemberCount,43);
  assert.equal(result.population.observedPublicIdCount,37);
  assert.equal(result.population.missingPublicIdCount,6);
  assert.equal(result.members.length,37);
  assert.equal(result.awards.length,611);
  assert.equal(sum(result.awards),1886);
  assert.equal(result.population.ratifiedExceptionCount,4);
  assert.equal(result.population.ratifiedExceptionPoints,12);
  assert.equal(result.population.originalPoints,historical.population.originalPoints);
  assert.equal(result.rewardsEnabled,false);
  assert.deepEqual(result.season,{rawCycleId:0,displayLabel:'Test Run',automaticReset:false});
  assert.deepEqual(result.awards.slice(0,551),historical.awards);
});

test('all member totals, tied partial ranks, and aggregation grains reconcile', () => {
  const doc=combineContinuing(historical,delta);
  for (const m of doc.members) {
    const own=doc.awards.filter(x=>x.memberId===m.id);
    assert.equal(m.candidatePoints,sum(own));
    assert.equal(m.awardCandidateCount,own.length);
    assert.equal(m.partialRank,1+doc.members.filter(x=>x.candidatePoints>m.candidatePoints).length);
  }
  const expected=[
    ['eventTotals',['eventId']],['roleTotals',['roleId']],['eventRoleTotals',['eventId','roleId']],['dailyTotals',['eventDate']],['cycleTotals',['cycleId']]
  ];
  for (const [kind,fields] of expected) {
    const tally=new Map();
    for (const a of doc.awards) {
      const key=fields.map(k=>a[k]).join('|');
      const v=tally.get(key)||{candidatePoints:0,awardCandidateCount:0};
      v.candidatePoints+=a.points;v.awardCandidateCount++;tally.set(key,v);
    }
    assert.equal(doc.aggregates[kind].length,tally.size);
    for (const row of doc.aggregates[kind]) {
      const key=fields.map(k=>row[k]).join('|');
      assert.deepEqual({candidatePoints:row.candidatePoints,awardCandidateCount:row.awardCandidateCount},tally.get(key));
    }
  }
});

test('public delta has no private journal or audit fields', () => {
  assert.deepEqual(Object.keys(delta).sort(),[
    'awards','baselineRevision','baselineSha256','contractVersion','kind','revision','rewardsEnabled',
    'ruleAmendments','schemaVersion','season','source'
  ].sort());
  for (const award of delta.awards) assert.deepEqual(Object.keys(award).sort(),[
    'cycleId','eventDate','eventId','id','memberId','points','provenanceType','roleId','ruleId'
  ].sort());
  assert.equal(delta.source.evidenceType,'OWNER_ATTESTED_DATE_ONLY');
  assert.equal(delta.source.startDate,'2026-10-22');
  assert.equal(delta.source.throughDate,'2026-10-26');
  assert(!/(@|journalTip|reviewDigest|scriptId|spreadsheetId|receipt|loggedAt|rawEvidence)/i.test(deltaBytes.toString('utf8')));
});

test('mutations fail closed rather than silently changing scoring decisions', () => {
  const fail=mutate=>{const bad=clone(delta);mutate(bad);assert.throws(()=>validateContinuing(bad,historical),/V2_DELTA_/);};
  fail(d=>{d.awards[1].id=d.awards[0].id;});
  fail(d=>{d.awards[0].id=historical.awards[0].id;});
  fail(d=>{d.awards[0].memberId='m-fake';});
  fail(d=>{d.awards[0].points+=1;});
  fail(d=>{d.awards[0].ruleId='V2-NOT-APPROVED';});
  fail(d=>{d.awards[0].eventDate='2026-10-21';});
  fail(d=>{d.awards[0].cycleId=1;});
  fail(d=>{d.awards[0].journalReceipt='private';});
  fail(d=>{d.rewardsEnabled=true;});
  fail(d=>{d.season.displayLabel='New Season';});
  fail(d=>{d.ruleAmendments[0].points=3;});
  fail(d=>{d.source.evidenceType='RAW_JOURNAL';});
  fail(d=>{d.baselineSha256='0'.repeat(64);});
});

test('selector rejects hash, path, last-known-good and contract changes', () => {
  const fail=mutate=>{const bad=clone(selection);mutate(bad);assert.throws(()=>verifyContinuingSelection(bad));};
  fail(s=>{s.path='/points/data/v2/releases/r000.json';});
  fail(s=>{s.sha256='not-a-sha';});
  fail(s=>{s.lastKnownGood.sha256='0'.repeat(64);});
  fail(s=>{s.lastKnownGood.revision='r001';});
  fail(s=>{s.contractVersion='wrong';});
  fail(s=>{s.privateJournal='do-not-publish';});
});

// Same-origin request simulation: no network, real immutable release bytes.
const savedFetch=globalThis.fetch;
const savedStorage=globalThis.localStorage;
const savedCrypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');
const storage=new Map();
const routes=new Map();
Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
globalThis.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
globalThis.fetch=async url=>{
  const path=String(url);
  if (!routes.has(path)) return new Response('unavailable',{status:503});
  return new Response(routes.get(path),{status:200,headers:{'content-type':'application/json'}});
};
function reset() {
  storage.clear(); routes.clear();
  routes.set('/points/data/v2/selection.json',new TextEncoder().encode(JSON.stringify(selection)));
  routes.set('/points/data/v2/releases/r000.json',historicalBytes);
  routes.set('/points/data/v2/releases/r001.json',deltaBytes);
}
test.after(()=>{
  globalThis.fetch=savedFetch;
  if (savedStorage===undefined) delete globalThis.localStorage;
  else globalThis.localStorage=savedStorage;
  if (savedCrypto) Object.defineProperty(globalThis,'crypto',savedCrypto);
  else delete globalThis.crypto;
});

test('real selection r001 renders verified combined totals', async () => {
  reset();const x=await loadV2();
  assert.equal(x.revision,'r001');
  assert.equal(x.data.population.candidatePoints,1886);
  assert.equal(x.data.awards.length,611);
  assert.equal(x.data.members.length,37);
  assert.equal(x.data.rewardsEnabled,false);
});

test('historical-only r000 selector restores r000 even after r001 was cached', async () => {
  reset();assert.equal((await loadV2()).revision,'r001');
  const reverted={...clone(selection),revision:'r000',path:'/points/data/v2/releases/r000.json',sha256:HISTORICAL_SHA256};
  routes.set('/points/data/v2/selection.json',JSON.stringify(reverted));
  const x=await loadV2();
  assert.equal(x.revision,'r000');
  assert.equal(x.data.population.candidatePoints,1694);
  assert.equal(x.data.awards.length,551);
});

test('missing current delta falls back to baseline without a cached delta', async () => {
  reset();routes.delete('/points/data/v2/releases/r001.json');
  const x=await loadV2();
  assert.equal(x.revision,'r000');
  assert.equal(x.data.population.candidatePoints,1694);
  assert.equal(x.state,'last-available');
});

test('missing delta with matching previously verified cache displays last available r001', async () => {
  reset();assert.equal((await loadV2()).revision,'r001');
  routes.delete('/points/data/v2/releases/r001.json');
  const stale=JSON.parse(storage.get(DELTA_CACHE_KEY));
  stale.savedAt=Date.now()-120000;
  storage.set(DELTA_CACHE_KEY,JSON.stringify(stale));
  const x=await loadV2();
  assert.equal(x.state,'last-available');
  assert.equal(x.revision,'r001');
  assert.equal(x.data.population.candidatePoints,1886);
});

test('selector outage allows pinned verified cached r001 but never invented data', async () => {
  reset();assert.equal((await loadV2()).revision,'r001');
  routes.delete('/points/data/v2/selection.json');
  const known=await loadV2();
  assert.equal(known.revision,'r001');
  assert.equal(known.state,'last-available');
  storage.clear();
  const fake=clone(delta);
  const extra={...clone(fake.awards[0]),id:'a-c-'+'f'.repeat(24)};
  fake.awards.push(extra);
  const text=JSON.stringify(fake);
  storage.set(DELTA_CACHE_KEY,JSON.stringify({
    revision:'r999',sha256:sha256(text),text,savedAt:Date.now()
  }));
  const rejected=await loadV2();
  assert.equal(rejected.revision,'r000');
  assert.equal(rejected.data.population.candidatePoints,1694);
});

test('tampered cached data cannot be promoted even with a valid selector', async () => {
  reset();assert.equal((await loadV2()).revision,'r001');
  const c=JSON.parse(storage.get(DELTA_CACHE_KEY));
  c.text+=' '; // Valid JSON with a different SHA-256 digest must fail cache validation.
  storage.set(DELTA_CACHE_KEY,JSON.stringify(c));
  routes.delete('/points/data/v2/releases/r001.json');
  const x=await loadV2();
  assert.equal(x.revision,'r000');
  assert.equal(x.data.population.candidatePoints,1694);
});
