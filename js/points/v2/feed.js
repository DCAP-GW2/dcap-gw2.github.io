/* Stage 2C: pure private preview projection; no network, writes or web handler. */
import { DCAP_V2 } from './engine.js';
export const DCAP_FEED_V2 = (function () {
  'use strict';
  var E = DCAP_V2;
  function ready(){if(!E && typeof DCAP_V2!=='undefined')E=DCAP_V2;check(E&&typeof E.stable==='function');}
  var VERSION = '2.0.0-dev.1', MAX_BYTES = 2097152, MAX_AWARDS = 10000;
  var EVENTS = [['Triple Trouble','triple-trouble'],['DBS','dbs'],['BFLA','bfla'],
    ['Twisted Marionette','twisted-marionette'],['Dragonstorm','dragonstorm'],
    ["Dragon's Stand",'dragons-stand'],['WvW','wvw'],['Gyala Delve','gyala-delve'],
    ['Guild Missions','guild-missions'],['Aetherblade Assault','aetherblade-assault'],
    ["Dragon's End",'dragons-end'],['CM Convergence','cm-convergence'],
    ['Defense of Amnytas','defense-of-amnytas'],['Secrets of the Weald','secrets-of-the-weald'],
    ['All events','all-events'],['Actual event retained','actual-event-retained']];
  var ROLES = [['Taxi','taxi'],['Map Spammer','map-spammer'],['Blocker','blocker'],
    ['Setup','setup'],['Commander','commander'],['Derv Escort','derv-escort'],
    ['Doordash / Feed','doordash-feed'],['Sub/Lane Lead','sub-lane-lead'],
    ['Student','student'],['Other Commander','other-commander']];
  var PENDING = ['proposed_ineligible','ambiguous','pending_eligibility_and_score',
    'requires_source_evidence','pending_identity','pending_event_instance','pending_evidence',
    'pending_rule','pending_score','pending_duplicate','suppressed_nonstack'];
  function fail(){throw new Error('FEED_V2_INVALID');}
  function check(v){if(!v)fail();}
  function same(a,b){return E.stable(a)===E.stable(b);}
  function compare(a,b){return a<b?-1:a>b?1:0;}
  function num(n){return Number.isSafeInteger(n)&&n>=0;}
  function keys(o,k){check(o && typeof o==='object'&&!Array.isArray(o));check(same(Object.keys(o).sort(),k.split(' ').sort()));}
  function safeText(s,max){return typeof s==='string'&&s.length>0&&s.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(s);}
  function pid(s){return typeof s==='string'&&/^m-[0-9a-f]{16}$/.test(s);}
  function date(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
  function timestamp(s){return typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().replace('.000Z','Z')===s.replace('.000Z','Z');}
  function id(reg,label){var r=reg.find(function(x){return x[0]===label;});check(r);return r[1];}
  function ruleDefs(){ready();return E.rules.map(function(r){return {id:r.id,version:r.version,eventId:id(EVENTS,r.event),roleId:id(ROLES,r.role),eventLabel:r.event,roleLabel:r.role,points:r.points,status:r.points===null?'PENDING':'APPROVED_NUMERIC',nonStackingGroup:['BFLA',"Dragon's End",'CM Convergence'].indexOf(r.event)>=0?r.event:null};});}
  function group(awards,fields){var m=Object.create(null);awards.forEach(function(a){var vals=fields.map(function(k){return a[k];}),k=E.stable(vals);if(!m[k]){m[k]={};fields.forEach(function(f,i){m[k][f]=vals[i];});m[k].candidatePoints=0;m[k].awardCandidateCount=0;}m[k].candidatePoints+=a.points;m[k].awardCandidateCount++;});return Object.keys(m).sort(compare).map(function(k){return m[k];});}
  function rank(members){var positive=members.filter(function(m){return m.awardCandidateCount>0;});members.forEach(function(m){m.partialRank=m.awardCandidateCount?1+positive.filter(function(x){return x.candidatePoints>m.candidatePoints;}).length:null;});return members;}
  function sum(a,k){return a.reduce(function(n,r){return n+r[k];},0);}
  function derive(awards,members){ready();return {members:rank(members.map(function(m){var rs=awards.filter(function(a){return a.memberId===m.id;});return {id:m.id,displayName:m.displayName,candidatePoints:sum(rs,'points'),awardCandidateCount:rs.length,partialRank:null};})),eventTotals:group(awards,['eventId']),roleTotals:group(awards,['roleId']),eventRoleTotals:group(awards,['eventId','roleId']),dailyTotals:group(awards,['eventDate']),cycleTotals:group(awards,['cycleId']),recentAwardIds:awards.slice(0,10).map(function(a){return a.id;})};}
  function awardId(a,sha){return 'a-'+sha(E.stable([a.memberId,a.eventId,a.roleId,a.eventDate,a.cycleId,a.eventInstance])).slice(0,24);}
  function contentHash(p,sha){ready();var x=JSON.parse(JSON.stringify(p));delete x.validation.contentHash;return sha(E.stable(x));}
  function validate(p,sha){try{
    ready();
    check(typeof sha==='function');var encoded=JSON.stringify(p);check(typeof encoded==='string'&&unescape(encodeURIComponent(encoded)).length<=MAX_BYTES);
    keys(p,'schemaVersion contractVersion source migration publication validation population rules members eventTotals roleTotals eventRoleTotals dailyTotals cycleTotals awards recentAwardIds pendingSummary');
    check(p.schemaVersion===2&&p.contractVersion===VERSION);
    keys(p.source,'kind timeZone updatedAt observedAt latestEventDate');check(p.source.kind==='PINNED_HISTORICAL_SNAPSHOT'&&p.source.timeZone==='Pacific/Auckland'&&p.source.updatedAt===null&&timestamp(p.source.observedAt)&&(p.source.latestEventDate===null||date(p.source.latestEventDate)));
    keys(p.migration,'revision activeMigrationRevision engineVersion mappingVersion ruleVersion productionEffectiveDate');check(/^dev-candidate-[a-z0-9-]{1,60}$/.test(p.migration.revision)&&p.migration.activeMigrationRevision===null&&p.migration.engineVersion===E.version&&p.migration.mappingVersion===E.mappingVersion&&p.migration.ruleVersion==='DCAP Points v2.0'&&p.migration.productionEffectiveDate===null);
    keys(p.publication,'status previewOnly complete');check(p.publication.status==='INACTIVE_PRIVATE_DEV'&&p.publication.previewOnly===true&&p.publication.complete===false);
    keys(p.validation,'status identityStatus generatedAt hashAlgorithm contentHash');check(p.validation.status==='VERIFIED_PRIVATE_PREVIEW'&&p.validation.identityStatus==='PRESERVED_PROVISIONAL'&&timestamp(p.validation.generatedAt)&&Date.parse(p.validation.generatedAt)>=Date.parse(p.source.observedAt)&&p.validation.hashAlgorithm==='SHA-256'&&/^[a-f0-9]{64}$/.test(p.validation.contentHash));
    keys(p.population,'sourceCount awardCandidateCount unresolvedCount canonicalMemberCount observedPublicIdCount missingPublicIdCount candidatePoints totalMeaning periodStart periodEnd currentCycleId');
    var pop=p.population;['sourceCount','awardCandidateCount','unresolvedCount','canonicalMemberCount','observedPublicIdCount','missingPublicIdCount','candidatePoints'].forEach(function(k){check(num(pop[k]));});
    check(pop.totalMeaning==='NUMERICAL_AWARD_CANDIDATES_ONLY'&&pop.currentCycleId===null&&pop.sourceCount===pop.awardCandidateCount+pop.unresolvedCount&&pop.canonicalMemberCount===pop.observedPublicIdCount+pop.missingPublicIdCount);
    check((pop.sourceCount===0&&pop.periodStart===null&&pop.periodEnd===null&&p.source.latestEventDate===null)||(pop.sourceCount>0&&date(pop.periodStart)&&date(pop.periodEnd)&&pop.periodStart<=pop.periodEnd&&p.source.latestEventDate===pop.periodEnd));
    check(Array.isArray(p.rules)&&same(p.rules,ruleDefs()));
    ['members','eventTotals','roleTotals','eventRoleTotals','dailyTotals','cycleTotals','awards','recentAwardIds','pendingSummary'].forEach(function(k){check(Array.isArray(p[k])&&p[k].length<=MAX_AWARDS);});
    check(p.members.length===pop.observedPublicIdCount&&p.awards.length===pop.awardCandidateCount);
    var ids=Object.create(null),aw=Object.create(null),tuples=Object.create(null);
    p.members.forEach(function(m){keys(m,'id displayName candidatePoints awardCandidateCount partialRank');check(pid(m.id)&&!ids[m.id]&&safeText(m.displayName,80)&&num(m.candidatePoints)&&num(m.awardCandidateCount)&&(m.partialRank===null||(num(m.partialRank)&&m.partialRank>0)));ids[m.id]=true;});
    check(same(p.members.map(function(m){return m.id;}),Object.keys(ids).sort(compare)));
    p.awards.forEach(function(a){keys(a,'id memberId eventId roleId eventDate eventInstance cycleId ruleId points');check(/^a-[a-f0-9]{24}$/.test(a.id)&&!aw[a.id]&&ids[a.memberId]&&date(a.eventDate)&&a.eventDate>=pop.periodStart&&a.eventDate<=pop.periodEnd&&safeText(a.eventInstance,40)&&num(a.cycleId)&&num(a.points));
      var rule=p.rules.find(function(r){return r.id===a.ruleId;});check(rule&&rule.points!==null&&rule.points===a.points&&rule.roleId===a.roleId&&(rule.eventId===a.eventId||rule.eventId==='all-events')&&EVENTS.some(function(e){return e[1]===a.eventId&&e[1]!=='all-events'&&e[1]!=='actual-event-retained';}));
      check(a.id===awardId(a,sha));var tuple=E.stable([a.memberId,a.eventDate,a.eventId,a.eventInstance,a.roleId]);check(!tuples[tuple]);tuples[tuple]=true;aw[a.id]=a;
    });
    p.awards.forEach(function(a){if(['bfla','dragons-end','cm-convergence'].indexOf(a.eventId)>=0&&a.roleId==='sub-lane-lead')check(!p.awards.some(function(b){return b.memberId===a.memberId&&b.eventDate===a.eventDate&&b.eventId===a.eventId&&b.eventInstance===a.eventInstance&&b.roleId==='commander';}));});
    var ordered=p.awards.slice().sort(function(a,b){return compare(b.eventDate,a.eventDate)||compare(a.id,b.id);});check(same(p.awards,ordered));
    var computed=derive(p.awards,p.members);Object.keys(computed).forEach(function(k){check(same(p[k],computed[k]));});
    check(pop.candidatePoints===sum(p.awards,'points'));
    var statuses=Object.create(null);p.pendingSummary.forEach(function(r){keys(r,'status count');check(PENDING.indexOf(r.status)>=0&&!statuses[r.status]&&num(r.count)&&r.count>0);statuses[r.status]=true;});
    check(same(p.pendingSummary.map(function(x){return x.status;}),Object.keys(statuses).sort(compare))&&sum(p.pendingSummary,'count')===pop.unresolvedCount);
    check(p.validation.contentHash===contentHash(p,sha));return {valid:true};
  }catch(_){return {valid:false,error:'FEED_V2_INVALID'};}}
  return {version:VERSION,validate:validate,contentHash:contentHash,rank:rank,derive:derive,ruleDefs:ruleDefs,maxBytes:MAX_BYTES,maxAwards:MAX_AWARDS};
}());
