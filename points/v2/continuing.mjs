/* Public cumulative continuing-season delta; r000 historical baseline is verified separately. */
export const DBS_COMMANDER_RULE=Object.freeze({"id":"N5E-DBS-COMMANDER-2","version":"DCAP Points v2.0","eventId":"dbs","roleId":"commander","eventLabel":"DBS","roleLabel":"Commander","points":2,"status":"APPROVED_NUMERIC","nonStackingGroup":null});
export function validateContinuing(d,b) {
 const ok=(condition,code)=>{if(!condition)throw Error("V2_DELTA_"+code)};
 const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
 const fields=(x,ks)=>obj(x)&&Object.keys(x).sort().join("|")===ks.slice().sort().join("|");
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x));
 ok(obj(b)&&b.kind==="HISTORICAL_PUBLIC_SNAPSHOT"&&b.schemaVersion===2,"BAD_BASE");
 ok(fields(d,["schemaVersion","contractVersion","kind","revision","baselineRevision","baselineSha256","source","season","rewardsEnabled","ruleAmendments","awards"]),"FIELDS");
 ok(d.schemaVersion===1&&d.contractVersion===b.contractVersion&&d.kind==="CONTINUING_PUBLIC_AWARDS_DELTA","CONTRACT");
 ok(/^r[0-9]{3,8}$/.test(d.revision)&&Number(d.revision.slice(1))>0&&d.baselineRevision==="r000"&&d.baselineSha256==="2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73","PIN");
 ok(fields(d.source,["startDate","throughDate","evidenceType"])&&date(d.source.startDate)&&date(d.source.throughDate)&&d.source.startDate==="2026-10-22"&&d.source.throughDate>=d.source.startDate&&d.source.evidenceType==="OWNER_ATTESTED_DATE_ONLY","SOURCE");
 ok(fields(d.season,["rawCycleId","displayLabel","automaticReset"])&&JSON.stringify(d.season)===JSON.stringify(b.season)&&d.rewardsEnabled===false,"SEASON");
 ok(Array.isArray(d.ruleAmendments)&&d.ruleAmendments.length===1&&fields(d.ruleAmendments[0],Object.keys(DBS_COMMANDER_RULE))&&Object.keys(DBS_COMMANDER_RULE).every(k=>d.ruleAmendments[0][k]===DBS_COMMANDER_RULE[k]),"RULE_AMENDMENT");
 ok(Array.isArray(d.awards)&&d.awards.length>0&&d.awards.length<=10000,"LIST_SIZE");
 const memberIds=new Set(b.members.map(m=>m.id)),eventIds=new Set(b.events.map(e=>e.id)),historicAwardIds=new Set(b.awards.map(a=>a.id));
 const ruleIds=new Map(b.rules.filter(r=>Number.isInteger(r.points)&&r.points>0).map(r=>[r.id,r]));ruleIds.set(DBS_COMMANDER_RULE.id,DBS_COMMANDER_RULE);
 const seen=new Set();let points=0;
 for(const a of d.awards){
  ok(fields(a,["cycleId","eventDate","eventId","id","memberId","points","provenanceType","roleId","ruleId"]),"AWARD_FIELDS");
  ok(typeof a.id==="string"&&/^a-c-[0-9a-f]{24}$/.test(a.id)&&!historicAwardIds.has(a.id)&&!seen.has(a.id),"AWARD_ID");seen.add(a.id);
  ok(a.cycleId===0&&a.provenanceType==="APPROVED_RULE"&&date(a.eventDate)&&a.eventDate>=d.source.startDate&&a.eventDate<=d.source.throughDate&&memberIds.has(a.memberId)&&eventIds.has(a.eventId),"AWARD_CONTEXT");
  const rule=ruleIds.get(a.ruleId);
  ok(rule&&Number.isSafeInteger(a.points)&&a.points>0&&a.points===rule.points&&(rule.eventId===a.eventId||rule.eventId==="all-events")&&rule.roleId===a.roleId,"AWARD_POINTS");points+=a.points;
 }
 return Object.freeze({valid:true,awards:d.awards.length,points,memberCount:memberIds.size,revision:d.revision});
}
export function combineContinuing(b,d) {
 const accepted=validateContinuing(d,b), all=b.awards.concat(d.awards);
 const tally=(dimensions)=>{
  const map=new Map();
  for(const a of all){
   const key=dimensions.map(k=>String(a[k])).join("|");
   let x=map.get(key);if(!x){x=Object.fromEntries(dimensions.map(k=>[k,a[k]]));x.candidatePoints=0;x.awardCandidateCount=0;map.set(key,x)}
   x.candidatePoints+=a.points;x.awardCandidateCount++;
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1]);
 };
 const added=new Map();
 for(const a of d.awards){const v=added.get(a.memberId)||{points:0,count:0};v.points+=a.points;v.count++;added.set(a.memberId,v)}
 const members=b.members.map(m=>{const x=added.get(m.id)||{points:0,count:0};return {...m,candidatePoints:m.candidatePoints+x.points,awardCandidateCount:m.awardCandidateCount+x.count}});
 const sorted=[...members].sort((a,b)=>b.candidatePoints-a.candidatePoints||a.id.localeCompare(b.id));
 const ranks=new Map();let lastPoints=null,rank=0;for(let i=0;i<sorted.length;i++){if(sorted[i].candidatePoints!==lastPoints){rank=i+1;lastPoints=sorted[i].candidatePoints}ranks.set(sorted[i].id,rank)}
 for(const m of members)m.partialRank=ranks.get(m.id);
 const aggregates={eventTotals:tally(["eventId"]),roleTotals:tally(["roleId"]),eventRoleTotals:tally(["eventId","roleId"]),dailyTotals:tally(["eventDate"]),cycleTotals:[{cycleId:0,candidatePoints:all.reduce((s,a)=>s+a.points,0),awardCandidateCount:all.length}]};
 const population={...b.population,sourceCount:b.population.sourceCount+accepted.awards,awardCandidateCount:b.population.awardCandidateCount+accepted.awards,candidatePoints:b.population.candidatePoints+accepted.points,approvedRuleCount:b.population.approvedRuleCount+accepted.awards,approvedRulePoints:b.population.approvedRulePoints+accepted.points};
 return {...b,members,awards:all,rules:b.rules.concat(d.ruleAmendments),aggregates,population,continuing:{revision:d.revision,startDate:d.source.startDate,throughDate:d.source.throughDate,awardCount:accepted.awards,points:accepted.points}};
}
