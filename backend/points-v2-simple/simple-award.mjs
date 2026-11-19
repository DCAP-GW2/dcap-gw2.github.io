/**
 * DCAP v2 — minimal v1-style Sheets transaction planner (OFFLINE, NO WRITES).
 *
 * An explicit final owner instruction, with exact event/member/instance, is
 * sufficient approval. No committee, Cloud project, API Executable or r00x.
 * Reads the existing journal and private registry before planning ONE append.
 * The connected Google Sheets tool may later execute the returned appendCells
 * request, followed by readback; nothing here grants write access.
 */
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const KEY=/^[a-f0-9]{24}$/;
const MEMBER=/^m-[a-f0-9]{16}$/;
const ID=/^[a-z0-9][a-z0-9-]{1,90}$/;
const RULE=/^[A-Za-z0-9][A-Za-z0-9-]{1,90}$/;
const POS=n=>Number.isSafeInteger(n)&&n>0;
const validDay=d=>typeof d==='string'&&DAY.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const requireOk=(ok,why)=>{if(!ok)throw Error('SIMPLE_V2_'+why)};
const cleanRow=(r,headers)=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']));
export const SCHEMA=Object.freeze({
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 future:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType','ownerDecisionRef','status','ruleVersionId','approvedAt'],
 legacy:['seq','entryId','candidateKey','sourceMessageId','sourceReference','eventDate','eventId','instanceId','memberId','roleId','ruleId','v2Points','approvedBy','approvedAt','approvalDigest','ruleVersion','status','prevDigest','rowDigest','processingRevision']
});
export const REGISTRY_TABS=Object.freeze({
 members:{name:'N5 Public Members',sheetId:1781507585},
 events:{name:'N5 Events',sheetId:18306101},
 rules:{name:'N5 Rule Versions',sheetId:18306102},
 future:{name:'N5 Owner Awards',sheetId:18306103}
});
export function parseSheetRows(grid,type){
 requireOk(Array.isArray(grid)&&Array.isArray(grid[0]),'MISSING_HEADER');
 const headers=SCHEMA[type];requireOk(headers&&JSON.stringify(grid[0])===JSON.stringify(headers),'HEADER_MISMATCH');
 return grid.slice(1).filter(r=>r.some(v=>v!==''&&v!==undefined&&v!==null)).map(r=>{
  requireOk(Array.isArray(r)&&r.length<=headers.length,'ROW_WIDTH');
  return cleanRow(r,headers);
 });
}
const eventInstanceKey=a=>[a.eventDate,a.eventId,a.instanceId,a.memberId,a.roleId==='other-commander'?'commander':a.roleId].join('|');
const eventInstanceGroupKey=(a,g)=>[a.eventDate,a.eventId,a.instanceId,a.memberId,g].join('|');
const latest=(versions,ruleId,date)=>versions.filter(x=>x.ruleId===ruleId&&x.effectiveFrom<=date)
 .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);
