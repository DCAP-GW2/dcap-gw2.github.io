import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateOwnerFeed,combineOwnerFeed,classifyCommander,OTHER_COMMANDER,OWNER_MANUAL,OWNER_FEED_KIND} from '../points/v2/owner-feed.mjs';
import {planContribution,planRuleChange} from '../backend/points-v2-owner-registry/owner-planner.mjs';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const baseline=read('points/data/v2/releases/r000.json');
const delta=read('points/data/v2/releases/r001.json');
const SEED={id:'dbs-commander-initial-2026-10-22',ruleId:'N5E-DBS-COMMANDER-2',eventId:'dbs',roleId:'commander',points:2,effectiveFrom:'2026-10-22'};
const base=()=>({
 schemaVersion:2,contractVersion:delta.contractVersion,kind:OWNER_FEED_KIND,
 baselineRevision:'r000',baselineSha256:delta.baselineSha256,source:structuredClone(delta.source),
 season:structuredClone(delta.season),rewardsEnabled:false,
 members:[],events:[],ruleVersions:[structuredClone(SEED)],awards:structuredClone(delta.awards)
});
const addNew=(f,i,changes={})=>f.awards.push({...structuredClone(delta.awards[0]),
 id:'a-c-'+i.toString(16).padStart(24,'0'),eventDate:'2026-11-19',...changes});
const manual=(id,eventId,memberId,points=4)=>({
 cycleId:0,eventDate:'2026-11-19',eventId,id:'a-c-'+id.toString(16).padStart(24,'0'),
 memberId,points,provenanceType:OWNER_MANUAL,roleId:OTHER_COMMANDER,ruleId:null
});
const rules=baseline.rules;

test('original 60 approved awards are valid without changing committee-set values',()=>{
 const f=base(),v=validateOwnerFeed(f,baseline);
 assert.deepEqual(v,{valid:true,awards:60,points:192,publicMembers:37,
  manualAwards:0,manualPoints:0,standardAwards:60,standardPoints:192,throughDate:'2026-10-26'});
 const r=combineOwnerFeed(baseline,f);
 assert.equal(r.population.candidatePoints,1886);
 assert.equal(r.population.awardCandidateCount,611);
 assert.equal(r.members.length,37);
 assert.equal(r.population.originalPoints,2371);
 assert.equal(r.rules.find(x=>x.id==='V2-25').points,null);
 assert.equal(r.rewardsEnabled,false);
 assert.deepEqual(r.awards.slice(0,551),baseline.awards);
});

test('38th member plus an outside-event Other Commander makes 38 dynamic profiles',()=>{
 const f=base();const newcomer='m-000000000000cafe';
 f.members.push({id:newcomer,displayName:'New Commander',approvedFrom:'2026-11-19'});
 f.events.push({id:'legendary-ley-line-anomaly',label:'Legendary Ley-Line Anomaly'});
 f.awards.push(manual(1,'legendary-ley-line-anomaly',newcomer,4));
 f.source.throughDate='2026-11-19';
 const v=validateOwnerFeed(f,baseline);
 assert.equal(v.manualAwards,1);assert.equal(v.manualPoints,4);assert.equal(v.publicMembers,38);
 const r=combineOwnerFeed(baseline,f);
 assert.equal(r.members.length,38);assert.equal(r.population.candidatePoints,1890);
 assert.equal(r.population.awardCandidateCount,612);
 const m=r.members.find(x=>x.id===newcomer);
 assert.equal(m.candidatePoints,4);assert.equal(m.partialRank,1+r.members.filter(x=>x.candidatePoints>4).length);
 assert.equal(r.events.find(x=>x.id==='legendary-ley-line-anomaly').label,'Legendary Ley-Line Anomaly');
 assert.equal(r.population.missingPublicIdCount,6);
});

test('no default Other Commander: same event always requires individual owner points',()=>{
 assert.equal(classifyCommander('legendary-ley-line-anomaly','2026-11-19',rules).classification,'OTHER_COMMANDER');
 assert.equal(classifyCommander('mothman','2026-11-19',rules).requiresOwnerPoints,true);
 assert.equal(classifyCommander('triple-trouble','2026-11-19',rules).points,3);
 const item={eventId:'legendary-ley-line-anomaly',memberId:'m-000000000000cafe',
  eventDate:'2026-11-19',instanceId:'run1',roleId:'commander'};
 const p=planContribution(item,{baselineRules:rules});
 assert.equal(p.state,'PENDING_OWNER_POINTS');assert.equal(p.points,null);
 const decided=planContribution({...item,points:4,ownerFinal:true,ownerDecisionRef:'owner-final-001'},{baselineRules:rules});
 assert.equal(decided.awardType,OWNER_MANUAL);assert.equal(decided.points,4);
 assert.equal(planContribution({...item,instanceId:'run2'},{baselineRules:rules}).state,'PENDING_OWNER_POINTS');
 assert.throws(()=>planContribution({...item,points:0,ownerFinal:true,ownerDecisionRef:'owner-final-001'},{baselineRules:rules}),/OWNER_PLAN_MANUAL_POINTS/);
});

