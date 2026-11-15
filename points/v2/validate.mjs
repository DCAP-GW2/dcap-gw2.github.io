import {CONTRACT} from './config.mjs';
import {RULES} from './rules.mjs';
const bad=x=>{throw Error('V2_VALIDATION_'+x)};
const check=(condition,x)=>{if(!condition)bad(x)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nat=x=>Number.isSafeInteger(x)&&x>=0;
const validId=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(x);
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':obj(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const equal=(a,b)=>canonical(a)===canonical(b);
const exact=(v,keys)=>obj(v)&&equal(Object.keys(v).sort(),keys.slice().sort());
const sums=(awards,keyOf)=>{const m=new Map();for(const a of awards){const key=keyOf(a);const v=m.get(key)||{candidatePoints:0,awardCandidateCount:0};v.candidatePoints+=a.points;v.awardCandidateCount++;m.set(key,v)}return m};
const verifyGrain=(rows,keys,expected)=>{check(rows.length===expected.size,'AGG_SIZE');const seen=new Set();for(const a of rows){check(exact(a,[...keys,'candidatePoints','awardCandidateCount']),'AGG_FIELDS');const key=keys.map(k=>a[k]).join('|');check(!seen.has(key),'AGG_DUPLICATE');seen.add(key);const e=expected.get(key);check(e&&e.candidatePoints===a.candidatePoints&&e.awardCandidateCount===a.awardCandidateCount,'AGG_RECONCILIATION')}};
export function validateV2(doc) {
 check(obj(doc)&&Object.keys(doc).length===12,'ROOT_FIELDS');
 const keys=['schemaVersion','contractVersion','kind','source','season','population','rewardsEnabled','rules','events','members','awards','aggregates'];
 check(keys.every(k=>Object.prototype.hasOwnProperty.call(doc,k)),'ROOT_KEYS');
 check(doc.schemaVersion===2&&doc.contractVersion===CONTRACT&&doc.kind==='HISTORICAL_PUBLIC_SNAPSHOT','CONTRACT');
 check(doc.rewardsEnabled===false&&doc.season?.rawCycleId===0&&doc.season?.displayLabel==='Test Run'&&doc.season?.automaticReset===false,'SEASON_REWARDS');
 check(exact(doc.source,['asOf','timeZone','dataType'])&&exact(doc.season,['rawCycleId','displayLabel','automaticReset'])&&exact(doc.population,['sourceCount','originalPoints','confirmedIneligibleCount','awardCandidateCount','candidatePoints','canonicalMemberCount','observedPublicIdCount','missingPublicIdCount','approvedRuleCount','approvedRulePoints','ratifiedExceptionCount','ratifiedExceptionPoints']),'CLOSED_METADATA');
 check(typeof doc.source?.asOf==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(doc.source.asOf)&&doc.source.timeZone==='Pacific/Auckland'&&doc.source.dataType==='HISTORICAL','SOURCE');
 const p=doc.population;
 check(obj(p)&&[p.sourceCount,p.originalPoints,p.confirmedIneligibleCount,p.awardCandidateCount,p.candidatePoints,p.canonicalMemberCount,p.observedPublicIdCount,p.missingPublicIdCount,p.ratifiedExceptionCount,p.approvedRuleCount,p.ratifiedExceptionPoints,p.approvedRulePoints].every(nat),'POPULATION');
 check(p.canonicalMemberCount===p.observedPublicIdCount+p.missingPublicIdCount,'ID_ACCOUNTING');
 check(p.sourceCount===p.awardCandidateCount+p.confirmedIneligibleCount,'SOURCE_ACCOUNTING');
 check(Array.isArray(doc.rules)&&doc.rules.length===RULES.length,'RULES_SIZE');
 for(let i=0;i<RULES.length;i++)check(equal(doc.rules[i],RULES[i]),'RULES_FIXED');
 check(Array.isArray(doc.events)&&doc.events.every(e=>exact(e,['id','label','eligibility'])&&validId(e.id)&&typeof e.label==='string'),'EVENTS');
 const ee=new Set(doc.events.map(x=>x.id));check(ee.size===doc.events.length,'EVENT_DUPLICATE');
 check(Array.isArray(doc.members)&&Array.isArray(doc.awards)&&doc.members.length<=10000&&doc.awards.length<=10000,'DATA_LISTS');
 const members=new Map(),counts=new Map();
 for(const m of doc.members){
  check(exact(m,['id','displayName','candidatePoints','awardCandidateCount','partialRank'])&&validId(m.id)&&typeof m.displayName==='string'&&m.displayName.trim().length>0&&m.displayName.length<160&&nat(m.candidatePoints)&&nat(m.awardCandidateCount)&&nat(m.partialRank)&&!members.has(m.id),'MEMBER');
  members.set(m.id,m);counts.set(m.id,{n:0,points:0});
 }
 check(members.size===p.observedPublicIdCount,'PUBLIC_MEMBER_COUNT');
 const ids=new Set();let points=0,fromRules=0,exceptions=0,rulePoints=0,exceptionPoints=0;
 for(const a of doc.awards){
  check(exact(a,['id','memberId','eventId','roleId','eventDate','cycleId','ruleId','points','provenanceType'])&&validId(a.id)&&validId(a.memberId)&&members.has(a.memberId)&&validId(a.eventId)&&ee.has(a.eventId)&&validId(a.roleId)&&typeof a.eventDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.eventDate)&&nat(a.points)&&a.points>0&&a.cycleId===0&&typeof a.provenanceType==='string'&&!ids.has(a.id),'AWARD');
  ids.add(a.id);points+=a.points;const c=counts.get(a.memberId);c.n++;c.points+=a.points;
  if(a.provenanceType==='APPROVED_RULE'){
   check(typeof a.ruleId==='string'&&RULES.some(r=>r.id===a.ruleId&&(r.eventId===a.eventId||r.eventId==='all-events')&&r.roleId===a.roleId&&r.points===a.points),'AWARD_FIXED_RULE');fromRules++;rulePoints+=a.points;
  }else if(a.provenanceType==='RATIFIED_HISTORICAL_EXCEPTION'){
   check(a.ruleId===null,'EXCEPTION_RULE');exceptions++;exceptionPoints+=a.points;
  }else bad('PROVENANCE');
 }
 check(doc.awards.length===p.awardCandidateCount&&points===p.candidatePoints&&fromRules===p.approvedRuleCount&&exceptions===p.ratifiedExceptionCount&&rulePoints===p.approvedRulePoints&&exceptionPoints===p.ratifiedExceptionPoints,'TOTALS');
 for(const [id,m] of members){const c=counts.get(id);check(c.points===m.candidatePoints&&c.n===m.awardCandidateCount,'MEMBER_TOTALS');}
 const agg=doc.aggregates;check(obj(agg)&&['eventTotals','roleTotals','eventRoleTotals','dailyTotals','cycleTotals'].every(k=>Array.isArray(agg[k])),'AGGREGATES');
 verifyGrain(agg.eventTotals,['eventId'],sums(doc.awards,a=>a.eventId));
 verifyGrain(agg.roleTotals,['roleId'],sums(doc.awards,a=>a.roleId));
 verifyGrain(agg.eventRoleTotals,['eventId','roleId'],sums(doc.awards,a=>a.eventId+'|'+a.roleId));
 verifyGrain(agg.dailyTotals,['eventDate'],sums(doc.awards,a=>a.eventDate));
 check(agg.cycleTotals.length===1&&exact(agg.cycleTotals[0],['cycleId','candidatePoints','awardCandidateCount'])&&agg.cycleTotals[0].cycleId===0&&agg.cycleTotals[0].candidatePoints===points&&agg.cycleTotals[0].awardCandidateCount===doc.awards.length,'CYCLE_TOTAL');
 return Object.freeze({valid:true,awards:doc.awards.length,points,members:members.size});
}
