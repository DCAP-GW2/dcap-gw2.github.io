/** Public production release switch is deliberately OFF until exact owner approval. */
export const PUBLIC_V2_ENABLED = true;
export const EXPECTED_PUBLIC_HOST = 'dcap-gw2.github.io';
export const CONTRACT = '2.0.0-public-candidate.1';
export const HISTORICAL_ONLY = true;
export const HISTORICAL_REVISION = 'r000';
export const HISTORICAL_SHA256 = '2059ca41cdfda3577de6a77f8ecc5fe6ad25cd715777ac71c81da70a7f162c73';
export const HISTORICAL_SELECTION_SHA256 = '78e78eface2bd7d694dfc7a49cfe91f50c98425ddf3b0a9ca3749bc77591fff4';
export const HISTORICAL_PATH = '/points/data/v2/releases/r000.json';
export const CACHE_KEY = 'dcap.points.public.v2.production.1';
export const CACHE_MS = 60_000;
export const MAX_BYTES = 2_000_000;
export const PATHS = Object.freeze({
 '/points/':'overview',
 '/points/leaderboard/':'leaderboard',
 '/points/members/':'members',
 '/points/members/profile/':'profile',
 '/points/statistics/':'statistics',
 '/points/how-points-work/':'how',
 '/points/rewards/':'rewards'
});
export function releaseRoute(url) {
 const u = url instanceof URL ? url : new URL(url);
 const view = PATHS[u.pathname] || null;
 if (!view) return Object.freeze({mode:'other',view:null});
 const local = ['localhost','127.0.0.1','[::1]'].includes(u.hostname);
 const marker = u.searchParams.getAll('dcapV2Review');
 if (marker.length) {
  if (!local) return Object.freeze({mode:'v1',view});
  if (marker.length!==1 || marker[0]!=='private' || u.searchParams.has('pointsPreview')) return Object.freeze({mode:'invalid',view});
  return Object.freeze({mode:'private-v2',view});
 }
 if (PUBLIC_V2_ENABLED && u.protocol==='https:' && u.hostname===EXPECTED_PUBLIC_HOST && !u.searchParams.has('pointsPreview')) {
  return Object.freeze({mode:'production-v2',view});
 }
 return Object.freeze({mode:'v1',view});
}
