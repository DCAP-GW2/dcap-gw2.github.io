/* Exactly one page client is loaded. Inactive v1 does not import v2, and vice versa. */
import {releaseRoute} from './config.mjs';
const target=releaseRoute(new URL(location.href));
const v1=Object.freeze({overview:'dashboard.js',leaderboard:'leaderboard.js',members:'members.js',profile:'member-profile.js',statistics:'statistics.js',how:'how-points-work.js',rewards:'rewards.js'});
if(target.mode==='v1') {
 await import(new URL('../../js/points/'+v1[target.view],import.meta.url).href);
} else if(target.mode==='private-v2' || target.mode==='production-v2') {
 const {mount} = await import('./page.mjs');
 await mount(target.view,{privatePreview:target.mode==='private-v2'});
} else if(target.mode==='invalid') {
 const root=document.querySelector('main');
 if(root){const p=document.createElement('p');p.textContent='Invalid local preview selector. No data loaded.';root.prepend(p);}
}
