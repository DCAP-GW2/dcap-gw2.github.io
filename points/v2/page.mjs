/** Production-shaped seven-view client. Never rescoring; only verified public awards. */
import {loadV2} from './live-loader.mjs';
const el=(tag,content='',cls='')=>{const x=document.createElement(tag);if(content!==null)x.textContent=String(content);if(cls)x.className=cls;return x};
const fmt=x=>new Intl.NumberFormat('en-NZ').format(x);
// Only advertise v2.1 once all four owner-approved, effective-dated rules are active.
const ruleVersion=doc=>[
 ['V21-01','bfla','squad-4',1],
 ['V21-02','all-events','map-spammer',2],
 ['V2-02','triple-trouble','map-spammer',4],
 ['V2-15','gyala-delve','map-spammer',2]
].every(([id,eventId,roleId,points])=>doc.rules.some(r=>
 r.id===id&&r.eventId===eventId&&r.roleId===roleId&&r.points===points&&r.effectiveFrom==='2026-11-04'))?'2.1':'2.0';
const url=(path,id,privatePreview)=>{const u=new URL(path,location.origin);if(privatePreview)u.searchParams.set('dcapV2Review','private');if(id)u.searchParams.set('member',id);return u.href};
const link=(name,path,id,privatePreview)=>{const x=el('a',name);x.href=url(path,id,privatePreview);return x};
// Public leaderboard views use approved award cycle IDs; no rescoring or new season data.
function leaderboardRows(doc,viewName){
 const scores=new Map();
 if(viewName==='current'){
  for(const a of doc.awards){
   if(a.cycleId!==doc.season.rawCycleId)continue;
   const x=scores.get(a.memberId)||{points:0,count:0};
   x.points+=a.points;x.count++;scores.set(a.memberId,x);
  }
 }
 const rows=doc.members.map(m=>{
  const current=scores.get(m.id)||{points:0,count:0};
  return {member:m,points:viewName==='current'?current.points:m.candidatePoints,
   count:viewName==='current'?current.count:m.awardCandidateCount};
 }).filter(row=>row.points>0).sort((a,b)=>b.points-a.points||a.member.id.localeCompare(b.member.id));
 for(let i=0;i<rows.length;i++)rows[i].rank=viewName==='all-time'?rows[i].member.partialRank:1+rows.filter(r=>r.points>rows[i].points).length;
 return rows;
}
// Reuse the existing Statistics bar and daily-chart presentation with verified v2 awards.
const statLabel=(name,points,total)=>{const cell=el('span',name),track=el('span',null,'points-stat-bar-track'),fill=el('span',null,'points-stat-bar-fill');track.setAttribute('aria-hidden','true');fill.style.width=(total?points/total*100:0)+'%';track.append(fill);cell.append(track);return cell};
function dailyActivity(root,awards){
 const totals=new Map();for(const a of awards)totals.set(a.eventDate,(totals.get(a.eventDate)||0)+a.points);
 const days=[...totals].sort(([a],[b])=>a.localeCompare(b));if(!days.length)return;
 root.append(el('h2','Daily Points activity'));
 const peak=Math.max(...days.map(([,points])=>points));
 const chart=el('div',null,'points-daily-chart');chart.setAttribute('aria-hidden','true');
 chart.append(el('p',`Scale: 0 – ${fmt(peak)} Points`,'points-daily-scale'));
 const svg=(name,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));return node};
 const plot=svg('svg',{viewBox:'0 0 800 240',focusable:'false'});
 plot.append(svg('path',{d:'M12 12H788 M12 120H788 M12 228H788',class:'points-daily-grid'}));
 const coordinates=days.map(([,points],i)=>[days.length===1?400:12+i/(days.length-1)*776,228-(peak?points/peak:0)*216]);
 plot.append(days.length===1?svg('circle',{cx:400,cy:coordinates[0][1],r:5,class:'points-daily-point'}):svg('polyline',{points:coordinates.map(p=>p.join(',')).join(' '),class:'points-daily-line','vector-effect':'non-scaling-stroke'}));
 const dates=el('div',null,'points-daily-dates');dates.append(el('span',days[0][0]),el('span',days.at(-1)[0]));chart.append(plot,dates);root.append(chart);
 const details=el('details',null,'dcap-v2-daily-totals'),summary=el('summary','Daily Points totals');details.append(summary,table(['Date','Points'],days.map(([date,points])=>[date,fmt(points)])));root.append(details);
}
function table(columns,records){const wrap=el('div',null,'dcap-v2-scroll points-panel glass-panel');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',columns.join(', '));const t=el('table',null,'dcap-v2-table points-table');const thead=el('thead'),hr=el('tr');for(const c of columns){const th=el('th',c);th.scope='col';hr.append(th)}thead.append(hr);t.append(thead);const body=el('tbody');for(const cells of records){const tr=el('tr');for(let i=0;i<cells.length;i++){const td=el(i===0?'th':'td');if(i===0)td.scope='row';const value=cells[i];if(value instanceof Node)td.append(value);else td.textContent=String(value);tr.append(td)}body.append(tr)}t.append(body);wrap.append(t);return wrap}
const intro=(root,title,doc,result)=>{root.append(el('h2',title));if(result.state==='last-available')root.append(el('p',doc.continuing?'Last available validated data — the current feed could not be retrieved.':'Historical snapshot — current contributions are unavailable.','dcap-v2-warning'))};
function view(root,name,doc,result,privatePreview){
 const members=doc.members,awards=doc.awards;
 if(name==='overview'){
  intro(root,'Season overview',doc,result);
  const kpis=el('dl',null,'points-kpi-grid');
  for(const [name,value] of [['Total Points',fmt(doc.population.candidatePoints)],['Contributions',fmt(awards.length)],['Contributors',fmt(members.length)],['Rule Version',ruleVersion(doc)]]){
   const card=el('div',null,'points-kpi-card'+(name==='Total Points'?' points-kpi-card-total':''));card.append(el('dt',name),el('dd',value));kpis.append(card);
  }
  root.append(kpis);
  const dashboard=el('div',null,'points-dashboard-grid'),top=el('section',null,'points-panel glass-panel');
  const heading=el('div',null,'points-panel-heading');heading.append(el('h2','Top contributors'));top.append(heading);
  top.append(table(['Rank','Member','Points'],[...members].sort((a,b)=>b.candidatePoints-a.candidatePoints||a.id.localeCompare(b.id)).slice(0,10).map(m=>[m.partialRank,link(m.displayName,'/points/members/profile/',m.id,privatePreview),fmt(m.candidatePoints)])));
  top.querySelector('.dcap-v2-scroll').classList.remove('points-panel','glass-panel');
  const foot=el('p',null,'points-panel-footnote');foot.append(link('View the full leaderboard →','/points/leaderboard/',null,privatePreview));top.append(foot);dashboard.append(top);
  const statistics=document.querySelector('.points-dashboard-grid [aria-labelledby="activity-title"]');
  if(statistics){
   const card=statistics.cloneNode(true);
   const description=card.querySelector('.points-empty-state > p');
   if(description)description.textContent='Explore event totals and daily Points activity.';
   dashboard.append(card);
  }
  root.append(dashboard);
 }else if(name==='leaderboard'){
  intro(root,'Leaderboard',doc,result);
  const switcher=el('div',null,'points-view-switcher dcap-v2-leaderboard-switcher');
  switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Leaderboard view');
  const results=el('div');results.id='dcap-v2-leaderboard-results';
  const buttons={};
  for(const [key,label] of [['current','Current Season'],['all-time','All Time']]){
   const b=el('button',label);b.type='button';b.setAttribute('aria-controls',results.id);
   switcher.append(b);buttons[key]=b;
  }
  root.append(switcher,results);
  let active='current';
  const render=()=>{
   const rows=leaderboardRows(doc,active);
   for(const [key,b] of Object.entries(buttons))b.setAttribute('aria-pressed',String(key===active));
   const note=el('p',active==='current'?doc.season.displayLabel+' — Current Season':'All-Time leaderboard','dcap-v2-leaderboard-label');
   const content=rows.length?
    table(['Rank','Member','Points','Contributions'],rows.map(r=>[r.rank,link(r.member.displayName,'/points/members/profile/',r.member.id,privatePreview),fmt(r.points),fmt(r.count)])):
    el('p','No contributions have been recorded for this view.');
   results.replaceChildren(note,content);
  };
  for(const [key,b] of Object.entries(buttons))b.addEventListener('click',()=>{active=key;render()});
  render();
 }else if(name==='members'){
  intro(root,'Member directory',doc,result);const input=el('input');input.type='search';input.placeholder='Search member names';input.setAttribute('aria-label','Search member names');const search=el('div',null,'points-member-search');search.append(input);root.append(search);const holder=el('div');root.append(holder);
  const render=()=>{const q=input.value.toLocaleLowerCase();holder.replaceChildren(table(['Member','Points','Contributions'],members.filter(m=>m.displayName.toLocaleLowerCase().includes(q)).sort((a,b)=>a.displayName.localeCompare(b.displayName)).map(m=>[link(m.displayName,'/points/members/profile/',m.id,privatePreview),fmt(m.candidatePoints),fmt(m.awardCandidateCount)])))};input.addEventListener('input',render);render();
 }else if(name==='profile'){
  const selected=new URL(location.href).searchParams.getAll('member');const member=selected.length===1?members.find(m=>m.id===selected[0]):null;
  if(!member){root.append(el('h1','Profile unavailable'),el('p','No verified public profile exists for this ID.'));return}
  intro(root,member.displayName,doc,result);root.append(el('p',`${fmt(member.candidatePoints)} points from ${fmt(member.awardCandidateCount)} ${member.awardCandidateCount === 1 ? "contribution" : "contributions"}.`));
  const personal=awards.filter(a=>a.memberId===member.id).sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id));
  const area=el('div');root.append(area);const btn=el('button','Show more','button button-secondary');btn.type='button';btn.setAttribute('aria-expanded','false');const id='dcap-v2-profile-history';area.id=id;btn.setAttribute('aria-controls',id);root.append(btn);
  let expanded=false;const render=()=>{area.replaceChildren(table(['Date','Event','Role','Points'],personal.slice(0,expanded?personal.length:5).map(a=>[a.eventDate,doc.events.find(e=>e.id===a.eventId)?.label||a.eventId,a.provenanceType==='OWNER_MANUAL_OTHER_COMMANDER'?'Other Commander':(doc.rules.find(r=>r.id===a.ruleId)?.roleLabel||a.roleId),fmt(a.points)])));btn.hidden=personal.length<=5;btn.textContent=expanded?'Show fewer':'Show more';btn.setAttribute('aria-expanded',String(expanded))};btn.addEventListener('click',()=>{expanded=!expanded;render()});render();
 }else if(name==='statistics'){
  intro(root,doc.continuing?'Statistics':'Historical statistics',doc,result);root.append(el('h2','By event'));root.append(table(['Event','Points','Contributions'],doc.aggregates.eventTotals.map(a=>[statLabel(doc.events.find(e=>e.id===a.eventId)?.label||a.eventId,a.candidatePoints,doc.population.candidatePoints),fmt(a.candidatePoints),a.awardCandidateCount])));
  dailyActivity(root,awards);
  root.append(el('h2',doc.continuing?'Recent contributions':'Recent historical contributions'));root.append(table(['Date','Event','Member','Points'],[...awards].sort((a,b)=>b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id)).slice(0,10).map(a=>[a.eventDate,doc.events.find(e=>e.id===a.eventId)?.label||a.eventId,doc.members.find(m=>m.id===a.memberId)?.displayName||'Withheld',a.points])));
 }else if(name==='how'){
  intro(root,'DCAP Points Rules',doc,result);
  // Display-only DBS summary; keep the three approved roles and award records intact.
  const rows=doc.rules.filter(r=>r.eventId!=='dbs').map(r=>[
   r.eventId==='actual-event-retained'?'Other Events':r.eventId==='all-events'?'All Events':r.eventLabel,
   r.roleId==='other-commander'?'Commander':r.roleLabel,
   r.points===null?'TBD':fmt(r.points)
  ]);
  const dbsRules=doc.rules.filter(r=>r.eventId==='dbs');
  if(dbsRules.length){
   const commander=dbsRules.find(r=>r.roleId==='commander')||dbsRules[0];
   rows.push(['DBS','Commander',commander.points===null?'TBD':fmt(commander.points)]);
  }
  // General rules follow the alphabetised event-specific rows.
  const group=event=>event==='All Events'?1:event==='Other Events'?2:0;
  rows.sort((a,b)=>group(a[0])-group(b[0])||a[0].localeCompare(b[0],'en-NZ')||a[1].localeCompare(b[1],'en-NZ'));
  root.append(table(['Event','Role','Points'],rows));
  root.append(el('p','For Other Events, Commander points are assigned case by case.'));
 }else if(name==='rewards'){
  intro(root,'Rewards',doc,result);const card=el('div',null,'points-rewards-status-card glass-panel');card.append(el('p','Coming Soon'));root.append(card);
 }
}
export async function mount(viewName,{privatePreview=false}={}) {
 const original=document.querySelector('main');if(!original)return false;
 // Only verified public data may replace the page's loading state.
  const result=await loadV2();if(!result.data)return false;
  const outlet=el('section',null,'dcap-v2-production');
  outlet.setAttribute('aria-label','DCAP v'+ruleVersion(result.data)+' verified published data');
  view(outlet,viewName,result.data,result,privatePreview);
  // Keep the original v1 hero and Points navigation; change only the verified data area.
  const container=original.querySelector('.points-content');
  const nav=container?.querySelector('.points-nav');
  if(!container||!nav)return false;
  // Hydrate the existing hero after successful validation (never show stale v1 figures).
  const hero=original.querySelector('.points-hero');
  if(hero){
   const season=hero.querySelector('[data-points-season]');
   if(season)season.textContent=result.data.season.displayLabel;
   const period=hero.querySelector('[data-points-period]');
   if(period){
    const latest=result.data.continuing?.throughDate||result.data.awards.reduce((max,a)=>a.eventDate>max?a.eventDate:max,'');
    period.textContent='Latest contributions: '+(latest||'Not available');
   }
   const rule=hero.querySelector('[data-points-rule-version], [data-points-rule-reference]');
   if(rule)rule.textContent=ruleVersion(result.data);
   const meta=hero.querySelector('[data-leaderboard-meta], [data-rules-meta], [data-rewards-meta], .points-season-meta');
   if(meta)meta.hidden=false;
  }
  container.replaceChildren(nav,outlet);
  const ruleLink=hero?.querySelector('a[href="#points-rule"]');
  if(ruleLink)ruleLink.href=url('/points/how-points-work/',null,privatePreview);
  window.DCAP_V2_STATUS={state:result.state,view:viewName,revision:result.revision,source:result.source,rewards:false};
  return true;
}
