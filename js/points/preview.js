export function previewContract(url) {
 if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
 const q = new URLSearchParams(url.search);
 if (q.getAll('pointsPreview').length !== 1) return null;
 const value = q.get('pointsPreview');
 return value === 'synthetic' ? '2.0.0-dev.1' : value === 'ratified' ? '2.0.0-dev.2' : null;
}

export async function maybeRenderV2(root, page) {
 const version = previewContract(location);
 if (version === '2.0.0-dev.1') return (await import('./v2/page.js')).maybeRenderV2(root, page);
 if (version === '2.0.0-dev.2') return (await import('./dev2/page.js')).maybeRenderV2(root, page);
 return false;
}
