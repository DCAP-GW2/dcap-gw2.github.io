/**
 * Public v2 owner-governed feed: append-only approved members, prospective
 * rule versions and case-by-case Other Commander points. Historical r000 is immutable.
 * This module never calculates discretionary awards or writes to a registry.
 */
import {CONTRACT,HISTORICAL_REVISION,HISTORICAL_SHA256} from './config.mjs';

export const OWNER_FEED_KIND='CONTINUING_PUBLIC_OWNER_FEED';
export const OTHER_COMMANDER='other-commander';
export const OWNER_MANUAL='OWNER_MANUAL_OTHER_COMMANDER';
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===keys.slice().sort().join('|');
const id=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(s);
const ruleId=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{1,90}$/.test(s);
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const check=(condition,why)=>{if(!condition)throw Error('OWNER_FEED_'+why)};
const latestFor=(versions,ruleId,onDate)=>versions.filter(v=>v.ruleId===ruleId&&v.effectiveFrom<=onDate)
 .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);
const scoped=(r,e)=>r.eventId===e||r.eventId==='all-events';

/**
 * A commander is handled as Other Commander only when there is no currently
 * applicable event-specific commander rule. Never infer numeric points here.
 */
export function classifyCommander(eventId,eventDate,baseRules,versions=[]){
 check(id(eventId)&&date(eventDate)&&Array.isArray(baseRules),'CLASSIFY_INPUT');
 const rules=baseRules.filter(r=>r.roleId==='commander'&&positive(r.points)&&r.eventId===eventId);
 for(const v of versions){
  if(v.roleId==='commander'&&v.eventId===eventId&&v.effectiveFrom<=eventDate&&positive(v.points)){
   if(!rules.some(r=>r.id===v.ruleId))rules.push({id:v.ruleId,...v});
  }
 }
 for(const rule of rules){
  const v=latestFor(versions,rule.id,eventDate);
  if((v||rule).eventId===eventId)return {classification:'STANDARD_COMMANDER',ruleId:rule.id,points:(v||rule).points};
 }
 return {classification:'OTHER_COMMANDER',requiresOwnerPoints:true,points:null};
}

