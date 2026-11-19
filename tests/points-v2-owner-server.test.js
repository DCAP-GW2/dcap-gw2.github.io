import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const baseline=JSON.parse(read('points/data/v2/releases/r000.json'));
const delta=JSON.parse(read('points/data/v2/releases/r001.json'));
const code=read('backend/points-v2-owner-registry/Code.gs');
const j=['seq','entryId','candidateKey','sourceMessageId','sourceReference','eventDate','eventId','instanceId',
 'memberId','roleId','ruleId','v2Points','approvedBy','approvedAt','approvalDigest','ruleVersion',
 'status','prevDigest','rowDigest','processingRevision'];
const h={
 legacy:j,
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 future:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType',
 'ownerDecisionRef','status','ruleVersionId','approvedAt']
};
const baseRows=()=>{
 let prior='GENESIS';
 const legacy=[j];
 for(const [i,a] of delta.awards.entries()){
  const dig=(i+1).toString(16).padStart(64,'0');
  legacy.push([i+1,'private-id-'+i,a.id.slice(4),null,'PRIVATE_SOURCE',a.eventDate,a.eventId,
   'legacy-instance-'+i,a.memberId,a.roleId,a.ruleId,a.points,
   'PRIVATE_OWNER_EMAIL','2026-11-19T00:00:00.000Z','f'.repeat(64),'DCAP Points v2.0',
   'REAL_APPROVED',prior,dig,'PRIVATE_PROCESS_REVISION']);
  prior=dig;
 }
 return {legacy,members:[h.members],events:[h.events],rules:[h.rules],future:[h.future]};
};
const make=(data=baseRows(),options={})=>{
 const journalId='a'.repeat(30),registryId='b'.repeat(30),calls=[],logs=[];
 const props={
  DCAP_V2_JOURNAL_ID:options.journalId??journalId,
  DCAP_V2_REGISTRY_ID:options.registryId??registryId,
  DCAP_V2_PUBLIC_IDS_JSON:JSON.stringify(baseline.members.map(x=>x.id))
 };
 const byRange={};
 for(const [k,rows] of Object.entries(data))byRange[k]=rows;
 const context={
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]??null})},
  Sheets:{Spreadsheets:{Values:{get:(id,range,params)=>{
   assert.equal(params.valueRenderOption,'UNFORMATTED_VALUE');
   calls.push({id,range});
   if(id===journalId&&range.includes('N5 Real Award Journal'))return {values:byRange.legacy};
   if(id!==registryId)throw Error('wrong script property');
   if(range.includes('N5 Public Members'))return {values:byRange.members};
   if(range.includes('N5 Events'))return {values:byRange.events};
   if(range.includes('N5 Rule Versions'))return {values:byRange.rules};
   if(range.includes('N5 Owner Awards'))return {values:byRange.future};
   throw Error('Unexpected Sheets range');
  }}}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({
   content:text,getContent(){return this.content},setMimeType(type){this.type=type;return this}
  })},
  console:{log:x=>logs.push(x)}
 };
 vm.createContext(context);vm.runInContext(code,context);
 const out=JSON.parse(context.doGet().getContent());
 return {out,calls,logs,context};
};

