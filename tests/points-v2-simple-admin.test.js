import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planNewMember,planNewEvent,planRuleVersion,appendRequest} from '../backend/points-v2-simple/simple-admin.mjs';
const baseline=JSON.parse(readFileSync(new URL('../points/data/v2/releases/r000.json',import.meta.url),'utf8'));
const registry=()=>({members:[],events:[],rules:[]});
const approval={ownerFinal:true,ownerDecisionRef:'owner-final-12345'};
test('owner final can append a 38th member without hardcoded roster edits',()=>{
 const p=planNewMember({...approval,memberId:'m-000000000000cafe',
 displayName:'Fictional New Member',approvedFrom:'2026-11-20'},{baseline,registry:registry()});
 assert.equal(p.state,'READY_TO_APPEND');
 assert.equal(p.tabId,1781507585);
 assert.equal(appendRequest(p).appendCells.rows[0].values.length,5);
 assert.throws(()=>planNewMember({...approval,memberId:baseline.members[0].id,
 displayName:'Existing',approvedFrom:'2026-11-20'},{baseline,registry:registry()}),/DUPLICATE_ID/);
});
test('owner can register a new event once, no manual points are inferred',()=>{
 const p=planNewEvent({...approval,eventId:'ley-line-anomaly',
 eventLabel:'Ley Line Anomaly'},{baseline,registry:registry()});
 assert.equal(p.tab,'N5 Events');
 assert.equal(p.values.length,4);
 assert.throws(()=>planNewEvent({...approval,eventId:'triple-trouble',
 eventLabel:'Duplicate'},{baseline,registry:registry()}),/DUPLICATE_EVENT/);
});
test('prospective standard rule change is owner final and preserves original value',()=>{
 const d={...approval,ruleVersionId:'tt-blocker-2026-12-01',ruleId:'V2-03',
 eventId:'triple-trouble',roleId:'blocker',points:4,effectiveFrom:'2026-12-01',todayNZ:'2026-11-20'};
 const p=planRuleVersion(d,{baseline,registry:registry()});
 assert.equal(p.tab,'N5 Rule Versions');assert.equal(p.values[4],4);
 assert.equal(baseline.rules.find(r=>r.id==='V2-03').points,3);
 assert.throws(()=>planRuleVersion({...d,effectiveFrom:'2026-11-19'}, {baseline,registry:registry()}),/PROSPECTIVE_ONLY/);
 assert.throws(()=>planRuleVersion({...d,roleId:'commander'}, {baseline,registry:registry()}),/RULE_ID_SCOPE_CHANGED/);
 const reg=registry();reg.rules.push({ruleVersionId:d.ruleVersionId,ruleId:d.ruleId,effectiveFrom:d.effectiveFrom});
 assert.throws(()=>planRuleVersion(d,{baseline,registry:reg}),/DUPLICATE_VERSION/);
});
test('Other Commander remains case-by-case; cannot establish default numeric rule',()=>{
 const d={...approval,ruleVersionId:'other-commander-general',ruleId:'V2-25',
 eventId:'triple-trouble',roleId:'other-commander',points:4,
 effectiveFrom:'2026-12-01',todayNZ:'2026-11-20'};
 assert.throws(()=>planRuleVersion(d,{baseline,registry:registry()}),/SIMPLE_ADMIN_RULE/);
});
test('no administrative write plan without owner final approval',()=>{
 assert.throws(()=>planNewMember({ownerFinal:false,memberId:'m-000000000000cafe',
 displayName:'New',approvedFrom:'2026-11-20'},{baseline,registry:registry()}),/OWNER_FINAL/);
 assert.throws(()=>appendRequest({state:'PENDING'}),/SIMPLE_ADMIN_PLAN/);
});