const effectiveRules=(baselineRules,versions,date)=>baselineRules.filter(r=>POS(r.points)).map(r=>{
 const change=latest(versions,r.id,date);return change?{...r,points:change.points}:r;
});
/** Return a plan, a duplicate warning, or a question requesting Other Commander points. */
export function planSimpleAward({baseline,registry,journal,decision}){
 requireOk(baseline&&Array.isArray(baseline.members)&&Array.isArray(baseline.rules)&&Array.isArray(baseline.events),'BASELINE');
 requireOk(registry&&Array.isArray(registry.members)&&Array.isArray(registry.rules)&&Array.isArray(registry.events)&&Array.isArray(registry.future),'REGISTRY');
 requireOk(Array.isArray(journal),'JOURNAL');
 const d=decision||{};
 requireOk(d.ownerFinal===true&&typeof d.ownerDecisionRef==='string'&&d.ownerDecisionRef.length>=6,'OWNER_FINAL');
 requireOk(KEY.test(d.candidateKey||'')&&validDay(d.eventDate)&&ID.test(d.eventId||'')&&
  MEMBER.test(d.memberId||'')&&typeof d.instanceId==='string'&&d.instanceId.trim().length>0&&
  d.instanceId.length<=256&&ID.test(d.roleId||''),'AWARD_INPUT');
 const members=new Set(baseline.members.map(m=>m.id));
 for(const m of registry.members){
  requireOk(m.status==='OWNER_FINAL'&&MEMBER.test(m.memberId)&&validDay(m.approvedFrom),'MEMBER_REGISTRY');
  if(m.approvedFrom<=d.eventDate)members.add(m.memberId);
 }
 requireOk(members.has(d.memberId),'MEMBER_UNKNOWN');
 const events=new Set(baseline.events.map(e=>e.id));
 for(const e of registry.events){requireOk(e.status==='OWNER_FINAL'&&ID.test(e.eventId),'EVENT_REGISTRY');events.add(e.eventId)}
 requireOk(events.has(d.eventId),'EVENT_UNKNOWN');
 const versions=registry.rules.map(x=>({
  id:x.ruleVersionId,ruleId:x.ruleId,eventId:x.eventId,roleId:x.roleId,
  points:Number(x.points),effectiveFrom:x.effectiveFrom,status:x.status
 }));
 requireOk(versions.every(x=>x.status==='OWNER_FINAL'&&RULE.test(x.ruleId)&&POS(x.points)&&validDay(x.effectiveFrom)&&x.roleId!=='other-commander'),'RULE_REGISTRY');
 const ruleSet=effectiveRules(baseline.rules,versions,d.eventDate);
 const newRules=versions.filter(v=>!baseline.rules.some(r=>r.id===v.ruleId)&&v.effectiveFrom<=d.eventDate)
  .map(v=>({id:v.ruleId,eventId:v.eventId,roleId:v.roleId,points:v.points}));
 // Preserve the pre-existing owner-approved DBS Commander 2-point amendment.
 // It is an approved event-specific rule, not a discretionary Other Commander.
 const dbsCommander={id:'N5E-DBS-COMMANDER-2',eventId:'dbs',roleId:'commander',
  points:2,nonStackingGroup:null};
 const rules=ruleSet.concat(dbsCommander,newRules);
 const commander=rules.filter(r=>r.eventId===d.eventId&&r.roleId==='commander');
 const manual=(d.roleId==='commander'||d.roleId==='other-commander')&&commander.length===0;
 let role=manual?'other-commander':d.roleId;
 if(d.roleId==='other-commander'&&!manual)requireOk(false,'OTHER_COMMANDER_HAS_STANDARD_RULE');
 let selected=null;
 if(!manual){
  const options=rules.filter(r=>r.roleId===role&&(r.eventId===d.eventId||r.eventId==='all-events'));
  requireOk(options.length===1,'MISSING_OR_AMBIGUOUS_RULE');selected=options[0];
  if(d.points!==undefined&&d.points!==null)requireOk(Number(d.points)===selected.points,'RULE_POINTS_MISMATCH');
 }else{
  if(d.points===undefined||d.points===null)return Object.freeze({
   state:'ASK_OTHER_COMMANDER_POINTS',eventId:d.eventId,memberId:d.memberId,
   eventDate:d.eventDate,instanceId:d.instanceId,points:null,
   question:'How many points should this individual Other Commander contribution receive?'
  });
  requireOk(POS(d.points),'OTHER_COMMANDER_POINTS_REQUIRED');
 }
 const points=manual?d.points:selected.points;
 const current={...d,roleId:role};
 const prior=[
  ...journal.filter(x=>x.status==='REAL_APPROVED').map(x=>({
   candidateKey:x.candidateKey,eventDate:x.eventDate,eventId:x.eventId,
   instanceId:x.instanceId,memberId:x.memberId,roleId:x.roleId,ruleId:x.ruleId
  })),
  ...registry.future.filter(x=>x.status==='OWNER_FINAL'||x.status==='PENDING_OWNER_POINTS')
 ];
 const collisions=prior.filter(x=>x.candidateKey===d.candidateKey||
  eventInstanceKey(x)===eventInstanceKey(current));
 if(collisions.length){
  // A pending case may be finalised exactly once by APPENDING a final record.
  // Any already-final record (even if a pending row comes first) blocks writes.
  const matchingPending=collisions.length===1&&
   collisions[0].status==='PENDING_OWNER_POINTS'&&
   collisions[0].candidateKey===d.candidateKey&&
   eventInstanceKey(collisions[0])===eventInstanceKey(current)&&manual;
  if(!matchingPending)return Object.freeze({
   state:'POSSIBLE_DUPLICATE',
   reason:collisions.some(x=>x.candidateKey===d.candidateKey)?'SAME_CANDIDATE_KEY':'SAME_MEMBER_EVENT_INSTANCE_ROLE',
   action:'REVIEW_EXISTING_AWARD',safeToAppend:false
  });
 }

 const nonStackGroup=selected?.nonStackingGroup;
 if(nonStackGroup&&prior.some(x=>{
  const r=rules.find(y=>y.id===x.ruleId);
  return r?.nonStackingGroup===nonStackGroup&&
   eventInstanceGroupKey(x,nonStackGroup)===eventInstanceGroupKey(current,nonStackGroup);
 }))return Object.freeze({state:'POSSIBLE_DUPLICATE',reason:'NON_STACKING_ROLES',safeToAppend:false});
 const values=[d.candidateKey,d.eventDate,d.eventId,d.instanceId,d.memberId,role,
  manual?'':selected.id,points,manual?'OWNER_MANUAL_OTHER_COMMANDER':'APPROVED_RULE',
  d.ownerDecisionRef,'OWNER_FINAL','',d.approvedAt||''];
 // The approvedAt timestamp must be supplied by the connected write workflow,
 // not quietly invented as part of this immutable planning step.
 requireOk(typeof d.approvedAt==='string'&&Number.isFinite(Date.parse(d.approvedAt)),'APPROVED_AT_REQUIRED');
 return Object.freeze({state:'READY_TO_APPEND',safeToAppend:true,
  points,roleId:role,ruleId:manual?null:selected.id,
  tab:REGISTRY_TABS.future.name,tabId:REGISTRY_TABS.future.sheetId,
  values:Object.freeze(values),newTotalContributionPoints:points});
}
/**
 * Transform an already approved plan to one Sheets appendCells request only.
 * Caller MUST read back and compare the new row. The caller must re-read for
 * duplicates immediately before writing; Sheets connector writes are not a
 * substitute for the native lock-protected writer under concurrent editors.
 */
export function preparedAppendCells(plan){
 requireOk(plan?.state==='READY_TO_APPEND'&&plan.safeToAppend===true,'NOT_APPROVED');
 return {appendCells:{sheetId:plan.tabId,
  rows:[{values:plan.values.map(v=>typeof v==='number'?
   {userEnteredValue:{numberValue:v}}:{userEnteredValue:{stringValue:String(v)}})}],
  fields:'userEnteredValue'}};
}
