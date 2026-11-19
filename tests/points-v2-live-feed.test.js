import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateV2} from '../points/v2/validate.mjs';
import {validateLiveFeed,combineLiveFeed,LIVE_FEED_KIND} from '../points/v2/live-feed.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const historical=read('points/data/v2/releases/r000.json');
const r001=read('points/data/v2/releases/r001.json');
const base=()=>{
 const {revision,kind,...rest}=structuredClone(r001);
 return {...rest,kind:LIVE_FEED_KIND};
};
const clone=x=>structuredClone(x);
const total=a=>a.reduce((s,x)=>s+x.points,0);

test('immutable historical r000 baseline remains valid',()=>{
 assert.deepEqual(validateV2(historical),{valid:true,awards:551,points:1694,members:37});
});
test('single public endpoint has no numbered continuing revision',()=>{
 const feed=base();
 assert.equal(feed.revision,undefined);
 assert.equal(feed.kind,LIVE_FEED_KIND);
 assert.deepEqual(validateLiveFeed(feed,historical),{
  valid:true,awards:60,points:192,members:37,throughDate:'2026-10-26'
 });
});
test('combined totals 1886/611/37 and original v1 totals unchanged',()=>{
 const doc=combineLiveFeed(historical,base());
 assert.equal(doc.population.candidatePoints,1886);
 assert.equal(doc.population.awardCandidateCount,611);
 assert.equal(doc.members.length,37);
 assert.equal(doc.awards.length,611);
 assert.equal(doc.population.originalPoints,2371);
 assert.equal(doc.population.missingPublicIdCount,6);
 assert.equal(doc.rewardsEnabled,false);
 assert.equal(doc.season.displayLabel,'Test Run');
 assert.equal(doc.rules.find(x=>x.id==='V2-25').points,null);
 assert.equal(doc.rules.find(x=>x.id==='N5E-DBS-COMMANDER-2').points,2);
 assert.deepEqual(doc.awards.slice(0,551),historical.awards);
 assert.equal(doc.continuing?.revision,undefined);
});
test('all public aggregate grains and partial ranks reconcile',()=>{
 const doc=combineLiveFeed(historical,base());
 const sum=x=>x.reduce((s,a)=>s+a.candidatePoints,0);
 for(const grain of ['eventTotals','roleTotals','eventRoleTotals','dailyTotals','cycleTotals'])
  assert.equal(sum(doc.aggregates[grain]),1886,grain);
 for(const m of doc.members){
  const awards=doc.awards.filter(a=>a.memberId===m.id);
  assert.equal(total(awards),m.candidatePoints);
  assert.equal(awards.length,m.awardCandidateCount);
  assert.equal(m.partialRank,1+doc.members.filter(o=>o.candidatePoints>m.candidatePoints).length);
 }
});
test('new awards beyond 60 update automatically without r002',()=>{
 const feed=base();
 for(let i=0;i<65;i++){
  const original=feed.awards[i%feed.awards.length];
  feed.awards.push({...original,id:'a-c-'+(i+1).toString(16).padStart(24,'0'),eventDate:'2026-10-27'});
 }
 feed.source.throughDate='2026-10-27';
 const result=validateLiveFeed(feed,historical),doc=combineLiveFeed(historical,feed);
 assert.equal(result.awards,125);
 assert.equal(result.points,192+total(feed.awards.slice(60)));
 assert.equal(doc.population.awardCandidateCount,676);
 assert.equal(doc.population.candidatePoints,1694+result.points);
 assert.equal(feed.revision,undefined);
});
test('empty continuing journal is valid and displays r000 totals',()=>{
 const feed=base();feed.awards=[];feed.source.throughDate='2026-10-22';
 assert.equal(validateLiveFeed(feed,historical).awards,0);
 assert.equal(combineLiveFeed(historical,feed).population.candidatePoints,1694);
});
test('strict validation fails closed on wrong date, rule, identity, provenance, fields, season',()=>{
 const cases=[
  x=>{x.awards[0].points=100},x=>{x.awards[0].memberId='m-notapproved'},
  x=>{x.awards[1].id=x.awards[0].id},x=>{x.awards[0].id=historical.awards[0].id},
  x=>{x.awards[0].eventDate='2026-02-30'},x=>{x.awards[0].eventDate='2026-10-28'},
  x=>{x.awards[0].provenanceType='PRIVATE'},x=>{x.awards[0].rawEvidence='private'},
  x=>{x.awards[0].ruleId='V2-25'},x=>{x.ruleAmendments[0].points=3},
  x=>{x.rewardsEnabled=true},x=>{x.season.automaticReset=true},
  x=>{x.baselineSha256='0'.repeat(64)},x=>{x.privateJournal='private'},
  x=>{x.source.throughDate='2026-11-01'}
 ];
 for(const mutate of cases){
  const feed=base();mutate(feed);
  assert.throws(()=>validateLiveFeed(feed,historical),/V2_PUBLIC_LIVE_/);
 }
});
test('finite, closed publication fields exclude private audit material',()=>{
 const feed=base();
 assert.deepEqual(Object.keys(feed).sort(),[
  'schemaVersion','contractVersion','kind','baselineRevision','baselineSha256','source',
  'season','rewardsEnabled','ruleAmendments','awards'
 ].sort());
 for(const a of feed.awards)assert.deepEqual(Object.keys(a).sort(),[
  'cycleId','eventDate','eventId','id','memberId','points','provenanceType','roleId','ruleId'
 ].sort());
 for(const term of ['approvedBy','approvalDigest','journalTip','processingRevision','rowDigest',
 'prevDigest','sourceMessageId','sourceReference','scriptId','spreadsheetId']) {
  assert(!JSON.stringify(feed).includes(term),term);
 }
});
