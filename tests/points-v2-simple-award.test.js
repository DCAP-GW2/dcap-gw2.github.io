import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planSimpleAward,preparedAppendCells,parseSheetRows,SCHEMA} from '../backend/points-v2-simple/simple-award.mjs';
const baseline=JSON.parse(readFileSync(new URL('../points/data/v2/releases/r000.json',import.meta.url),'utf8'));
const member=baseline.members[0].id;
const fixture=()=>({members:[],events:[],rules:[],future:[]});
const j=[];
const final=(extra={})=>({ownerFinal:true,ownerDecisionRef:'owner-final-123',
 candidateKey:'0000000000000000000000fa',eventDate:'2026-11-20',
 eventId:'triple-trouble',memberId:member,instanceId:'instance-001',
 roleId:'blocker',approvedAt:'2026-11-20T00:00:00Z',...extra});
const plan=(decision,registry=fixture(),journal=j)=>planSimpleAward({baseline,registry,journal,decision});
test('standard score from fixed historical rule; one append request, no write',()=>{
 const p=plan(final());assert.equal(p.state,'READY_TO_APPEND');assert.equal(p.points,3);
 assert.equal(p.ruleId,'V2-03');assert.equal(p.roleId,'blocker');
 const request=preparedAppendCells(p);
 assert.deepEqual(Object.keys(request),['appendCells']);
 assert.equal(request.appendCells.sheetId,18306103);
 assert.equal(request.appendCells.rows[0].values.length,13);
 assert.equal(request.appendCells.rows[0].values[7].userEnteredValue.numberValue,3);
});
test('reject invalid or mismatched standard points and missing owner final',()=>{
 assert.throws(()=>plan(final({points:5})),/RULE_POINTS_MISMATCH/);
 assert.throws(()=>plan(final({ownerFinal:false})),/OWNER_FINAL/);
 assert.throws(()=>plan(final({approvedAt:null})),/APPROVED_AT_REQUIRED/);
 assert.throws(()=>plan(final({memberId:'m-9999999999999999'})),/MEMBER_UNKNOWN/);
});
test('unruled Commander requires a fresh individual point choice',()=>{
 const r=fixture();r.events.push({eventId:'ley-line-anomaly',eventLabel:'Ley Line',status:'OWNER_FINAL',ownerDecisionRef:'owner-final-123'});
 const x=final({eventId:'ley-line-anomaly',roleId:'commander',points:undefined});
 const ask=plan(x,r);assert.equal(ask.state,'ASK_OTHER_COMMANDER_POINTS');
 assert.equal(ask.points,null);
 assert.throws(()=>plan({...x,points:0},r),/OTHER_COMMANDER_POINTS_REQUIRED/);
 const p=plan({...x,points:4},r);
 assert.equal(p.state,'READY_TO_APPEND');assert.equal(p.ruleId,null);
 assert.equal(p.values[8],'OWNER_MANUAL_OTHER_COMMANDER');
 assert.equal(p.values[7],4);
 const second=plan({...x,instanceId:'instance-002',candidateKey:'0000000000000000000000fb'},r);
 assert.equal(second.state,'ASK_OTHER_COMMANDER_POINTS');
});
test('new member is allowed after owner-approved registry entry',()=>{
 const r=fixture();
 r.members.push({memberId:'m-000000000000cafe',displayName:'Fictional New Member',
  approvedFrom:'2026-11-19',status:'OWNER_FINAL',ownerDecisionRef:'owner-final-123'});
 assert.equal(plan(final({memberId:'m-000000000000cafe'}),r).state,'READY_TO_APPEND');
 assert.throws(()=>plan(final({memberId:'m-000000000000cafe',eventDate:'2026-11-18'}),r),/MEMBER_UNKNOWN/);
});
test('new owner rule version takes effect only after its date',()=>{
 const r=fixture();r.rules.push({
  ruleVersionId:'tt-blocker-from-2026-12-01',ruleId:'V2-03',
  eventId:'triple-trouble',roleId:'blocker',points:4,effectiveFrom:'2026-12-01',status:'OWNER_FINAL',
  ownerDecisionRef:'owner-final-987'});
 assert.equal(plan(final(),r).points,3);
 assert.equal(plan(final({eventDate:'2026-12-01'}),r).points,4);
});
test('same candidate or same person event instance and role triggers duplicate warning',()=>{
 const recorded={...final(),status:'OWNER_FINAL',ruleId:'V2-03',points:3};
 const r=fixture();r.future.push(recorded);
 assert.equal(plan(final(),r).state,'POSSIBLE_DUPLICATE');
 assert.equal(plan(final({candidateKey:'0000000000000000000000fb'}),r).reason,'SAME_MEMBER_EVENT_INSTANCE_ROLE');
 assert.equal(plan(final({candidateKey:'0000000000000000000000fb',instanceId:'instance-002'}),r).state,'READY_TO_APPEND');
 assert.throws(()=>preparedAppendCells(plan(final(),r)),/NOT_APPROVED/);
});
test('existing journal duplicate is checked without modifying the journal',()=>{
 const row={status:'REAL_APPROVED',candidateKey:'ffffffffffffffffffffffff',eventDate:'2026-11-20',
  eventId:'triple-trouble',instanceId:'instance-001',memberId:member,roleId:'blocker',ruleId:'V2-03'};
 assert.equal(plan(final(),fixture(),[row]).state,'POSSIBLE_DUPLICATE');
 assert.equal(row.status,'REAL_APPROVED');
});
test('BFLA commander/lane stacking is flagged even when roles differ',()=>{
 const r=fixture();
 r.future.push({...final({eventId:'bfla',roleId:'commander'}),ruleId:'V2-08',status:'OWNER_FINAL'});
 const p=plan(final({eventId:'bfla',roleId:'sub-lane-lead',candidateKey:'0000000000000000000000fb'}),r);
 assert.equal(p.state,'POSSIBLE_DUPLICATE');
 assert.equal(p.reason,'NON_STACKING_ROLES');
});
test('pending Other Commander needs an owner amount and can then be finalised once',()=>{
 const r=fixture();r.events.push({eventId:'ley-line-anomaly',status:'OWNER_FINAL'});
 r.future.push({...final({eventId:'ley-line-anomaly',roleId:'other-commander'}),
  status:'PENDING_OWNER_POINTS'});
 const p=plan(final({eventId:'ley-line-anomaly',roleId:'commander',points:6}),r);
 assert.equal(p.state,'READY_TO_APPEND');
 assert.equal(p.values[7],6);
 r.future.push({...p.values.reduce((o,v,i)=>(o[SCHEMA.future[i]]=v,o),{}),status:'OWNER_FINAL'});
 assert.equal(plan(final({eventId:'ley-line-anomaly',roleId:'commander',points:6}),r).state,'POSSIBLE_DUPLICATE');
});
test('strict headers detect accidental sheet structure drift',()=>{
 assert.deepEqual(parseSheetRows([SCHEMA.members,['m-000000000000cafe','One','2026-11-20','OWNER_FINAL','owner-final']], 'members')[0].displayName,'One');
 assert.throws(()=>parseSheetRows([['other','columns']], 'members'),/HEADER_MISMATCH/);
});
