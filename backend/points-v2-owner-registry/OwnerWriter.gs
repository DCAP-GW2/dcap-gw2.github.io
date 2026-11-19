/**
 * DCAP v2 — PRIVATE OWNER-ONLY WRITER CANDIDATE.
 * Not installed, deployed or callable from ChatGPT yet.
 *
 * Install in a *separate*, standalone Apps Script writer project alongside
 * the validated pure read-side Code.gs (for buildOwnerPublicFeed_ and constants).
 * DO NOT deploy a public web app or define doPost. No triggers.
 *
 * Script properties (private, never commit actual values):
 * DCAP_V2_JOURNAL_ID      existing historical N5E approved journal Sheet ID (READ ONLY)
 * DCAP_V2_REGISTRY_ID     owner-private new registry Sheet ID (ONLY WRITE DESTINATION)
 * DCAP_V2_PUBLIC_IDS_JSON original 37-member baseline ID JSON array
 * DCAP_V2_OWNER_EMAIL     owner's explicitly approved effective-user email
 *
 * Caller: authenticated Apps Script editor or a separately authorised
 * Google Apps Script Execution API caller. ChatGPT chat is NOT connected yet.
 * Single atomic multi-tab batch, bounded to 250 record attempts.
 */
const OWNER_WRITE_MAX_=250;
const OWNER_WRITE_TYPES_=['MEMBER','EVENT','RULE_VERSION','AWARD','PENDING_OTHER_COMMANDER'];
const OWNER_WRITE_DEST_={MEMBER:'members',EVENT:'events',RULE_VERSION:'rules',
 AWARD:'future',PENDING_OTHER_COMMANDER:'future'};
