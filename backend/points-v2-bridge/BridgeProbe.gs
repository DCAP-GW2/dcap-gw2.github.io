/**
 * DCAP v2 authenticated bridge FEASIBILITY probe.
 * Deploy, if separately approved, in a NEW standalone read-only Apps Script
 * project with ONLY this file and its read-only manifest.
 * This project contains no owner writer, no doPost and no mutating services.
 * All private configuration must be supplied through Script Properties.
 */
const BRIDGE_EXPECTED_TITLE_='DCAP v2 — Native Writer Acceptance — Disposable Fictional — 2026-11-20';
const BRIDGE_HEADERS_=Object.freeze({
 members:['memberId','displayName','approvedFrom','status','ownerDecisionRef'],
 events:['eventId','eventLabel','status','ownerDecisionRef'],
 rules:['ruleVersionId','ruleId','eventId','roleId','points','effectiveFrom','status','ownerDecisionRef'],
 awards:['candidateKey','eventDate','eventId','instanceId','memberId','roleId','ruleId','points','awardType','ownerDecisionRef','status','ruleVersionId','approvedAt']
});
const BRIDGE_RANGES_=Object.freeze({
 members:"'N5 Public Members'!A1:E5",
 events:"'N5 Events'!A1:D5",
 rules:"'N5 Rule Versions'!A1:H5",
 awards:"'N5 Owner Awards'!A1:M5"
});
function bridgeCheck_(condition,code){if(!condition)throw Error('BRIDGE_PROBE_'+code)}
function bridgeReadSafe_(){
 const props=PropertiesService.getScriptProperties();
 bridgeCheck_(props.getProperty('DCAP_BRIDGE_MODE')==='FICTIONAL_READ_ONLY','MODE');
 const spreadsheetId=props.getProperty('DCAP_BRIDGE_DISPOSABLE_ID');
 const ownerEmail=props.getProperty('DCAP_BRIDGE_OWNER_EMAIL');
 bridgeCheck_(typeof spreadsheetId==='string'&&/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId),'ID');
 bridgeCheck_(typeof ownerEmail==='string'&&ownerEmail.length>0,'OWNER_CONFIG');
 const effective=Session.getEffectiveUser().getEmail();
 bridgeCheck_(typeof effective==='string'&&effective.toLowerCase()===ownerEmail.toLowerCase(),'OWNER');
 const metadata=Sheets.Spreadsheets.get(spreadsheetId,{fields:'properties(title)'});
 bridgeCheck_(metadata.properties&&metadata.properties.title===BRIDGE_EXPECTED_TITLE_,'TARGET');
 const rows={};
 for(const [key,range] of Object.entries(BRIDGE_RANGES_)){
  const values=Sheets.Spreadsheets.Values.get(spreadsheetId,range,
   {valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
  bridgeCheck_(values.length>0&&JSON.stringify(values[0])===JSON.stringify(BRIDGE_HEADERS_[key]),'HEADERS');
  rows[key]=values.slice(1);
 }
 bridgeCheck_(rows.members.length===1&&rows.events.length===1&&
  rows.rules.length===0&&rows.awards.length===1,'FIXTURE');
 const member=rows.members[0],event=rows.events[0],award=rows.awards[0];
 bridgeCheck_(member[0]==='m-000000000000cafe'&&
  member[3]==='OWNER_FINAL'&&event[0]==='ley-line-anomaly'&&
  event[2]==='OWNER_FINAL'&&award[4]===member[0]&&
  award[2]===event[0]&&award[7]===4&&award[8]==='OWNER_MANUAL_OTHER_COMMANDER'&&
  award[10]==='OWNER_FINAL','DATA');
 return Object.freeze({
  stage:'DCAP_V2_AUTHENTICATED_BRIDGE_READ_ONLY',
  state:'PASS',
  fictionalOnly:true,
  memberRows:1,eventRows:1,ruleRows:0,awardRows:1,
  fictionalAwardPoints:4,
  spreadsheetWrites:0,
  realRegistryWrites:0,
  historicalJournalWrites:0,
  rewardsEnabled:false
 });
}
/**
 * Sole externally callable function for the separately-deployed API executable.
 * The trailing-underscore helpers remain internal; never attach the owner writer.
 */
function probeBridgeReadOnly(){
 return bridgeReadSafe_();
}
