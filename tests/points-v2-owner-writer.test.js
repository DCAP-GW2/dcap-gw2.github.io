import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const b=JSON.parse(read('points/data/v2/releases/r000.json'));
const delta=JSON.parse(read('points/data/v2/releases/r001.json'));
const code=read('backend/points-v2-owner-registry/Code.gs')+'\n'+read('backend/points-v2-owner-registry/OwnerWriter.gs');
const columns={
 legacy:['seq','entryId','candidateKey','sourceMessageId','sourceReference','eventDate','eventId','instanceId',
 'memberId','roleId','ruleId','v2Points','approvedBy','approvedAt','approvalDigest','ruleVersion',
 'status','prevDigest','rowDigest','processingRevision'],
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 future:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType',
 'ownerDecisionRef','status','ruleVersionId','approvedAt']
};
const tabNames=['N5 Public Members','N5 Events','N5 Rule Versions','N5 Owner Awards'];
const tabKeys=['members','events','rules','future'];
const registryIds={members:1781507585,events:18306101,rules:18306102,future:18306103};
const journalId='a'.repeat(30), registryId='b'.repeat(30), ownerEmail='private@example.invalid';
const newMember='m-000000000000cafe', memberRef='owner-final-0001';
const memberTx={type:'MEMBER',ownerDecisionRef:memberRef,memberId:newMember,
 displayName:'New Commander',approvedFrom:'2026-11-19'};
const eventTx={type:'EVENT',ownerDecisionRef:'owner-final-0002',
 eventId:'ley-line-anomaly',eventLabel:'Ley-Line Anomaly'};
const manualTx={type:'AWARD',ownerDecisionRef:'owner-final-0003',candidateKey:'000000000000000000000001',
 eventDate:'2026-11-19',eventId:'ley-line-anomaly',instanceId:'ley-1',memberId:newMember,
 roleId:'other-commander',ruleId:null,points:4,awardType:'OWNER_MANUAL_OTHER_COMMANDER'};

