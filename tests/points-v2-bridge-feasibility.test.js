import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildReadOnlyProbeRequest,validateProbeReceipt,interpretScriptsRunResponse,
 executeDryProbe} from '../backend/points-v2-bridge/offline-bridge-client.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const raw=read('backend/points-v2-bridge/BridgeProbe.gs');
const scope=JSON.parse(read('backend/points-v2-bridge/appsscript.json'));
const ID='x'.repeat(30);
const expected={
 stage:'DCAP_V2_AUTHENTICATED_BRIDGE_READ_ONLY',state:'PASS',
 fictionalOnly:true,memberRows:1,eventRows:1,ruleRows:0,awardRows:1,
 fictionalAwardPoints:4,spreadsheetWrites:0,realRegistryWrites:0,
 historicalJournalWrites:0,rewardsEnabled:false
};
const specs={
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 awards:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType','ownerDecisionRef','status','ruleVersionId','approvedAt']
};
const data={
 members:[specs.members,['m-000000000000cafe','Fictional Test Commander','2026-11-20','OWNER_FINAL','private-ref']],
 events:[specs.events,['ley-line-anomaly','Fictional Ley-Line Anomaly','OWNER_FINAL','private-ref']],
 rules:[specs.rules],
 awards:[specs.awards,['0000000000000000000000af','2026-11-20','ley-line-anomaly','fixture-instance',
  'm-000000000000cafe','other-commander','',4,'OWNER_MANUAL_OTHER_COMMANDER','private-ref','OWNER_FINAL','','2026-11-20T01:00:00Z']]
};
function probe(override={}){
 const props={
  DCAP_BRIDGE_MODE:'FICTIONAL_READ_ONLY',
  DCAP_BRIDGE_DISPOSABLE_ID:ID,
  DCAP_BRIDGE_OWNER_EMAIL:'owner@example.invalid',
  ...override.props
 };
 const calls=[],context={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null})},
  Session:{getEffectiveUser:()=>({getEmail:()=>override.email??'owner@example.invalid'})},
  Sheets:{Spreadsheets:{
   get:(id,params)=>{calls.push('get');assert.equal(id,ID);
    assert.equal(params.fields,'properties(title)');
    return {properties:{title:override.title??'DCAP v2 — Native Writer Acceptance — Disposable Fictional — 2026-11-20'}}},
   Values:{get:(id,range,options)=>{
    calls.push('read');assert.equal(id,ID);
    assert.equal(options.valueRenderOption,'UNFORMATTED_VALUE');
    let key=range.includes('Public Members')?'members':range.includes('Events')?'events':
     range.includes('Rule Versions')?'rules':'awards';
    return {values:data[key]};
   }}
  }}
 };
 vm.createContext(context);vm.runInContext(raw,context);
 return {context,calls};
}
const runResult=r=>({done:true,response:{
 '@type':'type.googleapis.com/google.apps.script.v1.ExecutionResponse',result:r
}});
test('Apps Script API probe requires strictly read-only scopes and contains no writer code',()=>{
 assert(scope.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly'));
 assert(!scope.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
 assert(!/doPost\s*\(|batchUpdate\s*\(|Values\.(append|update|batchUpdate)\s*\(|ScriptApp\./.test(raw));
 assert(!raw.includes('ownerApplyApprovedBatch_'));
});
test('native read-only disposable fixture produces aggregate-only receipt',()=>{
 const p=probe(),receipt=JSON.parse(JSON.stringify(p.context.probeBridgeReadOnly()));
 assert.deepEqual(receipt,expected);
 assert.equal(p.calls.filter(x=>x==='get').length,1);
 assert.equal(p.calls.filter(x=>x==='read').length,4);
 assert(!JSON.stringify(receipt).includes('private-ref'));
 assert(!JSON.stringify(receipt).includes(ID));
});
test('owner identity, mode and target title failures produce no queries to private journal',()=>{
 for(const options of [
  {email:'wrong@example.invalid'},
  {props:{DCAP_BRIDGE_MODE:'WRITER'}},
  {props:{DCAP_BRIDGE_DISPOSABLE_ID:'not-an-id'}},
  {title:'DCAP Points v2 — Owner Registry — PRIVATE DEV — 2026-11-19'}
 ]){
  const p=probe(options);
  assert.throws(()=>p.context.probeBridgeReadOnly(),/BRIDGE_PROBE_/);
  assert(!p.calls.includes('write'));
 }
});
test('scripts.run builder exposes only a fixed read-only function with no external args',()=>{
 const q=buildReadOnlyProbeRequest({deploymentId:ID,mode:'FICTIONAL_READ_ONLY'});
 assert.equal(q.method,'POST');
 assert.equal(q.body.function,'probeBridgeReadOnly');
 assert.deepEqual(q.body.parameters,[]);
 assert.equal(q.body.devMode,false);
 assert(q.expectedScopes.every(x=>x!=='https://www.googleapis.com/auth/spreadsheets'));
 for(const altered of [
  {deploymentId:ID,mode:'LIVE'},
  {deploymentId:ID,mode:'FICTIONAL_READ_ONLY',function:'ownerApplyApprovedBatch_'},
  {deploymentId:'wrong',mode:'FICTIONAL_READ_ONLY'}
 ])assert.throws(()=>buildReadOnlyProbeRequest(altered),/DCAP_BRIDGE_/);
});
test('mock Google Execution API envelope passes only the exact aggregate schema',()=>{
 assert.deepEqual(validateProbeReceipt(expected),{
  state:'PASSED_READ_ONLY_PROBE',fictionalOnly:true,recordCounts:[1,1,0,1],fictionalPoints:4,writes:0
 });
 assert.equal(interpretScriptsRunResponse(runResult(expected)).writes,0);
 for(const m of [
  {...expected,spreadsheetWrites:1},
  {...expected,rewardsEnabled:true},
  {...expected,privateEmail:'secret'},
  {...expected,awardRows:2}
 ])assert.throws(()=>interpretScriptsRunResponse(runResult(m)),/DCAP_BRIDGE_/);
 assert.throws(()=>interpretScriptsRunResponse({error:{code:403,message:'Permission denied'}}),/DCAP_BRIDGE_/);
});
test('mock transport injects no credentials and never calls a live external script',async()=>{
 let calls=0;
 const result=await executeDryProbe({deploymentId:ID,mode:'FICTIONAL_READ_ONLY',transport:async req=>{
  calls++;
  assert.equal(req.body.function,'probeBridgeReadOnly');
  assert.equal(req.path,'/v1/scripts/'+ID+':run');
  assert(!('headers' in req));
  return runResult(expected);
 }});
 assert.equal(calls,1);assert.equal(result.writes,0);
});
