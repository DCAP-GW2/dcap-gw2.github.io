/**
 * DCAP v2 — OFFLINE ONLY, owner-governed read-only public projection.
 * Requires TWO separate private Sheets, NEVER touches the v1 ledger:
 * 1. existing N5 real award journal, and 2. separately approved registry workbook.
 * No writer functions, no doPost, no triggers, no private data logging.
 */
const OWN_KIND_='CONTINUING_PUBLIC_OWNER_FEED',OWN_START_='2026-10-22';
const OWN_HASH_='2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73';
const OWN_CONTRACT_='2.0.0-public-candidate.1';
const OWN_EVENTS_=Object.freeze(["aetherblade-assault","bfla","cm-convergence","dbs","defense-of-amnytas","dragons-end","dragons-stand","dragonstorm","guild-missions","gyala-delve","mothman","rifts","secrets-of-the-weald","triple-trouble","twisted-marionette","wizard-tower","wvw"]);
const OWN_RULES_=Object.freeze([{"eventId":"triple-trouble","eventLabel":"Triple Trouble","id":"V2-01","nonStackingGroup":null,"points":3,"roleId":"taxi","roleLabel":"Taxi","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"triple-trouble","eventLabel":"Triple Trouble","id":"V2-02","nonStackingGroup":null,"points":5,"roleId":"map-spammer","roleLabel":"Map Spammer","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"triple-trouble","eventLabel":"Triple Trouble","id":"V2-03","nonStackingGroup":null,"points":3,"roleId":"blocker","roleLabel":"Blocker","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"triple-trouble","eventLabel":"Triple Trouble","id":"V2-04","nonStackingGroup":null,"points":3,"roleId":"setup","roleLabel":"Setup","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"triple-trouble","eventLabel":"Triple Trouble","id":"V2-05","nonStackingGroup":null,"points":3,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"dbs","eventLabel":"DBS","id":"V2-06","nonStackingGroup":null,"points":2,"roleId":"derv-escort","roleLabel":"Derv Escort","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"dbs","eventLabel":"DBS","id":"V2-07","nonStackingGroup":null,"points":2,"roleId":"doordash-feed","roleLabel":"Doordash / Feed","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"bfla","eventLabel":"BFLA","id":"V2-08","nonStackingGroup":"BFLA","points":3,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"bfla","eventLabel":"BFLA","id":"V2-09","nonStackingGroup":"BFLA","points":2,"roleId":"sub-lane-lead","roleLabel":"Sub/Lane Lead","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"twisted-marionette","eventLabel":"Twisted Marionette","id":"V2-10","nonStackingGroup":null,"points":4,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"dragonstorm","eventLabel":"Dragonstorm","id":"V2-11","nonStackingGroup":null,"points":2,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"dragons-stand","eventLabel":"Dragon's Stand","id":"V2-12","nonStackingGroup":null,"points":3,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"wvw","eventLabel":"WvW","id":"V2-13","nonStackingGroup":null,"points":5,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"gyala-delve","eventLabel":"Gyala Delve","id":"V2-14","nonStackingGroup":null,"points":5,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"gyala-delve","eventLabel":"Gyala Delve","id":"V2-15","nonStackingGroup":null,"points":5,"roleId":"map-spammer","roleLabel":"Map Spammer","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"guild-missions","eventLabel":"Guild Missions","id":"V2-16","nonStackingGroup":null,"points":5,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"aetherblade-assault","eventLabel":"Aetherblade Assault","id":"V2-17","nonStackingGroup":null,"points":2,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"dragons-end","eventLabel":"Dragon's End","id":"V2-18","nonStackingGroup":"Dragon's End","points":5,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"dragons-end","eventLabel":"Dragon's End","id":"V2-19","nonStackingGroup":"Dragon's End","points":3,"roleId":"sub-lane-lead","roleLabel":"Sub/Lane Lead","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"cm-convergence","eventLabel":"CM Convergence","id":"V2-20","nonStackingGroup":"CM Convergence","points":5,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"cm-convergence","eventLabel":"CM Convergence","id":"V2-21","nonStackingGroup":"CM Convergence","points":2,"roleId":"sub-lane-lead","roleLabel":"Sub/Lane Lead","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"defense-of-amnytas","eventLabel":"Defense of Amnytas","id":"V2-22","nonStackingGroup":null,"points":4,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"secrets-of-the-weald","eventLabel":"Secrets of the Weald","id":"V2-23","nonStackingGroup":null,"points":4,"roleId":"commander","roleLabel":"Commander","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"all-events","eventLabel":"All events","id":"V2-24","nonStackingGroup":null,"points":2,"roleId":"student","roleLabel":"Student","status":"APPROVED_NUMERIC","version":"DCAP Points v2.0"},{"eventId":"actual-event-retained","eventLabel":"Actual event retained","id":"V2-25","nonStackingGroup":null,"points":null,"roleId":"other-commander","roleLabel":"Other Commander","status":"PENDING","version":"DCAP Points v2.0"}]);
const OWN_DBS_=Object.freeze({id:'dbs-commander-initial-2026-10-22',ruleId:'N5E-DBS-COMMANDER-2',eventId:'dbs',roleId:'commander',points:2,effectiveFrom:OWN_START_});
const OWN_SHEETS_=Object.freeze({
 legacy:"'N5 Real Award Journal'!A1:T10001",
 members:"'N5 Public Members'!A1:E10001",
 events:"'N5 Events'!A1:D10001",
 rules:"'N5 Rule Versions'!A1:H10001",
 future:"'N5 Owner Awards'!A1:M10001"
});
const OWN_HEADERS_=Object.freeze({
 legacy:['seq','entryId','candidateKey','sourceMessageId','sourceReference','eventDate','eventId','instanceId','memberId','roleId','ruleId','v2Points','approvedBy','approvedAt','approvalDigest','ruleVersion','status','prevDigest','rowDigest','processingRevision'],
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 future:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType','ownerDecisionRef','status','ruleVersionId','approvedAt']
});
const ownFail_=k=>{throw Error('PRIVATE_OWNER_FEED_'+k)};
const ownCheck_=(v,k)=>{if(!v)ownFail_(k)};
const ownDate_=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const ownId_=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(s);
const ownPositive_=n=>Number.isSafeInteger(n)&&n>0;
const ownDecision_=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{6,90}$/.test(s);
const ownRuleMatch_=(r,award)=>r.roleId===award.roleId&&(r.eventId===award.eventId||r.eventId==='all-events');
function ownReadRows_(values,kind){
 const headers=OWN_HEADERS_[kind];
 ownCheck_(Array.isArray(values)&&values.length&&JSON.stringify(values[0])===JSON.stringify(headers),'HEADERS_'+kind);
 const rows=values.slice(1);
 ownCheck_(rows.length<=10000,'ROWS_'+kind);
 for(const row of rows)ownCheck_(Array.isArray(row)&&row.length===headers.length,'ROW_LENGTH_'+kind);
 return rows.map(row=>Object.fromEntries(headers.map((key,index)=>[key,row[index]])));
}
function ownReadPublicIds_(raw){
 const arr=JSON.parse(raw||'null');
 // This is the immutable original roster, not a permanent maximum member count.
 ownCheck_(Array.isArray(arr)&&arr.length===37&&new Set(arr).size===37&&
  arr.every(x=>typeof x==='string'&&/^m-[0-9a-f]{16}$/.test(x)),'HISTORICAL_IDS');
 return new Set(arr);
}
function ownCurrentRule_(ruleId,onDate,base,versions){
 const candidates=versions.filter(v=>v.ruleId===ruleId&&v.effectiveFrom<=onDate)
  .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
 return candidates.at(-1)||base.find(r=>r.id===ruleId)||null;
}
function ownOtherCommander_(eventId,onDate,base,versions){
 for(const r of base){
  if(r.roleId==='commander'&&r.eventId===eventId&&ownPositive_(r.points)){
   const current=ownCurrentRule_(r.id,onDate,base,versions);
   if(current&&ownPositive_(current.points)&&current.roleId==='commander'&&current.eventId===eventId)return false;
  }
 }
 return !versions.some(v=>v.roleId==='commander'&&v.eventId===eventId&&v.effectiveFrom<=onDate);
}
function buildOwnerPublicFeed_(raw,originalPublicIds){
 const baselineIds=ownReadPublicIds_(JSON.stringify([...originalPublicIds]));
 const existingEvents=new Set(OWN_EVENTS_);
 const legacy=ownReadRows_(raw.legacy,'legacy');
 const registeredMembers=ownReadRows_(raw.members,'members');
 const registeredEvents=ownReadRows_(raw.events,'events');
 const registeredRules=ownReadRows_(raw.rules,'rules');
 const future=ownReadRows_(raw.future,'future');

 const members=[],memberIds=new Set(baselineIds),memberDates=new Map();
 for(const m of registeredMembers){
  ownCheck_(ownId_(m.memberId)&&typeof m.displayName==='string'&&m.displayName.trim().length>0&&m.displayName.length<=160&&
   ownDate_(m.approvedFrom)&&m.status==='OWNER_FINAL'&&ownDecision_(m.ownerDecisionRef)&&
   !memberDates.has(m.memberId),'MEMBER_REGISTRY');
  members.push({id:m.memberId,displayName:m.displayName,approvedFrom:m.approvedFrom});
  memberDates.set(m.memberId,m.approvedFrom);memberIds.add(m.memberId);
 }
 const events=[];
 for(const e of registeredEvents){
  ownCheck_(ownId_(e.eventId)&&!existingEvents.has(e.eventId)&&
   typeof e.eventLabel==='string'&&e.eventLabel.trim().length>0&&e.eventLabel.length<=160&&
   e.status==='OWNER_FINAL'&&ownDecision_(e.ownerDecisionRef),'EVENT_REGISTRY');
  existingEvents.add(e.eventId);events.push({id:e.eventId,label:e.eventLabel});
 }
 const versionIds=new Set([OWN_DBS_.id]),versionDates=new Set([OWN_DBS_.ruleId+'|'+OWN_START_]);
 const versions=[OWN_DBS_];
 const rules=new Map(OWN_RULES_.filter(r=>ownPositive_(r.points)).map(r=>[r.id,r]));
 rules.set(OWN_DBS_.ruleId,OWN_DBS_);
 for(const v of registeredRules){
  ownCheck_(ownId_(v.ruleVersionId)&&!versionIds.has(v.ruleVersionId)&&
   ownId_(v.ruleId)&&ownId_(v.eventId)&&existingEvents.has(v.eventId)&&
   ownId_(v.roleId)&&v.roleId!=='other-commander'&&
   ownPositive_(v.points)&&ownDate_(v.effectiveFrom)&&v.effectiveFrom>=OWN_START_&&
   v.status==='OWNER_FINAL'&&ownDecision_(v.ownerDecisionRef),'RULE_REGISTRY');
  const prior=rules.get(v.ruleId);
  ownCheck_(!prior||(prior.eventId===v.eventId&&prior.roleId===v.roleId),'RULE_SCOPE');
  const key=v.ruleId+'|'+v.effectiveFrom;
  ownCheck_(!versionDates.has(key),'RULE_EFFECTIVE_DATE');
  versionDates.add(key);versionIds.add(v.ruleVersionId);
  rules.set(v.ruleId,prior||v);
  versions.push({id:v.ruleVersionId,ruleId:v.ruleId,eventId:v.eventId,roleId:v.roleId,
   points:v.points,effectiveFrom:v.effectiveFrom});
 }
 const approvals=new Set(),awardIds=new Set(),contribKeys=new Set();
 const awards=[];
 let recent=OWN_START_;
 function addAward(a,instanceId){
  ownCheck_(/^[a-f0-9]{24}$/.test(a.id.slice(4))&&a.id.startsWith('a-c-')&&!awardIds.has(a.id),'AWARD_ID');
  ownCheck_(ownDate_(a.eventDate)&&a.eventDate>=OWN_START_&&existingEvents.has(a.eventId)&&
   memberIds.has(a.memberId)&&ownPositive_(a.points),'AWARD_CONTEXT');
  if(!baselineIds.has(a.memberId))ownCheck_(memberDates.has(a.memberId)&&memberDates.get(a.memberId)<=a.eventDate,'MEMBER_EFFECTIVE_DATE');
  ownCheck_(typeof instanceId==='string'&&instanceId.length>0,'INSTANCE');
  const role=a.roleId==='other-commander'?'commander':a.roleId;
  const key=[a.eventDate,a.eventId,instanceId,a.memberId,role].join('|');
  ownCheck_(!contribKeys.has(key),'DUPLICATE_CONTRIBUTION');contribKeys.add(key);awardIds.add(a.id);
  if(a.provenanceType==='OWNER_MANUAL_OTHER_COMMANDER'){
   ownCheck_(a.roleId==='other-commander'&&a.ruleId===null&&ownOtherCommander_(a.eventId,a.eventDate,OWN_RULES_,versions),'MANUAL_UNAPPROVED');
  }else{
   ownCheck_(a.provenanceType==='APPROVED_RULE'&&ownId_(a.ruleId)&&rules.has(a.ruleId),'RULE_ID');
   const r=ownCurrentRule_(a.ruleId,a.eventDate,OWN_RULES_,versions);
   ownCheck_(r&&ownRuleMatch_(r,a)&&a.points===r.points,'RULE_POINT_MISMATCH');
  }
  awards.push(a);if(a.eventDate>recent)recent=a.eventDate;
 }
 let priorDigest='GENESIS';
 for(let i=0;i<legacy.length;i++){
  const row=legacy[i];
  ownCheck_(row.seq===i+1&&row.status==='REAL_APPROVED'&&row.ruleVersion==='DCAP Points v2.0'&&
   row.prevDigest===priorDigest&&/^[a-f0-9]{64}$/.test(String(row.rowDigest))&&
   /^[a-f0-9]{64}$/.test(String(row.approvalDigest)),'LEGACY_INTEGRITY');
  ownCheck_(/^[0-9a-f]{24}$/.test(row.candidateKey)&&!approvals.has(row.candidateKey),'LEGACY_CANDIDATE');
  approvals.add(row.candidateKey);priorDigest=row.rowDigest;
  addAward({id:'a-c-'+row.candidateKey,memberId:row.memberId,eventDate:row.eventDate,eventId:row.eventId,
   roleId:row.roleId,ruleId:row.ruleId,points:row.v2Points,cycleId:0,provenanceType:'APPROVED_RULE'},row.instanceId);
 }
 for(const f of future){
  // Pending Other Commander cases are intentionally not published or scored.
  if(f.status==='PENDING_OWNER_POINTS')continue;
  ownCheck_(f.status==='OWNER_FINAL'&&ownDecision_(f.ownerDecisionRef)&&
   typeof f.approvedAt==='string'&&Number.isFinite(Date.parse(f.approvedAt)),'OWNER_APPROVAL');
  ownCheck_(/^[0-9a-f]{24}$/.test(f.candidateKey)&&!approvals.has(f.candidateKey),'FUTURE_CANDIDATE');
  approvals.add(f.candidateKey);
  ownCheck_(f.awardType==='APPROVED_RULE'||f.awardType==='OWNER_MANUAL_OTHER_COMMANDER','AWARD_KIND');
  const manual=f.awardType==='OWNER_MANUAL_OTHER_COMMANDER';
  ownCheck_(manual?(f.roleId==='other-commander'&&(f.ruleId===''||f.ruleId===null)&&
   (f.ruleVersionId===''||f.ruleVersionId===null)):
   (ownId_(f.ruleId)&&(f.ruleVersionId===''||f.ruleVersionId===null||versionIds.has(f.ruleVersionId))),'AWARD_RULE_REF');
  addAward({id:'a-c-'+f.candidateKey,memberId:f.memberId,eventDate:f.eventDate,eventId:f.eventId,
   roleId:f.roleId,ruleId:manual?null:f.ruleId,points:f.points,cycleId:0,
   provenanceType:f.awardType},f.instanceId);
 }
 return {schemaVersion:2,contractVersion:OWN_CONTRACT_,kind:OWN_KIND_,baselineRevision:'r000',
  baselineSha256:OWN_HASH_,source:{startDate:OWN_START_,throughDate:recent,evidenceType:'OWNER_ATTESTED_DATE_ONLY'},
  season:{rawCycleId:0,displayLabel:'Test Run',automaticReset:false},rewardsEnabled:false,
  members,events,ruleVersions:versions,awards};
}
/** Sole web entrypoint. Cannot write private journal/registries. */
function doGet(){
 try{
  const props=PropertiesService.getScriptProperties();
  const journalId=props.getProperty('DCAP_V2_JOURNAL_ID');
  const registryId=props.getProperty('DCAP_V2_REGISTRY_ID');
  const allow=ownReadPublicIds_(props.getProperty('DCAP_V2_PUBLIC_IDS_JSON'));
  ownCheck_([journalId,registryId].every(s=>typeof s==='string'&&/^[A-Za-z0-9_-]{20,}$/.test(s)),'SHEET_CONFIG');
  const read=(id,range)=>(Sheets.Spreadsheets.Values.get(id,range,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
  const raw={legacy:read(journalId,OWN_SHEETS_.legacy),members:read(registryId,OWN_SHEETS_.members),
   events:read(registryId,OWN_SHEETS_.events),rules:read(registryId,OWN_SHEETS_.rules),
   future:read(registryId,OWN_SHEETS_.future)};
  return ContentService.createTextOutput(JSON.stringify(buildOwnerPublicFeed_(raw,allow)))
    .setMimeType(ContentService.MimeType.JSON);
 }catch{
  return ContentService.createTextOutput('{"kind":"UNAVAILABLE"}')
    .setMimeType(ContentService.MimeType.JSON);
 }
}
/** Owner-only private test: receipt contains aggregate counts, no private fields. */
function testPrivateOwnerFeed(){
 const data=JSON.parse(doGet().getContent());
 ownCheck_(data.kind===OWN_KIND_&&Array.isArray(data.awards),'UNAVAILABLE');
 const receipt={stage:'DCAP_V2_OWNER_REGISTRY_PREFLIGHT',state:'PASS',
  awards:data.awards.length,points:data.awards.reduce((x,a)=>x+a.points,0),
  publicNewMembers:data.members.filter(m=>!ownReadPublicIds_(PropertiesService.getScriptProperties().getProperty('DCAP_V2_PUBLIC_IDS_JSON')).has(m.id)).length,
  manualCommanderAwards:data.awards.filter(a=>a.provenanceType==='OWNER_MANUAL_OTHER_COMMANDER').length,
  throughEventDate:data.source.throughDate,rewardsEnabled:data.rewardsEnabled};
 console.log(JSON.stringify(receipt));return receipt;
}