function journalFixture(){
 let last='GENESIS';
 const out=[columns.legacy];
 for(const [i,a] of delta.awards.entries()){
  const n=i+1,d=n.toString(16).padStart(64,'0');
  out.push([n,'private-entry-'+n,a.id.slice(4),'private-message','private-evidence',
   a.eventDate,a.eventId,'historical-instance-'+n,a.memberId,a.roleId,a.ruleId,
   a.points,'owner-email-private','2026-11-19T00:00:00.000Z','f'.repeat(64),
   'DCAP Points v2.0','REAL_APPROVED',last,d,'journal-revision-private']);
  last=d;
 }
 return out;
}
function fixture(overrides={}){
 const state={legacy:journalFixture(),
  members:[columns.members],events:[columns.events],rules:[columns.rules],future:[columns.future]};
 const logs=[],writes=[],lock={acquired:false,released:false};
 const props={DCAP_V2_JOURNAL_ID:journalId,DCAP_V2_REGISTRY_ID:registryId,
  DCAP_V2_PUBLIC_IDS_JSON:JSON.stringify(b.members.map(x=>x.id)),DCAP_V2_OWNER_EMAIL:ownerEmail};
 const effectiveEmail=overrides.effectiveEmail??ownerEmail;
 const find=(id,range)=>{
  assert.equal(id===journalId||id===registryId,true);
  if(id===journalId){
   assert(range.includes('N5 Real Award Journal'),'writer must never write to journal');
   return state.legacy;
  }
  for(const key of tabKeys)if(range.includes(tabNames[tabKeys.indexOf(key)]))return state[key];
  throw Error('unrecognised range '+range);
 };
 const context={
  Session:{getEffectiveUser:()=>({getEmail:()=>effectiveEmail})},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>props[name]??null})},
  Sheets:{Spreadsheets:{
   Values:{get:(id,range,options)=>{
    assert.equal(options.valueRenderOption,'UNFORMATTED_VALUE');
    return {values:find(id,range)};
   }},
   get:(id)=>{assert.equal(id,registryId);return {sheets:tabKeys.map(k=>({
    properties:{title:tabNames[tabKeys.indexOf(k)],sheetId:registryIds[k]}
   }))}},
   batchUpdate:(payload,id)=>{
    assert.equal(id,registryId,'Never write to existing private journal');
    assert(Array.isArray(payload.requests)&&payload.requests.length<=4);
    // Simulate an atomic Sheets batch: no partial writes if request validation fails.
    const planned=payload.requests.map(r=>{
     assert.deepEqual(Object.keys(r),['appendCells']);
     const target=tabKeys.find(k=>registryIds[k]===r.appendCells.sheetId);
     assert(target,'must only append to four private registry tabs');
     return {target,rows:r.appendCells.rows.map(row=>row.values.map(v=>{
      const entered=v.userEnteredValue;
      assert(entered&&Object.keys(entered).length===1);
      return entered.stringValue??entered.numberValue;
     }))};
    });
    for(const entry of planned)state[entry.target].push(...entry.rows);
    writes.push(planned);
    return {replies:planned.map(()=>({}))};
   }
  }},
  LockService:{getScriptLock:()=>({tryLock:()=>{lock.acquired=true;return true;},
   releaseLock:()=>{lock.released=true}})},
  Utilities:{formatDate:(d,tz,pattern)=>{
   if(pattern==='yyyy-MM-dd')return '2026-11-19';
   if(pattern==="yyyy-MM-dd'T'HH:mm:ss'Z'")return '2026-11-19T00:00:00Z';
   throw Error('unexpected format');
  }},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:x=>({
   getContent:()=>x,setMimeType(){return this}})},
  console:{log:msg=>logs.push(msg)}
 };
 vm.createContext(context);
 vm.runInContext(code,context);
 return {context,state,writes,logs,lock,props};
}
const toJSON=x=>JSON.parse(JSON.stringify(x));
const sum=s=>s.awards.reduce((n,a)=>n+a.points,0);
test('real four-tab schema matches writer expectations and only new registry is writable',()=>{
 assert(!/function\s+doPost\s*\(/.test(code));
 assert(code.includes('OWNER_WRITE_MAX_=250'));
 assert(code.includes('LockService.getScriptLock()'));
 assert(code.includes('Sheets.Spreadsheets.batchUpdate('));
 assert(!code.includes('Sheets.Spreadsheets.Values.append('));
 assert(!code.includes('SpreadsheetApp.openById('));
 const app=JSON.parse(read('backend/points-v2-owner-registry/appsscript.json'));
 assert(app.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly'));
});
test('new member, event, manual Commander points are appended atomically once',()=>{
 const f=fixture();
 const v=toJSON(f.context.ownerApplyApprovedBatch_([memberTx,eventTx,manualTx]));
 assert.equal(v.status,'APPLIED');assert.equal(v.appended,3);assert.equal(v.publicAwardCount,61);
 assert.equal(v.publicAwardPoints,196);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].length,3);
 assert.equal(f.state.members.length,2);assert.equal(f.state.events.length,2);
 assert.equal(f.state.future.length,2);
 assert(f.lock.acquired&&f.lock.released);
 const publicFeed=toJSON(f.context.buildOwnerPublicFeed_(
  {legacy:f.state.legacy,members:f.state.members,events:f.state.events,
   rules:f.state.rules,future:f.state.future},new Set(b.members.map(m=>m.id))));
 const verified=validateOwnerFeed(publicFeed,b);
 assert.equal(verified.publicMembers,38);
 assert.equal(combineOwnerFeed(b,publicFeed).population.candidatePoints,1890);
 assert.equal(combineOwnerFeed(b,publicFeed).population.awardCandidateCount,612);
 assert(!JSON.stringify(v).includes('private@example'));
});
test('replay of identical three-row batch is idempotent, no second write',()=>{
 const f=fixture();const arr=[memberTx,eventTx,manualTx];
 f.context.ownerApplyApprovedBatch_(arr);
 const again=toJSON(f.context.ownerApplyApprovedBatch_(arr));
 assert.equal(again.status,'ALREADY_APPLIED');assert.equal(again.appended,0);
 assert.equal(f.writes.length,1);
 assert.equal(f.state.future.length,2);
});
test('conflicting replay of an approved award fails without overwriting',()=>{
 const f=fixture();f.context.ownerApplyApprovedBatch_([memberTx,eventTx,manualTx]);
 const different={...manualTx,points:7};
 assert.throws(()=>f.context.ownerApplyApprovedBatch_([different]),/OWNER_WRITE_CONFLICT/);
 assert.equal(f.writes.length,1);assert.equal(f.state.future.length,2);
});
test('pending Other Commander can be recorded without points, then finalised',()=>{
 const f=fixture();
 f.context.ownerApplyApprovedBatch_([memberTx,eventTx]);
 const pending={type:'PENDING_OTHER_COMMANDER',ownerDecisionRef:'owner-final-0004',
  candidateKey:'000000000000000000000011',eventDate:'2026-11-19',eventId:eventTx.eventId,
  instanceId:'ley-2',memberId:newMember,roleId:'other-commander',points:null};
 let r=toJSON(f.context.ownerApplyApprovedBatch_([pending]));
 assert.equal(r.publicAwardCount,60);assert.equal(r.publicAwardPoints,192);
 const approved={...manualTx,ownerDecisionRef:'owner-final-0005',
  candidateKey:pending.candidateKey,instanceId:pending.instanceId,points:6};
 r=toJSON(f.context.ownerApplyApprovedBatch_([approved]));
 assert.equal(r.publicAwardCount,61);assert.equal(r.publicAwardPoints,198);
 assert.equal(f.state.future.length,3,'append-only pending then final; no row replaced');
});
test('final owner approval cannot change the identity of a previously queued pending award',()=>{
 const f=fixture();f.context.ownerApplyApprovedBatch_([memberTx,eventTx]);
 const pending={type:'PENDING_OTHER_COMMANDER',ownerDecisionRef:'owner-final-0004',
  candidateKey:'000000000000000000000011',eventDate:'2026-11-19',eventId:eventTx.eventId,
  instanceId:'ley-2',memberId:newMember,roleId:'other-commander',points:null};
 f.context.ownerApplyApprovedBatch_([pending]);
 assert.throws(()=>f.context.ownerApplyApprovedBatch_([{...manualTx,
  candidateKey:pending.candidateKey}]),/OWNER_WRITE_PENDING_IDENTITY_MISMATCH/);
});
test('dated rule changes are prospective, no historical awards rescored',()=>{
 const f=fixture();
 const version={type:'RULE_VERSION',ruleVersionId:'tt-commander-2026-11-19',
  ruleId:'V2-05',eventId:'triple-trouble',roleId:'commander',points:4,
  effectiveFrom:'2026-11-19',ownerDecisionRef:'owner-final-0012'};
 const after={type:'AWARD',candidateKey:'000000000000000000000030',
  eventDate:'2026-11-19',eventId:'triple-trouble',instanceId:'tt-100',
  memberId:b.members[0].id,roleId:'commander',ruleId:'V2-05',points:4,
  awardType:'APPROVED_RULE',ownerDecisionRef:'owner-final-0013',
  ruleVersionId:version.ruleVersionId};
 const r=toJSON(f.context.ownerApplyApprovedBatch_([version,after]));
 assert.equal(r.appended,2);assert.equal(r.publicAwardPoints,196);
 const old=JSON.stringify(f.state.legacy);
 assert(f.state.rules.some(v=>v[4]===4));
 assert.equal(JSON.stringify(f.state.legacy),old);
});
test('ambiguous roles and Other Commander without numerical owner award fail closed',()=>{
 const f=fixture();f.context.ownerApplyApprovedBatch_([memberTx,eventTx]);
 assert.throws(()=>f.context.ownerApplyApprovedBatch_([{...manualTx,points:null}]),/OWNER_WRITE_AWARD_FIELDS/);
 assert.throws(()=>f.context.ownerApplyApprovedBatch_([{...manualTx,roleId:'commander'}]),/OWNER_WRITE_AWARD_RULE/);
 assert.throws(()=>f.context.ownerApplyApprovedBatch_([{...manualTx,eventId:'triple-trouble'}]),/PRIVATE_OWNER_FEED_MANUAL_UNAPPROVED/);
});
test('unknown effective user denied before reading or writing',()=>{
 const f=fixture({effectiveEmail:'stranger@example.invalid'});
 assert.throws(()=>f.context.ownerApplyApprovedBatch_([memberTx]),/OWNER_WRITE_NOT_OWNER/);
 assert.equal(f.writes.length,0);
});
test('no batch larger than 250 records; 60 awards in one authorised atomic batch',()=>{
 const f=fixture(),member=b.members[0].id;
 const arr=Array.from({length:60},(_,i)=>({
  type:'AWARD',ownerDecisionRef:'owner-final-batch-20261119',
  candidateKey:(1000+i).toString(16).padStart(24,'0'),eventDate:'2026-11-19',
  eventId:'triple-trouble',instanceId:'unique-tt-'+i,memberId:member,
  roleId:'blocker',ruleId:'V2-03',points:3,awardType:'APPROVED_RULE'
 }));
 const receipt=toJSON(f.context.ownerApplyApprovedBatch_(arr));
 assert.equal(receipt.appended,60);assert.equal(receipt.publicAwardCount,120);
 assert.equal(receipt.publicAwardPoints,372);
 assert.equal(f.writes.length,1);
 const tooMany=Array.from({length:251},(_,i)=>({...arr[0],
  candidateKey:(2000+i).toString(16).padStart(24,'0'),instanceId:'tt-'+i}));
 assert.throws(()=>f.context.ownerApplyApprovedBatch_(tooMany),/OWNER_WRITE_BATCH_SIZE/);
});
test('dry run checks proposed award but writes nothing',()=>{
 const f=fixture();
 const result=toJSON(f.context.ownerWriterDryRun_([memberTx,eventTx,manualTx]));
 assert.equal(result.status,'DRY_RUN_ONLY');assert.equal(result.accepted,3);
 assert.equal(f.writes.length,0);
});

