/**
 * DCAP Points v2 — offline-only bridge request builder.
 * Does not open network connections, hold OAuth tokens or mutate any data.
 * The only supported function is the separate, read-only fictional probe.
 * An authenticated transport must be approved and injected in a later phase.
 */
export const BRIDGE_MODE='FICTIONAL_READ_ONLY';
export const PROBE_FUNCTION='probeBridgeReadOnly';
const VALID_ID=/^[A-Za-z0-9_-]{20,160}$/;
export const EXPECTED_KEYS=Object.freeze([
 'stage','state','fictionalOnly','memberRows','eventRows','ruleRows',
 'awardRows','fictionalAwardPoints','spreadsheetWrites','realRegistryWrites',
 'historicalJournalWrites','rewardsEnabled'
]);
function assert(ok,code){if(!ok)throw Error('DCAP_BRIDGE_'+code)}
export function buildReadOnlyProbeRequest(options={}){
 const keys=Object.keys(options).sort();
 assert(keys.every(k=>['scriptId','mode'].includes(k))&&keys.includes('scriptId')&&keys.includes('mode'),'REQUEST_FIELDS');
 assert(options.mode===BRIDGE_MODE,'MODE');
 assert(typeof options.scriptId==='string'&&VALID_ID.test(options.scriptId),'SCRIPT_ID');
 return Object.freeze({
  method:'POST',
  path:'/v1/scripts/'+encodeURIComponent(options.scriptId)+':run',
  body:Object.freeze({function:PROBE_FUNCTION,parameters:[],devMode:false}),
  expectedScopes:Object.freeze([
   'https://www.googleapis.com/auth/spreadsheets.readonly',
   'https://www.googleapis.com/auth/script.storage',
   'https://www.googleapis.com/auth/userinfo.email'
  ])
 });
}
export function validateProbeReceipt(value){
 assert(value&&typeof value==='object'&&!Array.isArray(value),'RESULT_TYPE');
 assert(Object.keys(value).sort().join('|')===EXPECTED_KEYS.slice().sort().join('|'),'RESULT_FIELDS');
 assert(value.stage==='DCAP_V2_AUTHENTICATED_BRIDGE_READ_ONLY'&&value.state==='PASS'&&
  value.fictionalOnly===true,'RESULT_STATE');
 assert(value.memberRows===1&&value.eventRows===1&&value.ruleRows===0&&
  value.awardRows===1&&value.fictionalAwardPoints===4,'RESULT_FIXTURE');
 assert(value.spreadsheetWrites===0&&value.realRegistryWrites===0&&
  value.historicalJournalWrites===0&&value.rewardsEnabled===false,'RESULT_SAFETY');
 return Object.freeze({state:'PASSED_READ_ONLY_PROBE',
  fictionalOnly:true,recordCounts:[1,1,0,1],fictionalPoints:4,writes:0});
}
export function interpretScriptsRunResponse(data){
 assert(data&&typeof data==='object'&&!Array.isArray(data),'RESPONSE');
 assert(!data.error,'REMOTE_ERROR');
 assert(data.done===true,'NOT_COMPLETE');
 assert(data.response&&typeof data.response==='object'&&
  data.response['@type']==='type.googleapis.com/google.apps.script.v1.ExecutionResponse','REMOTE_TYPE');
 return validateProbeReceipt(data.response.result);
}
/** Explicitly injected mock transport; never uses fetch or credentials here. */
export async function executeDryProbe({scriptId,mode,transport}){
 assert(typeof transport==='function','TRANSPORT');
 const request=buildReadOnlyProbeRequest({scriptId,mode});
 const result=await transport(request);
 return interpretScriptsRunResponse(result);
}
