import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseRoute } from '../points/v2/config.mjs';

const view = url => releaseRoute(url).mode;

test('Points v2 remains enabled on its exact GitHub Pages production hostname', () => {
  assert.equal(view('https://dcap-gw2.github.io/points/'), 'production-v2');
  assert.equal(view('https://dcap-gw2.github.io/points/leaderboard/'), 'production-v2');
  assert.equal(view('http://dcap-gw2.github.io/points/'), 'v1');
});

test('Points v2 activates only on this Cloudflare Worker preview host pattern', () => {
  const subdomain = 'hal-intania92.workers.dev';
  const preview = `https://feature-programme-highlights-presentation-20261123-dcap-pr-preview.${subdomain}`;
  const immutable = `https://a1b2c3d4-dcap-pr-preview.${subdomain}`;
  assert.equal(view(preview + '/points/'), 'production-v2');
  assert.equal(view(preview + '/points/leaderboard/'), 'production-v2');
  assert.equal(view(immutable + '/points/members/profile/?member=m0001'), 'production-v2');
  assert.equal(view('https://dcap-pr-preview.' + subdomain + '/points/'), 'v1');
  assert.equal(view('https://other-project.' + subdomain + '/points/'), 'v1');
  assert.equal(view('https://feature-dcap-pr-preview.other-account.workers.dev/points/'), 'v1');
  assert.equal(view(preview + '.example.org/points/'), 'v1');
  assert.equal(view('http://feature-dcap-pr-preview.' + subdomain + '/points/'), 'v1');
});

test('Preview routing retains private-review and query safeguards', () => {
  const preview = 'https://feature-dcap-pr-preview.hal-intania92.workers.dev/points/';
  assert.equal(view(preview + '?pointsPreview=1'), 'v1');
  assert.equal(view(preview + '?dcapV2Review=private'), 'v1');
  assert.equal(view(preview.replace('/points/', '/not-a-points-route/')), 'other');
  assert.equal(view('http://localhost:8000/points/?dcapV2Review=private'), 'private-v2');
});

test('Cloudflare asset exclusion rules keep repository-only files out of uploads', () => {
  const text = readFileSync(new URL('../.assetsignore', import.meta.url), 'utf8');
  for (const required of ['.git/', '.github/', 'tests/', 'node_modules/', '.wrangler/',
    'README.md', 'LICENSE', 'package.json', 'package-lock.json', 'wrangler.jsonc']) {
    assert.ok(text.split(/\r?\n/).includes(required), `Missing exclusion for ${required}`);
  }
  for (const published of ['points/', 'points/data/', 'js/', 'css/', 'assets/', 'events/']) {
    assert.ok(!text.split(/\r?\n/).includes(published), `Site asset excluded: ${published}`);
  }
});