test('native writer no-argument read-only preflight succeeds without any writes',()=>{
 const f=fixture();
 const receipt=toJSON(f.context.testOwnerWriterReadOnlyPreflight());
 assert.equal(receipt.stage,'DCAP_V2_OWNER_WRITER_READ_ONLY_PREFLIGHT');
 assert.equal(receipt.state,'PASS');
 assert.equal(receipt.continuingAwards,60);
 assert.equal(receipt.continuingPoints,192);
 assert.equal(receipt.newPublicMembers,0);
 assert.equal(receipt.manuallyAssignedCommanderAwards,0);
 assert.equal(receipt.approvedRegistryRows,0);
 assert.equal(receipt.rewardsEnabled,false);
 assert.equal(receipt.sheetWritesPerformed,0);
 assert.equal(f.writes.length,0);
 assert.equal(f.logs.length,1);
 assert.deepEqual(JSON.parse(f.logs[0]),receipt);
 assert(!f.logs[0].includes('private'));
});
test('native writer preflight refuses incorrect owner identity before journal access',()=>{
 const f=fixture({effectiveEmail:'wrong@example.invalid'});
 assert.throws(()=>f.context.testOwnerWriterReadOnlyPreflight(),/OWNER_WRITE_NOT_OWNER/);
 assert.equal(f.writes.length,0);
});