test('sole owner can change a standard rule prospectively without rescoring historical awards',()=>{
 const f=base();
 const proposal=planRuleChange({ruleId:'V2-05',points:4,effectiveFrom:'2026-11-19',
  ownerFinal:true,ownerDecisionRef:'owner-final-002'},{baselineRules:rules});
 assert.equal(proposal.state,'OWNER_FINAL');assert.equal(proposal.retrospective,false);
 f.ruleVersions.push(proposal.record);
 addNew(f,2,{eventId:'triple-trouble',roleId:'commander',ruleId:'V2-05',points:4});
 f.source.throughDate='2026-11-19';
 const r=combineOwnerFeed(baseline,f);
 assert.equal(r.awards.length,612);
 assert.equal(r.rules.find(x=>x.id==='V2-05').points,4);
 assert.equal(r.awards.filter(a=>a.eventDate<'2026-11-19'&&a.ruleId==='V2-05')
  .every(a=>a.points===3),true);
 const original=structuredClone(f);original.awards.at(-1).points=3;
 assert.throws(()=>validateOwnerFeed(original,baseline),/OWNER_FEED_AWARD_POINTS_DATE/);
 const changed=structuredClone(f);changed.ruleVersions.pop();
 assert.throws(()=>validateOwnerFeed(changed,baseline),/OWNER_FEED_AWARD_POINTS_DATE/);
});

test('Other Commander case cannot be used to bypass an existing standard Commander rule',()=>{
 const f=base();f.awards.push(manual(3,'triple-trouble',baseline.members[0].id,5));
 f.source.throughDate='2026-11-19';
 assert.throws(()=>validateOwnerFeed(f,baseline),/OWNER_FEED_MANUAL_NOT_NEEDED/);
 assert.throws(()=>planContribution({eventId:'triple-trouble',memberId:baseline.members[0].id,
  eventDate:'2026-11-19',instanceId:'run1',roleId:'other-commander',points:5,ownerFinal:true,
  ownerDecisionRef:'owner-final-003'},{baselineRules:rules}),/OWNER_PLAN_STANDARD_COMMANDER_EXISTS/);
});

test('owner can establish a new event-specific Commander rule; only later awards follow it',()=>{
 const f=base();
 f.events.push({id:'legendary-ley-line-anomaly',label:'Legendary Ley-Line Anomaly'});
 f.awards.push(manual(4,'legendary-ley-line-anomaly',baseline.members[0].id));
 f.ruleVersions.push({id:'ley-commander-from-2026-11-20',
  ruleId:'LEY-COMMANDER',eventId:'legendary-ley-line-anomaly',roleId:'commander',
  points:6,effectiveFrom:'2026-11-20'});
 f.awards.push({...manual(5,'legendary-ley-line-anomaly',baseline.members[0].id,6),
  eventDate:'2026-11-20',roleId:'commander',provenanceType:'APPROVED_RULE',ruleId:'LEY-COMMANDER'});
 f.source.throughDate='2026-11-20';
 const result=validateOwnerFeed(f,baseline);assert.equal(result.manualAwards,1);
 const invalid=structuredClone(f);invalid.awards.at(-1).roleId='other-commander';
 invalid.awards.at(-1).provenanceType=OWNER_MANUAL;invalid.awards.at(-1).ruleId=null;
 assert.throws(()=>validateOwnerFeed(invalid,baseline),/OWNER_FEED_MANUAL_NOT_NEEDED/);
});

test('bad, duplicate or unapproved new members, event IDs, points and rules fail closed',()=>{
 const cases=[
  f=>{f.members.push({id:'m-invalid',displayName:'New',approvedFrom:'2026-11-19'})},
  f=>{f.members.push({id:'m-000000000000cafe',displayName:'New',approvedFrom:'2026-11-19'});
   f.members.push({id:'m-000000000000cafe',displayName:'New Again',approvedFrom:'2026-11-19'})},
  f=>{f.awards[0].points=500},
  f=>{f.awards[0].ownerEmail='private'},
  f=>{f.rewardsEnabled=true},
  f=>{f.ruleVersions.push({id:'other-default',ruleId:'OC-NUMERIC',eventId:'triple-trouble',
   roleId:'other-commander',points:4,effectiveFrom:'2026-11-19'})},
  f=>{f.events.push({id:'triple-trouble',label:'Duplicate'})},
  f=>{f.awards.push(structuredClone(f.awards[0]))}
 ];
 for(const mutate of cases){const f=base();mutate(f);assert.throws(()=>validateOwnerFeed(f,baseline),/OWNER_FEED_/)}
});
