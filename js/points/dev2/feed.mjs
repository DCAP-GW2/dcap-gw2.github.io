import {DCAP_V2 as E} from '../v2/engine.js';
import {DCAP_FEED_V2 as Old} from '../v2/feed.js';
import {SCHEMA} from './schema.mjs';
export const VERSION='2.0.0-dev.2';
export const stable=E.stable;
export const contentHash=Old.contentHash;
export const awardId=Old.awardId || ((a,sha)=>'a-'+sha(stable([a.memberId,a.eventId,a.roleId,a.eventDate,a.cycleId,a.eventInstance])).slice(0,24));
export const events=SCHEMA.properties.events.const;
export const rules=Old.ruleDefs();
export const maxBytes=Old.maxBytes;
const check=(b,msg='FEED_DEV2_INVALID')=>{if(!b)throw Error(msg)};
const same=(a,b)=>stable(a)===stable(b);
const sum=(rs,k)=>rs.reduce((n,r)=>n+r[k],0);
const sorted=(a,b)=>a<b?-1:a>b?1:0;
// Bounded, closed schema interpreter. This schema contains no external references.
export function shape(v,s=SCHEMA){
 if(s.anyOf){check(s.anyOf.some(x=>{try{shape(v,x);return true}catch{return false}}));return}
 if('const' in s)check(same(v,s.const));
 if(s.enum)check(s.enum.some(x=>same(x,v)));
 if(s.type){const valid=s.type==='null'?v===null:s.type==='array'?Array.isArray(v):s.type==='object'?v!==null&&typeof v==='object'&&!Array.isArray(v):s.type==='integer'?Number.isSafeInteger(v):typeof v===s.type;check(valid)}
 if(typeof v==='number'){if(s.minimum!==undefined)check(v>=s.minimum);if(s.maximum!==undefined)check(v<=s.maximum)}
 if(typeof v==='string'){
  if(s.minLength!==undefined)check(v.length>=s.minLength);if(s.maxLength!==undefined)check(v.length<=s.maxLength);if(s.pattern)check(new RegExp(s.pattern).test(v));
  if(s.format==='date')check(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
  if(s.format==='date-time')check(Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z'));
 }
 if(Array.isArray(v)){if(s.maxItems!==undefined)check(v.length<=s.maxItems);if(s.minItems!==undefined)check(v.length>=s.minItems);if(s.uniqueItems)check(new Set(v.map(stable)).size===v.length);if(s.items)v.forEach(x=>shape(x,s.items))}
 if(v&&typeof v==='object'&&!Array.isArray(v)&&s.properties){check((s.required||[]).every(k=>Object.hasOwn(v,k)));check(s.additionalProperties!==false||Object.keys(v).every(k=>Object.hasOwn(s.properties,k)));for(const k of Object.keys(v))if(s.properties[k])shape(v[k],s.properties[k])}
}
export function derive(awards,members){return {...Old.derive(awards,members),provenanceTotals:['APPROVED_RULE','RATIFIED_HISTORICAL_EXCEPTION'].map(provenanceType=>{const rs=awards.filter(a=>a.provenanceType===provenanceType);return {provenanceType,awardCandidateCount:rs.length,candidatePoints:sum(rs,'points')}})}}
export function boundedShape(p) {
 const stack = [[p, 0]];
 let nodes = 0;
 while (stack.length) {
  const [value, depth] = stack.pop();
  check(++nodes <= 200000 && depth <= 32);
  if (value && typeof value === 'object') {
   for (const child of Object.values(value)) stack.push([child, depth + 1]);
  }
 }
 check(new TextEncoder().encode(JSON.stringify(p)).length <= maxBytes);
 shape(p);
}
export function validate(p,sha){try{
 boundedShape(p);check(same(p.rules,rules));
 const n=p.population,c=p.completeness;
 check(n.sourceCount===n.approvedRuleCount+n.ratifiedExceptionCount+n.confirmedIneligibleCount+n.unresolvedCount+n.suppressedCount);
 check(n.awardCandidateCount===n.approvedRuleCount+n.ratifiedExceptionCount&&n.candidatePoints===n.approvedRulePoints+n.ratifiedExceptionPoints);
 check(n.awardCandidateCount===n.projectedAwardCount+n.withheldAwardCount&&n.candidatePoints===n.projectedPoints+n.withheldPoints);
 check(n.canonicalMemberCount===n.observedPublicIdCount+n.missingPublicIdCount&&p.members.length===n.observedPublicIdCount);
 check(c.historicalDecisions===(n.unresolvedCount===0?'COMPLETE':'INCOMPLETE'));
 check(c.publicIdentity===(n.missingPublicIdCount===0?'COMPLETE':'LIMITED'));
 check(Date.parse(p.validation.generatedAt)>=Date.parse(p.source.observedAt));
 check((n.sourceCount===0&&n.periodStart===null&&n.periodEnd===null&&p.source.latestEventDate===null)||(n.sourceCount>0&&n.periodStart!==null&&n.periodEnd!==null&&n.periodStart<=n.periodEnd&&p.source.latestEventDate===n.periodEnd));
 check(p.awards.length===n.projectedAwardCount&&sum(p.awards,'points')===n.projectedPoints);
 const members=new Set(p.members.map(m=>m.id));check(members.size===p.members.length&&same([...members].sort(),p.members.map(m=>m.id)));
 const ids=new Set(),tuples=new Set(),refs=new Map();
 for(const e of p.historicalExceptions){check(!refs.has(e.ref));refs.set(e.ref,e);check(e.points===3&&e.roleId==='other-commander'&&['mothman','rifts','wizard-tower'].includes(e.eventId)&&e.eventDate<=e.approvalDate)}
 const usedRefs=new Set();
 for(const a of p.awards){
  check(members.has(a.memberId)&&!ids.has(a.id)&&a.id===awardId(a,sha));ids.add(a.id);
  check(a.eventDate>=n.periodStart&&a.eventDate<=n.periodEnd);
  const tuple=stable([a.memberId,a.eventId,a.eventDate,a.eventInstance,a.roleId]);check(!tuples.has(tuple));tuples.add(tuple);
  if(a.provenanceType==='APPROVED_RULE'){
   const r=rules.find(r=>r.id===a.ruleId);check(r&&r.points!==null&&r.points===a.points&&r.roleId===a.roleId&&(r.eventId===a.eventId||r.eventId==='all-events')&&a.exceptionRef===null);
   check(events.find(e=>e.id===a.eventId)?.eligibility==='RULE_VALIDATED');
  }else{
   check(a.ruleId===null&&a.roleId==='other-commander'&&!usedRefs.has(a.exceptionRef));const e=refs.get(a.exceptionRef);check(e&&e.awardId===a.id);usedRefs.add(a.exceptionRef);
   for(const k of ['memberId','eventId','roleId','eventDate','eventInstance','cycleId','points'])check(same(e[k],a[k]));
  }
 }
 check(usedRefs.size===refs.size);
 for(const a of p.awards)if(['bfla','dragons-end','cm-convergence'].includes(a.eventId)&&a.roleId==='sub-lane-lead')check(!p.awards.some(b=>b.memberId===a.memberId&&b.eventDate===a.eventDate&&b.eventId===a.eventId&&b.eventInstance===a.eventInstance&&b.roleId==='commander'));
 check(same(p.awards,p.awards.slice().sort((a,b)=>sorted(b.eventDate,a.eventDate)||sorted(a.id,b.id))));
 const computed=derive(p.awards,p.members);for(const k of Object.keys(computed))check(same(p[k],computed[k]));
 const wt=new Map();for(const w of p.withheldAwardSummary){check(!wt.has(w.provenanceType)&&w.count>0&&w.points>0);wt.set(w.provenanceType,w)}
 check(sum(p.withheldAwardSummary,'count')===n.withheldAwardCount&&sum(p.withheldAwardSummary,'points')===n.withheldPoints);
 for(const [type,count,points] of [['APPROVED_RULE','approvedRuleCount','approvedRulePoints'],['RATIFIED_HISTORICAL_EXCEPTION','ratifiedExceptionCount','ratifiedExceptionPoints']]){
  const v=p.provenanceTotals.find(r=>r.provenanceType===type),w=wt.get(type);check(v.awardCandidateCount+(w?.count||0)===n[count]&&v.candidatePoints+(w?.points||0)===n[points]);
 }
 check(same(p.pendingSummary.map(r=>r.status),[...new Set(p.pendingSummary.map(r=>r.status))].sort()));check(sum(p.pendingSummary,'count')===n.unresolvedCount);
 check(p.validation.contentHash===contentHash(p,sha));return {valid:true};
 }catch{return {valid:false,error:'FEED_DEV2_INVALID'}}}
export function seal(p,sha){p.validation.contentHash=contentHash(p,sha);check(validate(p,sha).valid,'Generated feed failed semantic validation');return p}
export async function validateAsync(p){try{
 boundedShape(p);
 const inputs=[stable((()=>{const x=structuredClone(p);delete x.validation.contentHash;return x})()),...p.awards.map(a=>stable([a.memberId,a.eventId,a.roleId,a.eventDate,a.cycleId,a.eventInstance]))];
 const hashes=new Map(await Promise.all(inputs.map(async s=>[s,Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('')])));
 return validate(p,s=>{check(hashes.has(s));return hashes.get(s)}).valid;
 }catch{return false}}
