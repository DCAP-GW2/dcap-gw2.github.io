/* Exactly one page client is loaded. Inactive v1 does not import v2, and vice versa. */
import {PATHS,releaseRoute} from './config.mjs';
const target=releaseRoute(new URL(location.href));
const v1=Object.freeze({overview:'dashboard.js',leaderboard:'leaderboard.js',members:'members.js',profile:'member-profile.js',statistics:'statistics.js',how:'how-points-work.js',rewards:'rewards.js'});

function showUnavailable(view) {
 const main=document.querySelector('main');
 if(!main)return;
 const container=main.querySelector('.points-content')||main;
 const nav=container.querySelector('.points-nav');
 const outlet=document.createElement('section');
 outlet.className='dcap-v2-production';
 const panel=document.createElement('div');
 panel.className='dcap-v2-error points-panel glass-panel';
 panel.setAttribute('role','status');
 const heading=document.createElement('h2'),message=document.createElement('p');
 heading.textContent='Unable to load DCAP Points';
 message.textContent='Please refresh the page and try again.';
 panel.append(heading,message);
 outlet.append(panel);
 container.replaceChildren(...(nav?[nav]:[]),outlet);
 window.DCAP_V2_STATUS={state:'unavailable',view,rewards:false};
}

if(target.mode==='v1') {
 await import(new URL('../../js/points/'+v1[target.view],import.meta.url).href);
} else if(target.mode==='private-v2' || target.mode==='production-v2') {
 const privatePreview=target.mode==='private-v2';
 try {
  const {mount}=await import('./page.mjs');
  if(!await mount(target.view,{privatePreview}))showUnavailable(target.view);
 }catch{showUnavailable(target.view);}
 // Retain local private preview links, including navigation away from a failure.
 if(privatePreview){
  for(const anchor of document.querySelectorAll('a[href]')){
   if(anchor.getAttribute('href').startsWith('#'))continue;
   const url=new URL(anchor.href);
   if(url.origin===location.origin&&Object.hasOwn(PATHS,url.pathname)){
    url.searchParams.set('dcapV2Review','private');anchor.href=url.href;
   }
  }
 }
 if(typeof closeMenu==='function')document.body.classList.add('points-navigation-ready');
} else if(target.mode==='invalid') {
 const root=document.querySelector('main');
 if(root){const p=document.createElement('p');p.textContent='Invalid local preview selector. No data loaded.';root.prepend(p);}
}
