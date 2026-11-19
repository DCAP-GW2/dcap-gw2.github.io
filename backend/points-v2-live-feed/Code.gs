/**
 * DCAP v2 — PRIVATE, READ-ONLY Apps Script implementation candidate.
 * Offline source only. DO NOT install/deploy or reuse V4/V9 without separate approval.
 *
 * Script properties (owner-only, not committed):
 *   DCAP_V2_JOURNAL_ID        = owner-private journal spreadsheet ID
 *   DCAP_V2_PUBLIC_IDS_JSON  = JSON array of 37 approved r000 public member IDs
 *
 * Prerequisite: enable Advanced Google Sheets v4 service with READONLY OAuth scope.
 * No write methods, doPost, triggers, logging of private rows or JSONP.
 */
const LIVE_PUBLIC_CONTRACT_='2.0.0-public-candidate.1';
const LIVE_BASELINE_HASH_='2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73';
const LIVE_KIND_='CONTINUING_PUBLIC_AWARDS_FEED';
const LIVE_START_='2026-10-22';
const LIVE_ROWS_MAX_=10000;
const LIVE_JOURNAL_RANGE_="'N5 Real Award Journal'!A1:T10001";
const LIVE_HEADERS_=["seq","entryId","candidateKey","sourceMessageId","sourceReference","eventDate","eventId","instanceId","memberId","roleId","ruleId","v2Points","approvedBy","approvedAt","approvalDigest","ruleVersion","status","prevDigest","rowDigest","processingRevision"];
const LIVE_EVENT_IDS_=Object.freeze(["aetherblade-assault","bfla","cm-convergence","dbs","defense-of-amnytas","dragons-end","dragons-stand","dragonstorm","guild-missions","gyala-delve","mothman","rifts","secrets-of-the-weald","triple-trouble","twisted-marionette","wizard-tower","wvw"]);
const LIVE_RULE_LIST_=Object.freeze([{"id":"V2-01","eventId":"triple-trouble","roleId":"taxi","points":3},{"id":"V2-02","eventId":"triple-trouble","roleId":"map-spammer","points":5},{"id":"V2-03","eventId":"triple-trouble","roleId":"blocker","points":3},{"id":"V2-04","eventId":"triple-trouble","roleId":"setup","points":3},{"id":"V2-05","eventId":"triple-trouble","roleId":"commander","points":3},{"id":"V2-06","eventId":"dbs","roleId":"derv-escort","points":2},{"id":"V2-07","eventId":"dbs","roleId":"doordash-feed","points":2},{"id":"V2-08","eventId":"bfla","roleId":"commander","points":3},{"id":"V2-09","eventId":"bfla","roleId":"sub-lane-lead","points":2},{"id":"V2-10","eventId":"twisted-marionette","roleId":"commander","points":4},{"id":"V2-11","eventId":"dragonstorm","roleId":"commander","points":2},{"id":"V2-12","eventId":"dragons-stand","roleId":"commander","points":3},{"id":"V2-13","eventId":"wvw","roleId":"commander","points":5},{"id":"V2-14","eventId":"gyala-delve","roleId":"commander","points":5},{"id":"V2-15","eventId":"gyala-delve","roleId":"map-spammer","points":5},{"id":"V2-16","eventId":"guild-missions","roleId":"commander","points":5},{"id":"V2-17","eventId":"aetherblade-assault","roleId":"commander","points":2},{"id":"V2-18","eventId":"dragons-end","roleId":"commander","points":5},{"id":"V2-19","eventId":"dragons-end","roleId":"sub-lane-lead","points":3},{"id":"V2-20","eventId":"cm-convergence","roleId":"commander","points":5},{"id":"V2-21","eventId":"cm-convergence","roleId":"sub-lane-lead","points":2},{"id":"V2-22","eventId":"defense-of-amnytas","roleId":"commander","points":4},{"id":"V2-23","eventId":"secrets-of-the-weald","roleId":"commander","points":4},{"id":"V2-24","eventId":"all-events","roleId":"student","points":2},{"id":"N5E-DBS-COMMANDER-2","eventId":"dbs","roleId":"commander","points":2}]);
const LIVE_DBS_AMENDMENT_=Object.freeze({"id":"N5E-DBS-COMMANDER-2","version":"DCAP Points v2.0","eventId":"dbs","roleId":"commander","eventLabel":"DBS","roleLabel":"Commander","points":2,"status":"APPROVED_NUMERIC","nonStackingGroup":null});
function liveAssert_(ok,code){if(!ok)throw Error('PRIVATE_FEED_'+code)}
function liveDay_(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s}
function livePublicIDs_(json){
 const ids=JSON.parse(json||'null');
 liveAssert_(Array.isArray(ids)&&ids.length===37,'PUBLIC_IDS_CONFIG');
 liveAssert_(new Set(ids).size===37&&ids.every(id=>typeof id==='string'&&/^m-[a-f0-9]{16}$/.test(id)),'PUBLIC_ID_FORMAT');
 return new Set(ids);
}
/** Pure conversion and strict validation, callable offline with fictional inputs. */
function buildPublicLiveFeed_(rows,publicIDs){
 liveAssert_(Array.isArray(rows)&&rows.length>=1&&rows.length<=LIVE_ROWS_MAX_+1,'JOURNAL_SIZE');
 liveAssert_(JSON.stringify(rows[0])===JSON.stringify(LIVE_HEADERS_),'JOURNAL_HEADERS');
 const allowedIds=publicIDs instanceof Set?publicIDs:livePublicIDs_(publicIDs);
 const eventSet=new Set(LIVE_EVENT_IDS_);
 const ruleSet=new Map(LIVE_RULE_LIST_.map(rule=>[rule.id,rule]));
 const candidates=new Set(),awards=[];
 let prior='GENESIS',latest=LIVE_START_;
 for(let i=1;i<rows.length;i++){
  const row=rows[i];
  liveAssert_(Array.isArray(row),'ROW_SHAPE');
  // Empty rows within the journal are not permitted: they could conceal a partial write.
  liveAssert_(row.length>=20,'ROW_SHORT');
  const r=Object.fromEntries(LIVE_HEADERS_.map((key,index)=>[key,row[index]]));
  liveAssert_(r.seq===i&&r.status==='REAL_APPROVED','SEQUENCE_STATUS');
  liveAssert_(typeof r.candidateKey==='string'&&/^[0-9a-f]{24}$/.test(r.candidateKey)&&
   !candidates.has(r.candidateKey),'CANDIDATE_ID');
  candidates.add(r.candidateKey);
  liveAssert_(typeof r.memberId==='string'&&allowedIds.has(r.memberId),'IDENTITY_UNAPPROVED');
  liveAssert_(liveDay_(r.eventDate)&&r.eventDate>=LIVE_START_&&eventSet.has(r.eventId),'EVENT_DATE');
  liveAssert_(r.ruleVersion==='DCAP Points v2.0'&&
    typeof r.instanceId==='string'&&r.instanceId.length>0,'RULE_VERSION');
  liveAssert_(r.prevDigest===prior&&/^[a-f0-9]{64}$/.test(String(r.rowDigest||''))&&
   /^[a-f0-9]{64}$/.test(String(r.approvalDigest||'')),'AUDIT_CHAIN_LINK');
  liveAssert_(typeof r.approvedAt==='string'&&Number.isFinite(Date.parse(r.approvedAt))&&
   typeof r.approvedBy==='string'&&r.approvedBy.length>0,'APPROVAL');
  const rule=ruleSet.get(r.ruleId);
  liveAssert_(rule&&rule.roleId===r.roleId&&
   (rule.eventId===r.eventId||rule.eventId==='all-events')&&
   Number.isSafeInteger(r.v2Points)&&r.v2Points>0&&r.v2Points===rule.points,'POINT_MATCH');
  // ONLY these nine fields are projected into the public result.
  awards.push({
   cycleId:0,eventDate:r.eventDate,eventId:r.eventId,
   id:'a-c-'+r.candidateKey,memberId:r.memberId,
   points:r.v2Points,provenanceType:'APPROVED_RULE',
   roleId:r.roleId,ruleId:r.ruleId
  });
  if(r.eventDate>latest)latest=r.eventDate;
  prior=r.rowDigest;
 }
 return {
  schemaVersion:1,contractVersion:LIVE_PUBLIC_CONTRACT_,kind:LIVE_KIND_,
  baselineRevision:'r000',baselineSha256:LIVE_BASELINE_HASH_,
  source:{startDate:LIVE_START_,throughDate:latest,evidenceType:'OWNER_ATTESTED_DATE_ONLY'},
  season:{rawCycleId:0,displayLabel:'Test Run',automaticReset:false},
  rewardsEnabled:false,ruleAmendments:[LIVE_DBS_AMENDMENT_],awards
 };
}
/** Only browser-accessible public projection; errors never return private details. */
function doGet(){
 try{
  const props=PropertiesService.getScriptProperties();
  const sheetId=props.getProperty('DCAP_V2_JOURNAL_ID');
  const allowed=livePublicIDs_(props.getProperty('DCAP_V2_PUBLIC_IDS_JSON'));
  liveAssert_(typeof sheetId==='string'&&/^[A-Za-z0-9_-]{20,}$/.test(sheetId),'JOURNAL_CONFIG');
  const response=Sheets.Spreadsheets.Values.get(sheetId,LIVE_JOURNAL_RANGE_,{valueRenderOption:'UNFORMATTED_VALUE'});
  const payload=buildPublicLiveFeed_(response.values||[],allowed);
  return ContentService.createTextOutput(JSON.stringify(payload))
   .setMimeType(ContentService.MimeType.JSON);
 }catch{
  // Apps Script's ContentService does not offer custom status codes here.
  // This intentionally invalid schema makes browsers reject and use their fallback.
  return ContentService.createTextOutput('{"kind":"UNAVAILABLE"}')
   .setMimeType(ContentService.MimeType.JSON);
 }
}
