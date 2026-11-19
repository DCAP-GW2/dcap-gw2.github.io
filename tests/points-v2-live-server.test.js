import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validateLiveFeed,combineLiveFeed} from '../points/v2/live-feed.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const baseline=JSON.parse(read('points/data/v2/releases/r000.json'));
const source=JSON.parse(read('points/data/v2/releases/r001.json'));
const ids=baseline.members.map(m=>m.id);
const code=read('backend/points-v2-live-feed/Code.gs');
const headers=['seq','entryId','candidateKey','sourceMessageId','sourceReference','eventDate','eventId',
 'instanceId','memberId','roleId','ruleId','v2Points','approvedBy','approvedAt','approvalDigest',
 'ruleVersion','status','prevDigest','rowDigest','processingRevision'];

function rows(count=60){
 const out=[headers];
 for(let n=1;n<=count;n++){
  const award=source.awards[(n-1)%source.awards.length];
  const key=n<=60?award.id.slice(4):(1000000+n).toString(16).padStart(24,'0');
  const digest=n.toString(16).padStart(64,'0');
  const prev=n===1?'GENESIS':(n-1).toString(16).padStart(64,'0');
  out.push([n,'private-'+n,key,null,'DO_NOT_PUBLICISE_PRIVATE_SOURCE',n<=60?award.eventDate:'2026-10-27',
    award.eventId,'private-instance-'+n,award.memberId,award.roleId,award.ruleId,
    award.points,'OWNER_EMAIL_PRIVATE','2026-11-19T00:00:00.000Z','a'.repeat(64),
    'DCAP Points v2.0','REAL_APPROVED',prev,digest,'PRIVATE_AUDIT_STATE']);
 }
 return out;
}
function execute(input,props=null) {
 const context={
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>{
   if(name==='DCAP_V2_JOURNAL_ID')return props?.sheetId??'a'.repeat(30);
   if(name==='DCAP_V2_PUBLIC_IDS_JSON')return props?.members??JSON.stringify(ids);
   return null;
  }})},
  Sheets:{Spreadsheets:{Values:{get:(_id,_range,opts)=>{assert.equal(opts.valueRenderOption,'UNFORMATTED_VALUE');return {values:input};}}}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({text:s,mime:null,setMimeType(t){this.mime=t;return this;}})}
 };
 vm.createContext(context);vm.runInContext(code,context);
 return context;
}
test('Apps Script source uses read-only Advanced Sheets with no writer or trigger',()=>{
 assert(!/SpreadsheetApp\.|setValues\(|appendRow\(|setValue\(|doPost\s*\(|ScriptApp\.|createTrigger\(/.test(code));
 assert(code.includes('Sheets.Spreadsheets.Values.get('));
 const manifest=JSON.parse(read('backend/points-v2-live-feed/appsscript.json'));
 assert(manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly'));
 assert(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
});
test('60 approved fictional journal entries project to exact public data',()=>{
 const ctx=execute(rows());
 const publicFeed=JSON.parse(JSON.stringify(ctx.buildPublicLiveFeed_(rows(),JSON.stringify(ids))));
 const result=validateLiveFeed(publicFeed,baseline);
 assert.equal(result.awards,60);assert.equal(result.points,192);
 assert.equal(combineLiveFeed(baseline,publicFeed).population.candidatePoints,1886);
 assert.equal(combineLiveFeed(baseline,publicFeed).population.awardCandidateCount,611);
 assert.equal(publicFeed.revision,undefined);
 assert(!JSON.stringify(publicFeed).includes('OWNER_EMAIL_PRIVATE'));
 assert(!JSON.stringify(publicFeed).includes('DO_NOT_PUBLICISE_PRIVATE_SOURCE'));
 assert(!JSON.stringify(publicFeed).includes('private-instance'));
 assert.deepEqual(publicFeed.awards.map(a=>a.id).sort(),source.awards.map(a=>a.id).sort());
});
test('owner-only doGet projects public JSON and does not publish configuration',()=>{
 const ctx=execute(rows());
 const response=ctx.doGet(),feed=JSON.parse(response.text);
 assert.equal(response.mime,'application/json');
 assert.equal(feed.awards.length,60);
 assert.equal(feed.rewardsEnabled,false);
 assert.equal(feed.season.displayLabel,'Test Run');
 assert(!JSON.stringify(feed).includes('PRIVATE_AUDIT_STATE'));
 assert(!JSON.stringify(feed).includes('OWNER_EMAIL_PRIVATE'));
 assert(!JSON.stringify(feed).includes('a'.repeat(30)));
});
test('new approved entries beyond 60 are returned without publishing r002',()=>{
 const ctx=execute(rows(125));
 const feed=JSON.parse(JSON.stringify(ctx.buildPublicLiveFeed_(rows(125),JSON.stringify(ids))));
 assert.equal(feed.awards.length,125);
 assert.equal(feed.source.throughDate,'2026-10-27');
 const result=validateLiveFeed(feed,baseline);
 assert(result.points>192);
 assert.equal(feed.revision,undefined);
});
test('invalid, unapproved, malformed or private identity rows fail closed',()=>{
 const cases=[
  arr=>{arr[1][16]='PENDING'},
  arr=>{arr[1][8]='m-unapproved'},
  arr=>{arr[2][2]=arr[1][2]},
  arr=>{arr[3][17]='INVALID_PREV'},
  arr=>{arr[1][11]=1234},
  arr=>{arr[1][5]='2026-02-30'},
  arr=>{arr[1][10]='V2-25'},
  arr=>{arr[1][0]=5},
  arr=>{arr.push([])}
 ];
 for(const mutate of cases){
  const data=rows();mutate(data);
  const ctx=execute(data);
  assert.throws(()=>ctx.buildPublicLiveFeed_(data,JSON.stringify(ids)),/PRIVATE_FEED_/);
  const response=ctx.doGet();
  assert.equal(response.text,'{"kind":"UNAVAILABLE"}','No source details may leak on errors');
 }
});
test('missing owner approval or public identity allowlist returns generic unavailable',()=>{
 for(const members of ['[]','not JSON']){
  const ctx=execute(rows(),{members});
  assert.equal(ctx.doGet().text,'{"kind":"UNAVAILABLE"}');
 }
 const ctx=execute(rows(),{sheetId:'invalid'});
 assert.equal(ctx.doGet().text,'{"kind":"UNAVAILABLE"}');
});