const OWNER_WRITE_ORDER_=['members','events','rules','future'];
function ownerWriteAssert_(v,why){if(!v)throw Error('OWNER_WRITE_'+why)}
function ownerWriteDate_(value){return ownDate_(value)}
function ownerWriteValidDecision_(value){return ownDecision_(value)}
function ownerWriteColumnValue_(value){
 return typeof value==='number'?{userEnteredValue:{numberValue:value}}:
  {userEnteredValue:{stringValue:value===null||value===undefined?'':String(value)}};
}
function ownerWriteCellRow_(values){return {values:values.map(ownerWriteColumnValue_)}}
function ownerWriteRegistryRows_(registryId){
 const read=range=>(Sheets.Spreadsheets.Values.get(registryId,range,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
 return {
  members:read(OWN_SHEETS_.members),
  events:read(OWN_SHEETS_.events),
  rules:read(OWN_SHEETS_.rules),
  future:read(OWN_SHEETS_.future)
 };
}
function ownerWriteResolve_(props){
 const registryId=props.getProperty('DCAP_V2_REGISTRY_ID');
 const journalId=props.getProperty('DCAP_V2_JOURNAL_ID');
 const email=props.getProperty('DCAP_V2_OWNER_EMAIL');
 const active=Session.getEffectiveUser().getEmail();
 ownerWriteAssert_(typeof active==='string'&&active.length>0&&
   typeof email==='string'&&email.length>0&&active.toLowerCase()===email.toLowerCase(),'NOT_OWNER');
 ownerWriteAssert_([registryId,journalId].every(v=>typeof v==='string'&&
   /^[A-Za-z0-9_-]{20,}$/.test(v))&&registryId!==journalId,'CONFIG');
 const allowed=ownReadPublicIds_(props.getProperty('DCAP_V2_PUBLIC_IDS_JSON'));
 return {registryId,journalId,allowed};
}
function ownerWriteFields_(tx){
 ownerWriteAssert_(tx&&typeof tx==='object'&&!Array.isArray(tx),'TRANSACTION');
 ownerWriteAssert_(OWNER_WRITE_TYPES_.includes(tx.type),'TYPE');
 ownerWriteAssert_(ownerWriteValidDecision_(tx.ownerDecisionRef),'DECISION_REF');
 if(tx.type==='MEMBER'){
  ownerWriteAssert_(/^m-[a-f0-9]{16}$/.test(tx.memberId)&&
    typeof tx.displayName==='string'&&tx.displayName.trim().length>0&&
    tx.displayName.length<=160&&ownerWriteDate_(tx.approvedFrom),'MEMBER');
  return {tab:'members',values:[tx.memberId,tx.displayName,tx.approvedFrom,
   'OWNER_FINAL',tx.ownerDecisionRef]};
 }
 if(tx.type==='EVENT'){
  ownerWriteAssert_(ownId_(tx.eventId)&&typeof tx.eventLabel==='string'&&
    tx.eventLabel.trim().length>0&&tx.eventLabel.length<=160,'EVENT');
  return {tab:'events',values:[tx.eventId,tx.eventLabel,'OWNER_FINAL',tx.ownerDecisionRef]};
 }
 if(tx.type==='RULE_VERSION'){
  ownerWriteAssert_(ownId_(tx.ruleVersionId)&&ownRuleId_(tx.ruleId)&&
    ownId_(tx.eventId)&&ownId_(tx.roleId)&&tx.roleId!=='other-commander'&&
    ownPositive_(tx.points)&&ownerWriteDate_(tx.effectiveFrom),'RULE');
  const today=Utilities.formatDate(new Date(),'Pacific/Auckland','yyyy-MM-dd');
  ownerWriteAssert_(tx.effectiveFrom>=today,'RULE_PROSPECTIVE_ONLY');
  return {tab:'rules',values:[tx.ruleVersionId,tx.ruleId,tx.eventId,tx.roleId,
   tx.points,tx.effectiveFrom,'OWNER_FINAL',tx.ownerDecisionRef]};
 }
 if(tx.type==='AWARD'||tx.type==='PENDING_OTHER_COMMANDER'){
  ownerWriteAssert_(typeof tx.candidateKey==='string'&&/^[a-f0-9]{24}$/.test(tx.candidateKey)&&
    ownerWriteDate_(tx.eventDate)&&ownId_(tx.eventId)&&
    /^m-[a-f0-9]{16}$/.test(tx.memberId)&&
    typeof tx.instanceId==='string'&&tx.instanceId.length>0&&tx.instanceId.length<=256,'AWARD_CONTEXT');
  if(tx.type==='PENDING_OTHER_COMMANDER'){
   ownerWriteAssert_(tx.roleId==='other-commander'&&
    (tx.points===null||tx.points===undefined)&&
    (tx.ruleId===null||tx.ruleId===undefined||tx.ruleId===''),'PENDING_NOT_OTHER');
   return {tab:'future',values:[tx.candidateKey,tx.eventDate,tx.eventId,
     tx.instanceId,tx.memberId,'other-commander','', '',
     'OWNER_MANUAL_OTHER_COMMANDER',tx.ownerDecisionRef,'PENDING_OWNER_POINTS','', '']};
  }
  ownerWriteAssert_(ownId_(tx.roleId)&&ownPositive_(tx.points)&&
    ['APPROVED_RULE','OWNER_MANUAL_OTHER_COMMANDER'].includes(tx.awardType),'AWARD_FIELDS');
  const manual=tx.awardType==='OWNER_MANUAL_OTHER_COMMANDER';
  ownerWriteAssert_(manual?(tx.roleId==='other-commander'&&
    (tx.ruleId===null||tx.ruleId===undefined||tx.ruleId==='')):
    ownRuleId_(tx.ruleId),'AWARD_RULE');
  const version=manual?'':(tx.ruleVersionId||'');
  ownerWriteAssert_(version===''||ownId_(version),'VERSION');
  return {tab:'future',values:[tx.candidateKey,tx.eventDate,tx.eventId,tx.instanceId,tx.memberId,
   tx.roleId,manual?'':tx.ruleId,tx.points,tx.awardType,tx.ownerDecisionRef,
   'OWNER_FINAL',version,Utilities.formatDate(new Date(),'UTC',"yyyy-MM-dd'T'HH:mm:ss'Z'")]};
 }
 throw Error('OWNER_WRITE_UNHANDLED');
}
function ownerWriteRecordMatch_(a,b,tab){
 const decisive=tab==='future'?12:a.length;
 // The final approvedAt timestamp is generated on commit and is not part of an idempotency key.
 const count=tab==='future'?12:decisive;
 return Array.from({length:count},(_,i)=>
  String(a[i]===undefined?'':a[i])===String(b[i]===undefined?'':b[i])).every(Boolean);
}
function ownerWriteRecordKey_(v,tab){
 if(tab==='members'||tab==='events'||tab==='rules')return String(v[0]);
 // Pending and approved are separate immutable states of one candidate.
 return String(v[0])+'|'+String(v[10]);
}
function ownerWritePlan_(requests,raw,allowed){
 ownerWriteAssert_(Array.isArray(requests)&&requests.length>0&&requests.length<=OWNER_WRITE_MAX_,'BATCH_SIZE');
 const proposed={
  legacy:raw.legacy,
  members:raw.members.map(x=>x.slice()),
  events:raw.events.map(x=>x.slice()),
  rules:raw.rules.map(x=>x.slice()),
  future:raw.future.map(x=>x.slice())
 };
 const appended={members:[],events:[],rules:[],future:[]};
 let alreadyApplied=0;
 for(const request of requests){
  const action=ownerWriteFields_(request),tab=action.tab,values=action.values;
  const key=ownerWriteRecordKey_(values,tab);
  const previous=proposed[tab].slice(1).find(row=>ownerWriteRecordKey_(row,tab)===key);
  if(previous){
   // Idempotent retry of the exact recorded decision is harmless. Conflict fails closed.
   if(ownerWriteRecordMatch_(previous,values,tab)){alreadyApplied++;continue}
   throw Error('OWNER_WRITE_CONFLICT');
  }
  // A final award may follow the same candidate's pending row but must preserve its identity.
  if(tab==='future'&&values[10]==='OWNER_FINAL'){
   const pending=proposed.future.slice(1).find(row=>String(row[0])===values[0]&&row[10]==='PENDING_OWNER_POINTS');
   if(pending)for(const index of [1,2,3,4]){
    ownerWriteAssert_(String(pending[index])===String(values[index]),'PENDING_IDENTITY_MISMATCH');
   }
  }
  proposed[tab].push(values);appended[tab].push(values);
 }
 const data=buildOwnerPublicFeed_(proposed,allowed);
 ownerWriteAssert_(data.rewardsEnabled===false,'REWARDS');
 return {data,appended,alreadyApplied,accepted:requests.length-alreadyApplied};
}
function ownerWriteBatchRequests_(appended,spreadsheet){
 const ids=new Map(spreadsheet.sheets.map(s=>[s.properties.title,s.properties.sheetId]));
 return OWNER_WRITE_ORDER_.filter(key=>appended[key].length).map(key=>{
  const name={members:'N5 Public Members',events:'N5 Events',
    rules:'N5 Rule Versions',future:'N5 Owner Awards'}[key];
  ownerWriteAssert_(ids.has(name),'SHEET_MISSING');
  return {appendCells:{sheetId:ids.get(name),
   rows:appended[key].map(ownerWriteCellRow_),fields:'userEnteredValue'}};
 });
}
/**
 * Authenticated, owner-only, explicit transaction entrypoint.
 * An online bridge can call this by approved OAuth Execution API in a later phase.
 * DO NOT expose it via doPost/doGet or an unauthenticated HTTP endpoint.
 */
function ownerApplyApprovedBatch_(requests){
 const props=PropertiesService.getScriptProperties();
 const config=ownerWriteResolve_(props);
 const lock=LockService.getScriptLock();
 ownerWriteAssert_(lock.tryLock(30000),'BUSY');
 try{
  const read=(id,range)=>(Sheets.Spreadsheets.Values.get(id,range,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
  const raw={legacy:read(config.journalId,OWN_SHEETS_.legacy),
   ...ownerWriteRegistryRows_(config.registryId)};
  const plan=ownerWritePlan_(requests,raw,config.allowed);
  if(plan.accepted===0)return {status:'ALREADY_APPLIED',requested:requests.length,appended:0};
  const metadata=Sheets.Spreadsheets.get(config.registryId,{fields:'sheets(properties(sheetId,title))'});
  const mutations=ownerWriteBatchRequests_(plan.appended,metadata);
  ownerWriteAssert_(mutations.length>0&&mutations.length<=4,'WRITE_PLAN');
  // A single Google Sheets batchUpdate is used for multi-tab atomicity.
  Sheets.Spreadsheets.batchUpdate({requests:mutations},config.registryId);
  // Only aggregate receipt; no names, emails, raw evidence or private IDs.
  return {status:'APPLIED',requested:requests.length,appended:plan.accepted,
    alreadyApplied:plan.alreadyApplied,publicAwardCount:plan.data.awards.length,
    publicAwardPoints:plan.data.awards.reduce((n,a)=>n+a.points,0)};
 }finally{lock.releaseLock()}
}
/** No writes: exercises the plan for fictional input in the owner-private editor. */
function ownerWriterDryRun_(requests){
 const config=ownerWriteResolve_(PropertiesService.getScriptProperties());
 const read=(id,range)=>(Sheets.Spreadsheets.Values.get(id,range,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
 const raw={legacy:read(config.journalId,OWN_SHEETS_.legacy),
  ...ownerWriteRegistryRows_(config.registryId)};
 const plan=ownerWritePlan_(requests,raw,config.allowed);
 return {status:'DRY_RUN_ONLY',requested:requests.length,accepted:plan.accepted,
  alreadyApplied:plan.alreadyApplied,previewAwardCount:plan.data.awards.length,
  previewAwardPoints:plan.data.awards.reduce((n,a)=>n+a.points,0)};
}

/**
 * No-argument editor preflight, suitable for Apps Script Run dropdown.
 * Verifies owner's effective identity, real journal + separate registry read,
 * and current public projection without writing or exposing private metadata.
 */
function testOwnerWriterReadOnlyPreflight(){
 const cfg=ownerWriteResolve_(PropertiesService.getScriptProperties());
 const read=(sheetId,range)=>(Sheets.Spreadsheets.Values.get(sheetId,range,
  {valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
 const raw={legacy:read(cfg.journalId,OWN_SHEETS_.legacy),
  ...ownerWriteRegistryRows_(cfg.registryId)};
 const feed=buildOwnerPublicFeed_(raw,cfg.allowed);
 const receipt={
  stage:'DCAP_V2_OWNER_WRITER_READ_ONLY_PREFLIGHT',
  state:'PASS',
  continuingAwards:feed.awards.length,
  continuingPoints:feed.awards.reduce((sum,a)=>sum+a.points,0),
  newPublicMembers:feed.members.filter(m=>!cfg.allowed.has(m.id)).length,
  manuallyAssignedCommanderAwards:feed.awards.filter(a=>a.provenanceType===
   'OWNER_MANUAL_OTHER_COMMANDER').length,
  approvedRegistryRows:raw.members.length+raw.events.length+raw.rules.length+
   raw.future.length-4,
  rewardsEnabled:feed.rewardsEnabled,
  sheetWritesPerformed:0
 };
 console.log(JSON.stringify(receipt));
 return receipt;
}
