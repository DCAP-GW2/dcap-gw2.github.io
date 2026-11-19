import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const baseline=JSON.parse(read('points/data/v2/releases/r000.json'));
const continuing=JSON.parse(read('points/data/v2/releases/r001.json'));
const script=read('backend/points-v2-owner-registry/Code.gs');
const readManifest=JSON.parse(read('backend/points-v2-owner-registry/appsscript.json'));
const header={
 legacy:['seq','entryId','candidateKey','sourceMessageId','sourceReference','eventDate','eventId','instanceId','memberId','roleId','ruleId','v2Points','approvedBy','approvedAt','approvalDigest','ruleVersion','status','prevDigest','rowDigest','processingRevision'],
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 future:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType','ownerDecisionRef','status','ruleVersionId','approvedAt']
};
function rows(){
 let prev='GENESIS';
 const legacy=[header.legacy];
 continuing.awards.forEach((award,index)=>{
  const digest=(index+1).toString(16).padStart(64,'0');
  legacy.push([index+1,'PRIVATE_ENTRY',award.id.slice(4),'PRIVATE_MSG',
   'PRIVATE_SOURCE_REFERENCE',award.eventDate,award.eventId,'fixture-'+index,
   award.memberId,award.roleId,award.ruleId,award.points,'PRIVATE_OWNER_EMAIL',
   '2026-11-20T00:00:00Z','a'.repeat(64),'DCAP Points v2.0',
   'REAL_APPROVED',prev,digest,'PRIVATE_REVISION']);
  prev=digest;
 });
 return {legacy,members:[header.members],events:[header.events],
  rules:[header.rules],future:[header.future]};
}
function run(input=rows(),override={}){
 const journal='j'.repeat(30),registry='r'.repeat(30),calls=[];
 const props={
  DCAP_V2_JOURNAL_ID:journal,DCAP_V2_REGISTRY_ID:registry,
  DCAP_V2_PUBLIC_IDS_JSON:JSON.stringify(baseline.members.map(x=>x.id)),
  ...override.props
 };
 const context={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})},
  Sheets:{Spreadsheets:{Values:{get:(id,range,options)=>{
   calls.push([id,range]);assert.equal(options.valueRenderOption,'UNFORMATTED_VALUE');
   if(id===journal&&range.includes('Real Award Journal'))return {values:input.legacy};
   assert.equal(id,registry,'Only journal and registry are permitted');
   const tab=range.includes('N5 Public Members')?'members':range.includes('N5 Events')?'events':
    range.includes('N5 Rule Versions')?'rules':range.includes('N5 Owner Awards')?'future':null;
   assert(tab,'Unexpected private read range');
   return {values:input[tab]};
  }}}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({
   text:s,getContent(){return s},setMimeType(){return this}})},
  console:{log:()=>{}}
 };
 vm.createContext(context);vm.runInContext(script,context);
 return {doc:JSON.parse(context.doGet().getContent()),calls};
}
test('public script runs on read-only scopes and offers no mutation endpoints',()=>{
 assert(readManifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly'));
 assert(!readManifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
 assert(!/function\s+doPost\s*\(/.test(script));
 assert(!/Sheets\.Spreadsheets\.batchUpdate\s*\(|Sheets\.Spreadsheets\.Values\.(append|batchUpdate|update)\s*\(/.test(script));
});
test('first release reads two private workbooks and exposes only approved 60/192',()=>{
 const x=run();
 assert.equal(x.calls.length,5);
 const summary=validateOwnerFeed(x.doc,baseline);
 assert.equal(summary.awards,60);assert.equal(summary.points,192);
 const combined=combineOwnerFeed(baseline,x.doc);
 assert.equal(combined.population.awardCandidateCount,611);
 assert.equal(combined.population.candidatePoints,1886);
 assert.equal(combined.members.length,37);
 assert.equal(combined.rewardsEnabled,false);
 const published=JSON.stringify(x.doc);
 for(const privateValue of ['PRIVATE_ENTRY','PRIVATE_MSG','PRIVATE_SOURCE_REFERENCE',
  'PRIVATE_OWNER_EMAIL','PRIVATE_REVISION','ownerDecisionRef','candidateKey'])
  assert(!published.includes(privateValue),'private information leaked: '+privateValue);
});
test('one new approved fictional registry award appears without another r00x release',()=>{
 const input=rows();
 input.future.push([
  '0000000000000000000000ba','2026-11-20','triple-trouble',
  'fictional-simple-20261120-001','m-07906d14a72fc674',
  'blocker','V2-03',3,'APPROVED_RULE','owner-fictional-simple-20261120',
  'OWNER_FINAL','','2026-11-20T01:00:00Z'
 ]);
 const {doc}=run(input),summary=validateOwnerFeed(doc,baseline);
 assert.equal(summary.awards,61);assert.equal(summary.points,195);
 const merged=combineOwnerFeed(baseline,doc);
 assert.equal(merged.population.candidatePoints,1889);
 assert.equal(merged.population.awardCandidateCount,612);
 assert.equal(merged.members.length,37);
 assert.equal(doc.baselineRevision,'r000');
 assert.equal(doc.awards.at(-1).ruleId,'V2-03');
 assert.equal(doc.awards.at(-1).points,3);
});
test('invalid private registry data returns only safe unavailable signal',()=>{
 const input=rows();
 input.future.push([
  '0000000000000000000000bb','2026-11-20','triple-trouble','fictional-instance',
  'm-07906d14a72fc674','blocker','V2-03',300,'APPROVED_RULE',
  'owner-test-case','OWNER_FINAL','','2026-11-20T01:00:00Z'
 ]);
 const {doc}=run(input);
 assert.deepEqual(doc,{kind:'UNAVAILABLE'});
});
test('invalid spreadsheet configuration fails closed without public diagnostics',()=>{
 const r=run(rows(),{props:{DCAP_V2_REGISTRY_ID:'INVALID'}});
 assert.deepEqual(r.doc,{kind:'UNAVAILABLE'});
});