test('public owner feed reads five private ranges only, no write service',()=>{
 assert(!/doPost\s*\(|setValues\(|appendRow\(|ScriptApp\.newTrigger|Sheets\.Spreadsheets\.Values\.(update|append|batchUpdate)/.test(code));
 const x=make();
 assert.equal(x.calls.length,5);assert.equal(x.out.kind,'CONTINUING_PUBLIC_OWNER_FEED');
 assert.equal(x.out.awards.length,60);
 assert.equal(x.out.awards.reduce((sum,a)=>sum+a.points,0),192);
 assert.equal(validateOwnerFeed(x.out,baseline).points,192);
 assert.equal(combineOwnerFeed(baseline,x.out).population.candidatePoints,1886);
 assert(!JSON.stringify(x.out).includes('PRIVATE_OWNER_EMAIL'));
 assert(!JSON.stringify(x.out).includes('PRIVATE_PROCESS_REVISION'));
 assert(!JSON.stringify(x.out).includes('PRIVATE_SOURCE'));
 assert(!JSON.stringify(x.out).includes('approvedBy'));
 assert(!JSON.stringify(x.out).includes('ownerDecisionRef'));
});
test('owner-only aggregate preflight does not leak identities, refs, or private journal',()=>{
 const x=make();
 const receipt=JSON.parse(JSON.stringify(x.context.testPrivateOwnerFeed()));
 assert.equal(receipt.state,'PASS');assert.equal(receipt.awards,60);
 assert.equal(receipt.points,192);assert.equal(receipt.publicNewMembers,0);
 assert.equal(receipt.manualCommanderAwards,0);
 assert.equal(x.logs.length,1);
 assert.deepEqual(JSON.parse(x.logs[0]),receipt);
 assert(!x.logs[0].includes('m-'));
});
test('new approved public member and outside-event manual Commander are accepted',()=>{
 const d=baseRows(),member='m-000000000000cafe';
 d.members.push([member,'New Commander','2026-11-19','OWNER_FINAL','owner-123456']);
 d.events.push(['legendary-ley-line-anomaly','Legendary Ley-Line Anomaly','OWNER_FINAL','owner-123456']);
 d.future.push(['000000000000000000000001','2026-11-19','legendary-ley-line-anomaly','new-run1',
  member,'other-commander','',4,'OWNER_MANUAL_OTHER_COMMANDER','owner-123456','OWNER_FINAL','','2026-11-19T08:00:00.000Z']);
 const x=make(d);
 assert.equal(x.out.members.length,1);
 assert.equal(x.out.events.length,1);
 assert.equal(x.out.awards.length,61);
 assert.equal(x.out.awards.at(-1).points,4);
 assert.equal(validateOwnerFeed(x.out,baseline).publicMembers,38);
 assert.equal(combineOwnerFeed(baseline,x.out).population.candidatePoints,1890);
 assert(!JSON.stringify(x.out).includes('owner-123456'));
});
test('a pending Other Commander gets no points; other approved rows continue',()=>{
 const d=baseRows();
 d.future.push(['000000000000000000000001','2026-11-19','mothman','new-run1',
  baseline.members[0].id,'other-commander','', '', 'OWNER_MANUAL_OTHER_COMMANDER','', 'PENDING_OWNER_POINTS']);
 const x=make(d);
 assert.equal(x.out.awards.length,60);assert.equal(x.out.source.throughDate,'2026-10-26');
 assert.equal(validateOwnerFeed(x.out,baseline).points,192);
});
test('owner-approved 4-point future standard rule does not change old 3-point awards',()=>{
 const d=baseRows();
 d.rules.push(['tt-commander-2026-11-19','V2-05','triple-trouble','commander',4,'2026-11-19','OWNER_FINAL','owner-123456']);
 d.future.push(['000000000000000000000002','2026-11-19','triple-trouble','new-run1',
  baseline.members[0].id,'commander','V2-05',4,'APPROVED_RULE','owner-123456','OWNER_FINAL',
  'tt-commander-2026-11-19','2026-11-19T08:00:00.000Z']);
 const x=make(d),merged=combineOwnerFeed(baseline,x.out);
 assert.equal(x.out.awards.at(-1).points,4);
 assert.equal(merged.rules.find(r=>r.id==='V2-05').points,4);
 assert(merged.awards.filter(a=>a.ruleId==='V2-05'&&a.eventDate<'2026-11-19').every(a=>a.points===3));
});
test('invalid owner rule points, default Other Commander, and duplicate submissions fail closed',()=>{
 const mutations=[
  d=>{d.rules.push(['bad-other','NEW-OC','mothman','other-commander',4,'2026-11-19','OWNER_FINAL','owner-123456'])},
  d=>{d.legacy[1][11]=20},
  d=>{d.members.push(['m-000000000000cafe','New','2026-11-19','DRAFT','owner-123456'])},
  d=>{d.future.push(['000000000000000000000002','2026-11-19','triple-trouble','run',
    baseline.members[0].id,'other-commander','',5,'OWNER_MANUAL_OTHER_COMMANDER','owner-123456','OWNER_FINAL','','2026-11-19T08:00:00.000Z'])}
 ];
 for(const mutate of mutations){const d=baseRows();mutate(d);assert.equal(make(d).out.kind,'UNAVAILABLE')}
});
test('no change to owner private Sheets or production deployments',()=>{
 const manifest=JSON.parse(read('backend/points-v2-live-feed/appsscript.json'));
 assert(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly'));
 assert(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
});
