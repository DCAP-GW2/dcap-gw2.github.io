/**
 * Closed public live-feed contract. No numbered continuing releases.
 * The immutable historical r000 snapshot remains the only static baseline.
 * Score values arrive from the approved private journal; the client checks
 * them against frozen committee rules but never grants new awards.
 */
import {CONTRACT,HISTORICAL_REVISION,HISTORICAL_SHA256} from './config.mjs';
import {DBS_COMMANDER_RULE} from './continuing.mjs';

const FIELDS=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
const GOOD_DATE=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const VALID_ID=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(s);
const NO_PRIVATE=['sourceReference','sourceMessageId','approvalDigest','approvedBy','rowDigest','prevDigest','scriptId','spreadsheetId'];
const fail=reason=>{throw Error('V2_PUBLIC_LIVE_'+reason)};
const requireThat=(v,why)=>{if(!v)fail(why)};
export const LIVE_FEED_KIND='CONTINUING_PUBLIC_AWARDS_FEED';

export function validateLiveFeed(feed,baseline) {
 requireThat(baseline?.kind==='HISTORICAL_PUBLIC_SNAPSHOT'&&baseline.schemaVersion===2,'BAD_BASE');
 requireThat(FIELDS(feed,[
  'schemaVersion','contractVersion','kind','baselineRevision','baselineSha256',
  'source','season','rewardsEnabled','ruleAmendments','awards'
 ]),'FIELDS');
 requireThat(feed.schemaVersion===1&&feed.contractVersion===CONTRACT&&
  feed.kind===LIVE_FEED_KIND&&feed.baselineRevision===HISTORICAL_REVISION&&
  feed.baselineSha256===HISTORICAL_SHA256,'CONTRACT');
 requireThat(FIELDS(feed.source,['startDate','throughDate','evidenceType'])&&
  feed.source.startDate==='2026-10-22'&&GOOD_DATE(feed.source.throughDate)&&
  feed.source.throughDate>=feed.source.startDate&&
  feed.source.evidenceType==='OWNER_ATTESTED_DATE_ONLY','SOURCE');
 requireThat(FIELDS(feed.season,['rawCycleId','displayLabel','automaticReset'])&&
  feed.season.rawCycleId===baseline.season.rawCycleId&&
  feed.season.displayLabel===baseline.season.displayLabel&&
  feed.season.automaticReset===false&&feed.rewardsEnabled===false,'SEASON_REWARDS');
 requireThat(Array.isArray(feed.ruleAmendments)&&feed.ruleAmendments.length===1&&
  FIELDS(feed.ruleAmendments[0],Object.keys(DBS_COMMANDER_RULE))&&
  Object.keys(DBS_COMMANDER_RULE).every(k=>feed.ruleAmendments[0][k]===DBS_COMMANDER_RULE[k]),'AMENDMENT');
 requireThat(Array.isArray(feed.awards)&&feed.awards.length<=10000,'SIZE');
 const members=new Set(baseline.members.map(m=>m.id));
 const events=new Set(baseline.events.map(e=>e.id));
 const existing=new Set(baseline.awards.map(a=>a.id));
 const rules=new Map(baseline.rules.filter(x=>Number.isSafeInteger(x.points)&&x.points>0).map(x=>[x.id,x]));
 rules.set(DBS_COMMANDER_RULE.id,DBS_COMMANDER_RULE);
 const seen=new Set();
 let total=0,latest='2026-10-22';
 for (const award of feed.awards) {
  requireThat(FIELDS(award,['cycleId','eventDate','eventId','id','memberId','points','provenanceType','roleId','ruleId']),'AWARD_FIELDS');
  requireThat(typeof award.id==='string'&&/^a-c-[0-9a-f]{24}$/.test(award.id)&&
    !existing.has(award.id)&&!seen.has(award.id),'DUPLICATE');
  seen.add(award.id);
  requireThat(award.cycleId===0&&award.provenanceType==='APPROVED_RULE'&&
   GOOD_DATE(award.eventDate)&&award.eventDate>=feed.source.startDate&&
   award.eventDate<=feed.source.throughDate&&members.has(award.memberId)&&
   events.has(award.eventId)&&VALID_ID(award.roleId),'CONTEXT');
  const rule=rules.get(award.ruleId);
  requireThat(rule&&rule.roleId===award.roleId&&
   (rule.eventId===award.eventId||rule.eventId==='all-events')&&
   Number.isSafeInteger(award.points)&&award.points>0&&award.points===rule.points,'POINTS');
  total+=award.points;
  requireThat(Number.isSafeInteger(total),'TOTAL_OVERFLOW');
  if(award.eventDate>latest)latest=award.eventDate;
 }
 requireThat(feed.source.throughDate===latest,'DATE_THROUGH');
 // Closed schemas already exclude private audit fields; keep this check explicit.
 requireThat(!NO_PRIVATE.some(k=>Object.prototype.hasOwnProperty.call(feed,k)),'PRIVATE_FIELDS');
 return Object.freeze({valid:true,awards:seen.size,points:total,members:members.size,throughDate:latest});
}

export function combineLiveFeed(baseline,feed) {
 const result=validateLiveFeed(feed,baseline);
 const awards=baseline.awards.concat(feed.awards);
 const deltaByMember=new Map();
 for(const award of feed.awards){
  const x=deltaByMember.get(award.memberId)||{count:0,points:0};
  x.count++;x.points+=award.points;deltaByMember.set(award.memberId,x);
 }
 const members=baseline.members.map(m=>{
  const x=deltaByMember.get(m.id)||{count:0,points:0};
  return {...m,candidatePoints:m.candidatePoints+x.points,awardCandidateCount:m.awardCandidateCount+x.count};
 });
 for(const m of members)m.partialRank=1+members.filter(o=>o.candidatePoints>m.candidatePoints).length;
 const totals=keys=>{
  const map=new Map();
  for(const a of awards){
   const key=keys.map(k=>a[k]).join('|');
   if(!map.has(key)){
    const item=Object.fromEntries(keys.map(k=>[k,a[k]]));
    map.set(key,{...item,candidatePoints:0,awardCandidateCount:0});
   }
   const item=map.get(key);item.candidatePoints+=a.points;item.awardCandidateCount++;
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,row])=>row);
 };
 const population={...baseline.population,
  sourceCount:baseline.population.sourceCount+result.awards,
  awardCandidateCount:baseline.population.awardCandidateCount+result.awards,
  candidatePoints:baseline.population.candidatePoints+result.points,
  approvedRuleCount:baseline.population.approvedRuleCount+result.awards,
  approvedRulePoints:baseline.population.approvedRulePoints+result.points
 };
 const aggregates={
  eventTotals:totals(['eventId']),roleTotals:totals(['roleId']),
  eventRoleTotals:totals(['eventId','roleId']),
  dailyTotals:totals(['eventDate']),cycleTotals:[{
   cycleId:0,candidatePoints:population.candidatePoints,
   awardCandidateCount:population.awardCandidateCount
  }]
 };
 return {...baseline,awards,members,population,aggregates,
  rules:baseline.rules.concat(feed.ruleAmendments),
  continuing:{throughDate:result.throughDate,awardCount:result.awards,points:result.points},
  liveFeed:true};
}
