import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONTRACT,HISTORICAL_REVISION,HISTORICAL_SHA256} from '../points/v2/config.mjs';
import {OWNER_FEED_KIND,validateOwnerFeed,combineOwnerFeed} from '../points/v2/owner-feed.mjs';

const baseline=JSON.parse(readFileSync(new URL('../points/data/v2/releases/r000.json',import.meta.url)));
const effectiveFrom='2026-11-04';
const versions=[
 {id:'rv21-bfla-squad-4-20261104',ruleId:'V21-01',eventId:'bfla',roleId:'squad-4',points:1,effectiveFrom},
 {id:'rv21-all-map-spammer-20261104',ruleId:'V21-02',eventId:'all-events',roleId:'map-spammer',points:2,effectiveFrom},
 {id:'rv21-tt-map-spammer-20261104',ruleId:'V2-02',eventId:'triple-trouble',roleId:'map-spammer',points:4,effectiveFrom},
 {id:'rv21-gyala-map-spammer-20261104',ruleId:'V2-15',eventId:'gyala-delve',roleId:'map-spammer',points:2,effectiveFrom}
];
const awards=(date,entries)=>entries.map((e,i)=>({
 id:'a-c-'+String(i+1).padStart(24,'0'),memberId:baseline.members[0].id,
 eventDate:date,cycleId:0,provenanceType:'APPROVED_RULE',...e
}));
function feed(date,entries){
 return {schemaVersion:2,contractVersion:CONTRACT,kind:OWNER_FEED_KIND,
  baselineRevision:HISTORICAL_REVISION,baselineSha256:HISTORICAL_SHA256,
  source:{startDate:'2026-10-22',throughDate:date,evidenceType:'OWNER_ATTESTED_DATE_ONLY'},
  season:baseline.season,rewardsEnabled:false,members:[],events:[],ruleVersions:versions,
  awards:awards(date,entries)};
}
test('v2.1 applies on 4 Nov to both specific overrides and general roles',()=>{
 const entries=[
  {eventId:'bfla',roleId:'squad-4',ruleId:'V21-01',points:1},
  {eventId:'dragonstorm',roleId:'map-spammer',ruleId:'V21-02',points:2},
  {eventId:'triple-trouble',roleId:'map-spammer',ruleId:'V2-02',points:4},
  {eventId:'gyala-delve',roleId:'map-spammer',ruleId:'V2-15',points:2}
 ];
 const doc=feed(effectiveFrom,entries);
 assert.equal(validateOwnerFeed(doc,baseline).points,9);
 const merged=combineOwnerFeed(baseline,doc);
 assert.equal(merged.awards.length,baseline.awards.length+4);
 assert.deepEqual(merged.awards.slice(0,baseline.awards.length),baseline.awards);
 for(const [id,points] of [['V21-01',1],['V21-02',2],['V2-02',4],['V2-15',2]]){
  const rule=merged.rules.find(r=>r.id===id);
  assert.equal(rule.points,points);
  assert.equal(rule.effectiveFrom,effectiveFrom);
 }
 assert.equal(merged.rules.find(r=>r.id==='V21-01').roleLabel,'Squad 4');
 assert.equal(merged.rules.find(r=>r.id==='V21-02').roleLabel,'Map Spammer');
});
test('old v2.0 entries on 3 Nov stay at previous award amounts',()=>{
 const doc=feed('2026-11-03',[
  {eventId:'triple-trouble',roleId:'map-spammer',ruleId:'V2-02',points:5},
  {eventId:'gyala-delve',roleId:'map-spammer',ruleId:'V2-15',points:5}
 ]);
 assert.equal(validateOwnerFeed(doc,baseline).points,10);
});
test('TT special case cannot accidentally receive generic two-point Map Spammer rule',()=>{
 const doc=feed(effectiveFrom,[
  {eventId:'triple-trouble',roleId:'map-spammer',ruleId:'V21-02',points:2}
 ]);
 assert.throws(()=>validateOwnerFeed(doc,baseline),/V21_MAP_SPAMMER_OVERRIDE/);
});
test('Gyala Delve uses two points rather than its old five after cutover',()=>{
 const doc=feed(effectiveFrom,[
  {eventId:'gyala-delve',roleId:'map-spammer',ruleId:'V2-15',points:5}
 ]);
 assert.throws(()=>validateOwnerFeed(doc,baseline),/AWARD_POINTS_DATE/);
});
