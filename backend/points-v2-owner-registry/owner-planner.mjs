/**
 * Offline owner-authority contribution planner; no Sheets, Apps Script or network writes.
 * An explicit final owner instruction is the only policy approval required.
 * Other Commander NEVER has a default points value.
 */
import {classifyCommander,OTHER_COMMANDER} from '../../points/v2/owner-feed.mjs';
const id=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{1,90}$/.test(x);
const ruleId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{1,90}$/.test(x);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const err=k=>{throw Error('OWNER_PLAN_'+k)};
/** Returns a pending question, a policy-matched draft, or a final authorised plan. */
export function planContribution(input,{baselineRules,ruleVersions=[]}){
 if(!input||!id(input.eventId)||!id(input.memberId)||!date(input.eventDate)||
    !id(input.roleId)||!id(input.instanceId))err('FIELDS');
 if(input.roleId==='commander'||input.roleId===OTHER_COMMANDER){
  const classified=classifyCommander(input.eventId,input.eventDate,baselineRules,ruleVersions);
  if(classified.classification==='OTHER_COMMANDER'){
   if(input.points===undefined||input.points===null)
    return {state:'PENDING_OWNER_POINTS',classification:'OTHER_COMMANDER',memberId:input.memberId,
     eventId:input.eventId,eventDate:input.eventDate,instanceId:input.instanceId,points:null,
     question:'How many points do you assign for this specific Other Commander contribution?'};
   if(!positive(input.points))err('MANUAL_POINTS');
   if(!input.ownerFinal||!id(input.ownerDecisionRef))return {state:'PENDING_OWNER_FINAL',
     classification:'OTHER_COMMANDER',points:input.points};
   return {state:'OWNER_FINAL',classification:'OTHER_COMMANDER',memberId:input.memberId,
    eventId:input.eventId,eventDate:input.eventDate,instanceId:input.instanceId,
    roleId:OTHER_COMMANDER,points:input.points,ruleId:null,
    awardType:'OWNER_MANUAL_OTHER_COMMANDER',ownerDecisionRef:input.ownerDecisionRef};
  }
  if(input.roleId===OTHER_COMMANDER)err('STANDARD_COMMANDER_EXISTS');
  if(input.points!==undefined&&input.points!==classified.points)err('STANDARD_RULE_MISMATCH');
  if(!input.ownerFinal||!id(input.ownerDecisionRef))return {state:'PENDING_OWNER_FINAL',
   classification:'STANDARD_COMMANDER',points:classified.points,ruleId:classified.ruleId};
  return {state:'OWNER_FINAL',classification:'STANDARD_COMMANDER',memberId:input.memberId,
   eventId:input.eventId,eventDate:input.eventDate,instanceId:input.instanceId,
   roleId:'commander',points:classified.points,ruleId:classified.ruleId,
   awardType:'APPROVED_RULE',ownerDecisionRef:input.ownerDecisionRef};
 }
 // Non-commander roles are only resolved against a specifically approved rule;
 // no unmatched non-commander award is silently mapped to Other Commander.
 const applicable=baselineRules.filter(r=>r.roleId===input.roleId&&
  (r.eventId===input.eventId||r.eventId==='all-events')&&positive(r.points));
 const resolved=applicable.map(r=>{
  const override=ruleVersions.filter(v=>v.ruleId===r.id&&v.effectiveFrom<=input.eventDate)
   .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);
  return {ruleId:r.id,points:override?.points??r.points};
 });
 if(resolved.length!==1)err('UNRESOLVED_NON_COMMANDER_RULE');
 if(input.points!==undefined&&input.points!==resolved[0].points)err('STANDARD_RULE_MISMATCH');
 if(!input.ownerFinal||!id(input.ownerDecisionRef))return {state:'PENDING_OWNER_FINAL',
  points:resolved[0].points,ruleId:resolved[0].ruleId};
 return {state:'OWNER_FINAL',classification:'STANDARD_ROLE',memberId:input.memberId,
  eventId:input.eventId,eventDate:input.eventDate,instanceId:input.instanceId,
  roleId:input.roleId,points:resolved[0].points,ruleId:resolved[0].ruleId,
  awardType:'APPROVED_RULE',ownerDecisionRef:input.ownerDecisionRef};
}
export function planRuleChange(change,{baselineRules,existingVersions=[]}){
 if(!change||!ruleId(change.ruleId)||!date(change.effectiveFrom)||!positive(change.points))err('RULE_FIELDS');
 if(!change.ownerFinal||!id(change.ownerDecisionRef))return {state:'PENDING_OWNER_FINAL'};
 const prior=baselineRules.find(x=>x.id===change.ruleId);
 if(prior?.roleId==='other-commander'||change.roleId==='other-commander')err('NO_OTHER_COMMANDER_DEFAULT');
 const base=prior||change;
 if(!id(base.eventId)||!id(base.roleId))err('RULE_CONTEXT');
 if(existingVersions.some(v=>v.ruleId===change.ruleId&&v.effectiveFrom===change.effectiveFrom))
  err('RULE_DATE_DUPLICATE');
 const v={id:change.versionId||(change.ruleId+'-'+change.effectiveFrom),
  ruleId:change.ruleId,eventId:base.eventId,roleId:base.roleId,
  points:change.points,effectiveFrom:change.effectiveFrom};
 if(!id(v.id))err('RULE_VERSION_ID');
 return {state:'OWNER_FINAL',action:'APPEND_RULE_VERSION',record:v,
  ownerDecisionRef:change.ownerDecisionRef,retrospective:false};
}