export function validateOwnerFeed(feed,baseline){
 check(baseline?.kind==='HISTORICAL_PUBLIC_SNAPSHOT'&&baseline.schemaVersion===2,'BASE');
 check(exact(feed,['schemaVersion','contractVersion','kind','baselineRevision','baselineSha256',
  'source','season','rewardsEnabled','members','events','ruleVersions','awards']),'FIELDS');
 check(feed.schemaVersion===2&&feed.contractVersion===CONTRACT&&feed.kind===OWNER_FEED_KIND&&
  feed.baselineRevision===HISTORICAL_REVISION&&feed.baselineSha256===HISTORICAL_SHA256,'CONTRACT');
 check(exact(feed.source,['startDate','throughDate','evidenceType'])&&
  feed.source.startDate==='2026-10-22'&&date(feed.source.throughDate)&&
  feed.source.throughDate>=feed.source.startDate&&feed.source.evidenceType==='OWNER_ATTESTED_DATE_ONLY','SOURCE');
 check(exact(feed.season,['rawCycleId','displayLabel','automaticReset'])&&
  feed.season.rawCycleId===baseline.season.rawCycleId&&
  feed.season.displayLabel===baseline.season.displayLabel&&feed.season.automaticReset===false&&
  feed.rewardsEnabled===false,'SEASON');
 check(Array.isArray(feed.members)&&feed.members.length<=10000&&
  Array.isArray(feed.events)&&feed.events.length<=10000&&
  Array.isArray(feed.ruleVersions)&&feed.ruleVersions.length<=10000&&
  Array.isArray(feed.awards)&&feed.awards.length<=10000,'LIMITS');

 const members=new Map(baseline.members.map(m=>[m.id,{...m}]));
 const updates=new Set();
 for(const m of feed.members){
  check(exact(m,['id','displayName','approvedFrom'])&&/^m-[a-f0-9]{16}$/.test(m.id)&&
   typeof m.displayName==='string'&&m.displayName.trim().length>0&&m.displayName.length<=160&&
   date(m.approvedFrom)&&!updates.has(m.id),'MEMBER');
  updates.add(m.id);
  // Existing public profiles keep their stable ID and scores; names may be owner-approved.
  const old=members.get(m.id);
  members.set(m.id,{id:m.id,displayName:m.displayName,candidatePoints:old?.candidatePoints??0,
   awardCandidateCount:old?.awardCandidateCount??0,partialRank:old?.partialRank??0});
 }
 const eventIds=new Set(baseline.events.map(e=>e.id)),events=[...baseline.events];
 for(const e of feed.events){
  check(exact(e,['id','label'])&&id(e.id)&&typeof e.label==='string'&&
   e.label.trim().length>0&&e.label.length<=160&&!eventIds.has(e.id),'EVENT');
  eventIds.add(e.id);events.push({id:e.id,label:e.label,eligibility:'OWNER_MANUAL_OR_RULE'});
 }
 const rules=new Map(baseline.rules.filter(r=>positive(r.points)).map(r=>[r.id,r]));
 const versions=[],seenVersions=new Set(),seenPairs=new Set();
 for(const v of feed.ruleVersions){
  check(exact(v,['id','ruleId','eventId','roleId','points','effectiveFrom'])&&
   id(v.id)&&ruleId(v.ruleId)&&id(v.eventId)&&id(v.roleId)&&v.roleId!==OTHER_COMMANDER&&
   (eventIds.has(v.eventId)||v.eventId==='all-events')&&positive(v.points)&&date(v.effectiveFrom)&&
   v.effectiveFrom>=feed.source.startDate&&!seenVersions.has(v.id),'RULE_VERSION');
  seenVersions.add(v.id);
  const old=rules.get(v.ruleId);
  check(!old||(old.eventId===v.eventId&&old.roleId===v.roleId),'RULE_ID_REUSED');
  const pair=v.ruleId+'|'+v.effectiveFrom;
  check(!seenPairs.has(pair),'RULE_DATE_CONFLICT');seenPairs.add(pair);
  if(!old)rules.set(v.ruleId,{...v});
  versions.push(v);
 }
 const baseIDs=new Set(baseline.awards.map(a=>a.id)),awardIds=new Set();
 let total=0,normalCount=0,normalPoints=0,manualCount=0,manualPoints=0,mostRecent=feed.source.startDate;
 for(const a of feed.awards){
  check(exact(a,['cycleId','eventDate','eventId','id','memberId','points','provenanceType','roleId','ruleId'])&&
   /^a-c-[a-f0-9]{24}$/.test(a.id)&&!baseIDs.has(a.id)&&!awardIds.has(a.id),'AWARD_FIELDS_ID');
  awardIds.add(a.id);
  check(a.cycleId===0&&date(a.eventDate)&&a.eventDate>=feed.source.startDate&&
   a.eventDate<=feed.source.throughDate&&eventIds.has(a.eventId)&&
   members.has(a.memberId)&&positive(a.points)&&id(a.roleId),'AWARD_CONTEXT');
  const memberChange=feed.members.find(m=>m.id===a.memberId);
  if(!baseline.members.some(m=>m.id===a.memberId))check(memberChange?.approvedFrom<=a.eventDate,'MEMBER_EFFECTIVE');
  if(a.provenanceType==='APPROVED_RULE'){
   check(ruleId(a.ruleId)&&rules.has(a.ruleId),'AWARD_RULE');
   const original=rules.get(a.ruleId),v=latestFor(versions,a.ruleId,a.eventDate);
   check((v||original).points===a.points&&
    (v||original).roleId===a.roleId&&scoped((v||original),a.eventId),'AWARD_POINTS_DATE');
   normalCount++;normalPoints+=a.points;
  }else if(a.provenanceType===OWNER_MANUAL){
   check(a.ruleId===null&&a.roleId===OTHER_COMMANDER,'MANUAL_ROLE');
   const classified=classifyCommander(a.eventId,a.eventDate,baseline.rules,versions);
   check(classified.classification==='OTHER_COMMANDER','MANUAL_NOT_NEEDED');
   manualCount++;manualPoints+=a.points;
  }else check(false,'AWARD_PROVENANCE');
  total+=a.points;check(Number.isSafeInteger(total),'POINT_OVERFLOW');
  if(a.eventDate>mostRecent)mostRecent=a.eventDate;
 }
 check(feed.source.throughDate===mostRecent,'SOURCE_MAX_DATE');
 return Object.freeze({valid:true,awards:feed.awards.length,points:total,
  publicMembers:members.size,manualAwards:manualCount,manualPoints,
  standardAwards:normalCount,standardPoints:normalPoints,throughDate:mostRecent});
}

