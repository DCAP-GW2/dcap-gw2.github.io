/** Production-shaped seven-view client. Never rescoring; only verified public awards. */
import {loadV2} from './live-loader.mjs';
import {PATHS} from './config.mjs';
const el=(tag,content='',cls='')=>{const x=document.createElement(tag);if(content!==null)x.textContent=String(content);if(cls)x.className=cls;return x};
const fmt=x=>new Intl.NumberFormat('en-NZ').format(x);
const label=(doc)=>doc.continuing?`Approved contributions through ${doc.continuing.throughDate} (NZ date). Cycle 0: ${doc.season.displayLabel}. Refreshed when the page is opened, not pushed live.`:`Historical snapshot — data through ${new Date(doc.source.asOf).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium',timeStyle:'short'})} (Auckland). Cycle 0: ${doc.season.displayLabel}. Not live data.`;
const paths=[['Overview','/points/'],['Leaderboard','/points/leaderboard/'],['Members','/points/members/'],['Statistics','/points/statistics/'],['How Points Work','/points/how-points-work/'],['Rewards','/points/rewards/']];
const url=(path,id,privatePreview)=>{const u=new URL(path,location.origin);if(privatePreview)u.searchParams.set('dcapV2Review','private');if(id)u.searchParams.set('member',id);return u.href};
const link=(name,path,id,privatePreview)=>{const x=el('a',name);x.href=url(path,id,privatePreview);return x};
function table(columns,records){const wrap=el('div',null,'dcap-v2-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',columns.join(', '));const t=el('table',null,'dcap-v2-table');const thead=el('thead'),hr=el('tr');for(const c of columns){const th=el('th',c);th.scope='col';hr.append(th)}thead.append(hr);t.append(thead);const body=el('tbody');for(const cells of records){const tr=el('tr');for(let i=0;i<cells.length;i++){const td=el(i===0?'th':'td');if(i===0)td.scope='row';const value=cells[i];if(value instanceof Node)td.append(value);else td.textContent=String(value);tr.append(td)}body.append(tr)}t.append(body);wrap.append(t);return wrap}
const intro=(root,title,doc,result)=>{root.append(el('h1',title));root.append(el('p',label(doc),'dcap-v2-asof'));if(result.state==='last-available')root.append(el('p','Last available validated data — the current feed could not be retrieved.','dcap-v2-warning'));root.append(el('p',`Data source: ${doc.continuing?'Approved public points feed':'Historical backup'} · Rewards: DISABLED`,'dcap-v2-detail'))};
function view(root,name,doc,result,privatePreview){
 const members=doc.members,awards=doc.awards;
 if(name==='overview'){
  intro(root,'Points overview — v2.0',doc,result);root.append(el('p',`${fmt(doc.population.candidatePoints)} v2 points · ${fmt(awards.length)} approved awards · ${fmt(members.length)} public profiles`));
  root.append(el('p',`${fmt(doc.population.originalPoints)} original v1 historical points preserved; ${fmt(doc.population.confirmedIneligibleCount)} historical ineligible contributions excluded; ${fmt(doc.population.missingPublicIdCount)} missing public identity states retained.`));
  root.append(el('h2','Top contributors'));
  root.append(table(['Member','Points'],[...members].sort((a,b)=>b.candidatePoints-a.candidatePoints||a.id.localeCompare(b.id)).slice(0,10).map(m=>[link(m.displayName,'/points/members/profile/',m.id,privatePreview),fmt(m.candidatePoints)])));
 }else if(name==='leaderboard'){
  intro(root,doc.continuing?'Leaderboard':'Historical leaderboard',doc,result);root.append(el('p','Ranks are partial where public identities are missing. No unverified member routes are generated.'));
  root.append(table(['Partial rank','Member','Points','Awards'],[...members].sort((a,b)=>b.candidatePoints-a.candidatePoints||a.id.localeCompare(b.id)).map(m=>[m.partialRank,link(m.displayName,'/points/members/profile/',m.id,privatePreview),fmt(m.candidatePoints),fmt(m.awardCandidateCount)])));
 }else if(name==='members'){
  intro(root,'Member directory',doc,result);const input=el('input');input.type='search';input.placeholder='Search published member names';input.setAttribute('aria-label','Search published member names');root.append(input);const holder=el('div');root.append(holder);
  const render=()=>{const q=input.value.toLocaleLowerCase();holder.replaceChildren(table(['Member','Points','Awards'],members.filter(m=>m.displayName.toLocaleLowerCase().includes(q)).sort((a,b)=>a.displayName.localeCompare(b.displayName)).map(m=>[link(m.displayName,'/points/members/profile/',m.id,privatePreview),fmt(m.candidatePoints),fmt(m.awardCandidateCount)])))};input.addEventListener('input',render);render();
 }else if(name==='profile'){
  const selected=new URL(location.href).searchParams.getAll('member');const member=selected.length===1?members.find(m=>m.id===selected[0]):null;
  if(!member){root.append(el('h1','Profile unavailable'),el('p','No verified public profile exists for this ID.'));return}
  intro(root,member.displayName,doc,result);root.append(el('p',`${fmt(member.candidatePoints)} points from ${fmt(member.awardCandidateCount)} awards.`));
  const personal=awards.filter(a=>a.memberId===member.id).sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id));
  const area=el('div');root.append(area);const btn=el('button','Show more');btn.type='button';btn.setAttribute('aria-expanded','false');const id='dcap-v2-profile-history';area.id=id;btn.setAttribute('aria-controls',id);root.append(btn);
  let expanded=false;const render=()=>{area.replaceChildren(table(['Date','Event','Role','Points','Provenance'],personal.slice(0,expanded?10:5).map(a=>[a.eventDate,doc.events.find(e=>e.id===a.eventId)?.label||a.eventId,doc.rules.find(r=>r.id===a.ruleId)?.roleLabel||a.roleId,fmt(a.points),a.provenanceType==='APPROVED_RULE'?'Approved rule':'Ratified historical exception'])));btn.hidden=personal.length<=5;btn.textContent=expanded?'Show fewer':'Show more';btn.setAttribute('aria-expanded',String(expanded))};btn.addEventListener('click',()=>{expanded=!expanded;render()});render();
 }else if(name==='statistics'){
  intro(root,doc.continuing?'Statistics':'Historical statistics',doc,result);root.append(el('h2','By event'));root.append(table(['Event','Points','Awards'],doc.aggregates.eventTotals.map(a=>[doc.events.find(e=>e.id===a.eventId)?.label||a.eventId,fmt(a.candidatePoints),a.awardCandidateCount])));
  root.append(el('h2','By role'));root.append(table(['Role','Points','Awards'],doc.aggregates.roleTotals.map(a=>[doc.rules.find(r=>r.roleId===a.roleId)?.roleLabel||a.roleId,fmt(a.candidatePoints),a.awardCandidateCount])));
  root.append(el('h2',doc.continuing?'Recent awards':'Recent historical awards'));root.append(table(['Date','Event','Member','Points'],[...awards].sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id)).slice(0,10).map(a=>[a.eventDate,doc.events.find(e=>e.id===a.eventId)?.label||a.eventId,doc.members.find(m=>m.id===a.memberId)?.displayName||'Withheld',a.points])));
 }else if(name==='how'){
  intro(root,'Committee-approved v2.0 rules',doc,result);
  root.append(table(['Event','Role','Points'],doc.rules.map(r=>[r.eventLabel,r.roleLabel,r.points===null?'TBD':fmt(r.points)])));
  root.append(el('p','General Other Commander scoring remains TBD. Individual ratified historical exceptions do not define a general score.'));
 }else if(name==='rewards'){
  intro(root,'Rewards',doc,result);root.append(el('p','Rewards are disabled. Points do not establish a reward entitlement.'));
 }
}
export async function mount(viewName,{privatePreview=false}={}) {
 const original=document.querySelector('main');if(!original)return false;
 // No DOM mutation until the immutable approved snapshot is verified.
 try{
  const result=await loadV2();if(!result.data)return false;
  const outlet=el('section',null,'dcap-v2-production');outlet.setAttribute('aria-label','DCAP v2.0 verified published data');
  view(outlet,viewName,result.data,result,privatePreview);
  original.replaceChildren(outlet);
  window.DCAP_V2_STATUS={state:result.state,view:viewName,revision:result.revision,source:result.source,rewards:false};
  return true;
 }catch{return false;}
}
