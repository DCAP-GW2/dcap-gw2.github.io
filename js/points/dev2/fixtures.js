// Immutable bindings for the five reviewed FICTIONAL local fixtures only.
// These are not production/private feed identities. A changed fixture needs explicit review.
export const FIXTURES = Object.freeze({
  "complete": {
    "revision": "dev-ratified-e1c43cdfd5b1d840479b9475",
    "hash": "3263a83f1b5b523a8e0ea0d94463b10f8480178bced4a26c6b529bf6fcf4ab1d"
  },
  "incomplete": {
    "revision": "dev-ratified-f06556796f72b20d095bc174",
    "hash": "54e3d5ec0698111cf1c22b1bbf68d115cdf04fe0afd93972d42a8cc39063bdb6"
  },
  "missing": {
    "revision": "dev-ratified-cd49cef54d404456bd04ddfb",
    "hash": "08bd7704f5e05a544c423f42c59ccc6b539c9c61ffe04d537c063a2ace0405ec"
  },
  "pending": {
    "revision": "dev-ratified-add8b0c97456314512539518",
    "hash": "0f415493fb4d88905c3bb63b2093dbf1db46307c4a7f8aea0cf46613d99fbd36"
  },
  "ties": {
    "revision": "dev-ratified-2f00c387bd5fe6b3bffdb7ef",
    "hash": "49aaa765a37f5aaf3162ec2eb51609bb5b2e41d8b5cf36abdbbd5bbd10e0004a"
  }
});

export function previewContext(url) {
 const q = new URLSearchParams(url.search);
 const name = q.get('fixture') ?? 'complete';
 const pin = Object.hasOwn(FIXTURES, name) ? FIXTURES[name] : null;
 if (!pin || ['fixture','previewRevision','previewHash','pointsPreview'].some(k => q.getAll(k).length > 1)) return null;
 const hasPin = q.has('previewRevision') || q.has('previewHash');
 if (hasPin && (q.get('previewRevision') !== pin.revision || q.get('previewHash') !== pin.hash)) return null;
 return { name, ...pin };
}

export function previewQuery(context) {
 return new URLSearchParams({pointsPreview:'ratified', fixture:context.name,
   previewRevision:context.revision, previewHash:context.hash}).toString();
}
