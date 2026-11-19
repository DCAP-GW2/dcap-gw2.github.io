/**
 * DCAP v2: minimal, owner-final Members / Events / Rule Versions append planner.
 * Append proposals only; connected Sheets tool owns execution and readback.
 * No Cloud project, API executable, public writer or recurring releases.
 */
const ok=(x,k)=>{if(!x)throw Error('SIMPLE_ADMIN_'+k)};
const id=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(x);
const ruleId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{1,90}$/.test(x);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const final=x=>x?.ownerFinal===true&&typeof x.ownerDecisionRef==='string'&&
 /^[A-Za-z0-9_-]{6,90}$/.test(x.ownerDecisionRef);
const ready=(type,tabId,tabName,values)=>Object.freeze({
 state:'READY_TO_APPEND',type,tabId,tab:tabName,values:Object.freeze(values)
});
export function planNewMember(decision,{baseline,registry}){
 ok(final(decision),'OWNER_FINAL');
 const d=decision;
 ok(/^m-[0-9a-f]{16}$/.test(d.memberId||'')&&typeof d.displayName==='string'&&
  d.displayName.trim().length>0&&d.displayName.length<=160&&day(d.approvedFrom),'MEMBER');
 ok(!baseline.members.some(m=>m.id===d.memberId)&&
  !registry.members.some(m=>m.memberId===d.memberId),'DUPLICATE_ID');
 return ready('MEMBER',1781507585,'N5 Public Members',
  [d.memberId,d.displayName,d.approvedFrom,'OWNER_FINAL',d.ownerDecisionRef]);
}
export function planNewEvent(decision,{baseline,registry}){
 ok(final(decision),'OWNER_FINAL');
 const d=decision;ok(id(d.eventId)&&typeof d.eventLabel==='string'&&
  d.eventLabel.trim().length>0&&d.eventLabel.length<=160,'EVENT');
 ok(!baseline.events.some(e=>e.id===d.eventId)&&
  !registry.events.some(e=>e.eventId===d.eventId),'DUPLICATE_EVENT');
 return ready('EVENT',18306101,'N5 Events',
  [d.eventId,d.eventLabel,'OWNER_FINAL',d.ownerDecisionRef]);
}
export function planRuleVersion(decision,{baseline,registry}){
 ok(final(decision),'OWNER_FINAL');
 const d=decision;
 ok(id(d.ruleVersionId)&&ruleId(d.ruleId)&&id(d.eventId)&&id(d.roleId)&&
  d.roleId!=='other-commander'&&Number.isSafeInteger(d.points)&&d.points>0&&
  day(d.effectiveFrom),'RULE');
 ok(d.effectiveFrom>=d.todayNZ,'PROSPECTIVE_ONLY');
 const knownEvents=new Set([...baseline.events.map(e=>e.id),...registry.events.map(e=>e.eventId),'all-events']);
 ok(knownEvents.has(d.eventId),'UNKNOWN_EVENT');
 const previous=baseline.rules.find(r=>r.id===d.ruleId)||
  registry.rules.find(r=>r.ruleId===d.ruleId);
 if(previous)ok(previous.eventId===d.eventId&&previous.roleId===d.roleId,'RULE_ID_SCOPE_CHANGED');
 ok(!registry.rules.some(v=>v.ruleVersionId===d.ruleVersionId||
  (v.ruleId===d.ruleId&&v.effectiveFrom===d.effectiveFrom)),'DUPLICATE_VERSION');
 return ready('RULE_VERSION',18306102,'N5 Rule Versions',
  [d.ruleVersionId,d.ruleId,d.eventId,d.roleId,d.points,d.effectiveFrom,
   'OWNER_FINAL',d.ownerDecisionRef]);
}
export function appendRequest(plan){
 ok(plan?.state==='READY_TO_APPEND'&&Array.isArray(plan.values),'PLAN');
 return {appendCells:{sheetId:plan.tabId,rows:[{values:plan.values.map(v=>
  typeof v==='number'?{userEnteredValue:{numberValue:v}}:
  {userEnteredValue:{stringValue:String(v)}})}],fields:'userEnteredValue'}};
}
