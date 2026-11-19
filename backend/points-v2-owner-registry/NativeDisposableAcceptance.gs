/**
 * DCAP v2 — NATIVE DISPOSABLE WRITE ACCEPTANCE, NOT FOR PRODUCTION.
 * Include ONLY in a new owner-private, standalone TEST writer project.
 * Requires Code.gs + OwnerWriter.gs + the writer appsscript.json manifest.
 *
 * Test-only Script Properties IN ADDITION TO writer's normal four:
 *   DCAP_V2_TEST_REGISTRY_ID = ID of the new, empty disposable workbook
 *   DCAP_V2_REAL_REGISTRY_ID = ID of the untouched real owner registry
 *   DCAP_V2_ACCEPTANCE_MODE  = FICTIONAL_TEST_ONLY
 *
 * This file never prints or embeds spreadsheet IDs, member IDs or private evidence.
 * NO doGet/doPost, triggers, rule modification or live website deployment.
 *
 * Execute in this order:
 *  1. testDisposableWriterDryRun
 *  2. testDisposableWriterCommitAndRetry
 */
const NATIVE_TEST_TITLE_='DCAP v2 — Native Writer Acceptance — Disposable Fictional — 2026-11-20';
const NATIVE_TEST_DAY_='2026-11-20';
const NATIVE_TEST_MEMBER_='m-000000000000cafe';
const NATIVE_TEST_EVENT_='ley-line-anomaly';
const NATIVE_TEST_KEY_='0000000000000000000000af';
const NATIVE_TEST_TX_=Object.freeze([
 {type:'MEMBER',ownerDecisionRef:'owner-native-fictional-001',
  memberId:NATIVE_TEST_MEMBER_,displayName:'Fictional Test Commander',
  approvedFrom:NATIVE_TEST_DAY_},
 {type:'EVENT',ownerDecisionRef:'owner-native-fictional-002',
  eventId:NATIVE_TEST_EVENT_,eventLabel:'Fictional Ley-Line Anomaly'},
 {type:'AWARD',ownerDecisionRef:'owner-native-fictional-003',
  candidateKey:NATIVE_TEST_KEY_,eventDate:NATIVE_TEST_DAY_,
  eventId:NATIVE_TEST_EVENT_,instanceId:'native-fictional-instance-001',
  memberId:NATIVE_TEST_MEMBER_,roleId:'other-commander',ruleId:null,
  points:4,awardType:'OWNER_MANUAL_OTHER_COMMANDER'}
]);
function nativeTestAssert_(x,code){if(!x)throw Error('NATIVE_TEST_'+code)}
function nativeTestGuard_(){
 const props=PropertiesService.getScriptProperties();
 const c=ownerWriteResolve_(props);
 const disposable=props.getProperty('DCAP_V2_TEST_REGISTRY_ID');
 const real=props.getProperty('DCAP_V2_REAL_REGISTRY_ID');
 nativeTestAssert_(props.getProperty('DCAP_V2_ACCEPTANCE_MODE')==='FICTIONAL_TEST_ONLY','MODE');
 nativeTestAssert_(typeof disposable==='string'&&disposable===c.registryId,'NOT_DISPOSABLE_REGISTRY');
 nativeTestAssert_(typeof real==='string'&&/^[A-Za-z0-9_-]{20,}$/.test(real)&&
  real!==c.registryId&&real!==c.journalId,'REAL_REGISTRY_GUARD');
 const meta=Sheets.Spreadsheets.get(c.registryId,{fields:'spreadsheetId,properties(title)'});
 nativeTestAssert_(meta?.properties?.title===NATIVE_TEST_TITLE_,'WORKBOOK_TITLE');
 return c;
}
function nativeTestSnapshot_(c){
 const raw=ownerWriteRegistryRows_(c.registryId);
 const payload={
  members:raw.members,
  events:raw.events,
  rules:raw.rules,
  future:raw.future
 };
 // This disposable copy must be empty, or contain exactly the 3 rows written
 // by THIS fixture. Never permit unrelated rows to be modified.
 const counts=[raw.members.length-1,raw.events.length-1,raw.rules.length-1,raw.future.length-1];
 nativeTestAssert_(JSON.stringify(counts)==='[0,0,0,0]'||
  JSON.stringify(counts)==='[1,1,0,1]','UNEXPECTED_REGISTRY_ROWS');
 if(counts[0]===1){
  nativeTestAssert_(raw.members[1][0]===NATIVE_TEST_MEMBER_&&
   raw.events[1][0]===NATIVE_TEST_EVENT_&&
   raw.future[1][0]===NATIVE_TEST_KEY_&&
   raw.future[1][10]==='OWNER_FINAL'&&
   raw.future[1][7]===4,'FOREIGN_TEST_DATA');
 }
 return {raw,digest:JSON.stringify(payload),counts};
}
function nativeTestReport_(stage,counts,extra){
 const result=Object.assign({
  stage,state:'PASS',fictionalOnly:true,realRegistryWrites:0,
  historicalJournalWrites:0,rewardsEnabled:false,
  disposableRegistryRows:{members:counts[0],events:counts[1],
   rules:counts[2],awards:counts[3]}
 },extra);
 console.log(JSON.stringify(result));return result;
}
/** Real Apps Script read against a disposable workbook, ZERO writes. */
function testDisposableWriterDryRun(){
 const c=nativeTestGuard_();
 const before=nativeTestSnapshot_(c);
 const plan=ownerWriterDryRun_(NATIVE_TEST_TX_);
 nativeTestAssert_(plan.status==='DRY_RUN_ONLY'&&
  plan.previewAwardCount===61&&plan.previewAwardPoints===196,'DRY_RUN_RESULT');
 nativeTestAssert_(plan.accepted===3||plan.accepted===0,'DRY_RUN_ACCEPTED');
 const after=nativeTestSnapshot_(c);
 nativeTestAssert_(before.digest===after.digest,'DRY_RUN_WROTE');
 return nativeTestReport_('DCAP_V2_NATIVE_DISPOSABLE_DRY_RUN',after.counts,{
  proposedTransactions:3,alreadyApplied:plan.alreadyApplied,
  continuingAwards:plan.previewAwardCount,continuingPoints:plan.previewAwardPoints,
  sheetWritesPerformed:0
 });
}
/** Real Apps Script writer called on a verified disposable workbook only. */
function testDisposableWriterCommitAndRetry(){
 const c=nativeTestGuard_();
 const before=nativeTestSnapshot_(c);
 nativeTestAssert_(before.counts[2]===0,'RULES_NOT_EMPTY');
 const first=ownerApplyApprovedBatch_(NATIVE_TEST_TX_);
 nativeTestAssert_((first.status==='APPLIED'&&first.appended===3)||
  (first.status==='ALREADY_APPLIED'&&first.appended===0),'FIRST_APPLY');
 const second=ownerApplyApprovedBatch_(NATIVE_TEST_TX_);
 nativeTestAssert_(second.status==='ALREADY_APPLIED'&&second.appended===0,'RETRY_NOT_IDEMPOTENT');
 const after=nativeTestSnapshot_(c);
 nativeTestAssert_(JSON.stringify(after.counts)==='[1,1,0,1]','WRITE_COUNTS');
 const read=(id,range)=>(Sheets.Spreadsheets.Values.get(id,range,
  {valueRenderOption:'UNFORMATTED_VALUE'}).values||[]);
 const doc=buildOwnerPublicFeed_({
  legacy:read(c.journalId,OWN_SHEETS_.legacy),
  ...after.raw
 },c.allowed);
 nativeTestAssert_(doc.awards.length===61&&
  doc.awards.reduce((n,a)=>n+a.points,0)===196&&
  doc.members.filter(m=>!c.allowed.has(m.id)).length===1&&
  doc.awards.filter(a=>a.provenanceType==='OWNER_MANUAL_OTHER_COMMANDER').length===1&&
  doc.rewardsEnabled===false,'PUBLIC_PROJECTION');
 return nativeTestReport_('DCAP_V2_NATIVE_DISPOSABLE_COMMIT_RETRY',after.counts,{
  firstOperation:first.status,retryOperation:second.status,
  continuingAwards:doc.awards.length,continuingPoints:196,
  newPublicMembers:1,manualCommanderAwards:1,
  sheetWritesPerformed:first.status==='APPLIED'?1:0
 });
}