export function combineOwnerFeed(baseline,feed){
 const accepted=validateOwnerFeed(feed,baseline);
 const all=baseline.awards.concat(feed.awards);
 const added=new Map();
 for(const a of feed.awards){const x=added.get(a.memberId)||{points:0,count:0};x.points+=a.points;x.count++;added.set(a.memberId,x)}
 const members=baseline.members.map(m=>({...m}));
 for(const m of feed.members){
  const previous=members.find(x=>x.id===m.id);
  if(previous)previous.displayName=m.displayName;
  else members.push({id:m.id,displayName:m.displayName,candidatePoints:0,awardCandidateCount:0,partialRank:0});
 }
 for(const m of members){
  const x=added.get(m.id)||{points:0,count:0};
  m.candidatePoints+=x.points;m.awardCandidateCount+=x.count;
 }
 for(const m of members)m.partialRank=1+members.filter(other=>other.candidatePoints>m.candidatePoints).length;
 const tally=keys=>{
  const m=new Map();
  for(const a of all){
   const key=keys.map(k=>a[k]).join('|');
   const item=m.get(key)||{...Object.fromEntries(keys.map(k=>[k,a[k]])),candidatePoints:0,awardCandidateCount:0};
   item.candidatePoints+=a.points;item.awardCandidateCount++;m.set(key,item);
  }
  return [...m].sort((a,b)=>a[0].localeCompare(b[0])).map(([,item])=>item);
 };
 const activeRules=baseline.rules.map(r=>({...r}));
 for(const v of feed.ruleVersions){
  const match=activeRules.find(r=>r.id===v.ruleId);
  if(match){if(!match.effectiveFrom||match.effectiveFrom<=v.effectiveFrom){
   match.points=v.points;match.effectiveFrom=v.effectiveFrom;match.status='OWNER_APPROVED';}}
  else activeRules.push({id:v.ruleId,version:'DCAP Points v2.0',eventId:v.eventId,roleId:v.roleId,
   eventLabel:([ ...baseline.events, ...feed.events].find(e=>e.id===v.eventId)?.label)||v.eventId,
   roleLabel:v.roleId==='commander'?'Commander':v.roleId,points:v.points,status:'OWNER_APPROVED',
   nonStackingGroup:null,effectiveFrom:v.effectiveFrom});
 }
 return {...baseline,members,events:baseline.events.concat(feed.events.map(e=>({...e,eligibility:'OWNER_MANUAL_OR_RULE'}))),
  awards:all,rules:activeRules,aggregates:{
   eventTotals:tally(['eventId']),roleTotals:tally(['roleId']),
   eventRoleTotals:tally(['eventId','roleId']),dailyTotals:tally(['eventDate']),
   cycleTotals:[{cycleId:0,candidatePoints:baseline.population.candidatePoints+accepted.points,
    awardCandidateCount:all.length}]},
  population:{...baseline.population,
   sourceCount:baseline.population.sourceCount+accepted.awards,
   candidatePoints:baseline.population.candidatePoints+accepted.points,
   awardCandidateCount:baseline.population.awardCandidateCount+accepted.awards,
   approvedRuleCount:baseline.population.approvedRuleCount+accepted.standardAwards,
   approvedRulePoints:baseline.population.approvedRulePoints+accepted.standardPoints,
   observedPublicIdCount:members.length,canonicalMemberCount:baseline.population.canonicalMemberCount+
     feed.members.filter(m=>!baseline.members.some(old=>old.id===m.id)).length,
   manualAwardCount:accepted.manualAwards,manualAwardPoints:accepted.manualPoints},
  continuing:{throughDate:accepted.throughDate,awardCount:accepted.awards,points:accepted.points},
  liveFeed:true};
}
