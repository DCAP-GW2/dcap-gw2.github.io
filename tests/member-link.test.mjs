import assert from 'node:assert/strict';
import test from 'node:test';
import { memberProfileUrl } from '../js/points/member-link.js';

test('overview and leaderboard links use the same member profile route', () => {
  const member = { id: 'public-42', displayName: 'Preferred name' };
  assert.equal(memberProfileUrl(member, './members/profile/', 'https://dcap-gw2.github.io/points/'),
    'https://dcap-gw2.github.io/points/members/profile/?member=public-42');
  assert.equal(memberProfileUrl(member, '../members/profile/', 'https://dcap-gw2.github.io/points/leaderboard/'),
    'https://dcap-gw2.github.io/points/members/profile/?member=public-42');
});

test('opaque IDs survive URL encoding regardless of display name or past identity', () => {
  const member = { id: 'merged/old & new+%?#', displayName: 'Renamed member' };
  const href = memberProfileUrl(member, './members/profile/', 'https://dcap-gw2.github.io/points/');
  assert.equal(new URL(href).searchParams.get('member'), member.id);
  assert.equal(new URL(href).pathname, '/points/members/profile/');
  assert.equal(memberProfileUrl({ ...member, displayName: 'Another preferred name' },
    './members/profile/', 'https://dcap-gw2.github.io/points/'), href);
});

test('missing or blank IDs do not produce profile links', () => {
  for (const id of [undefined, null, '', '   ', 42]) {
    assert.equal(memberProfileUrl({ id, displayName: 'Member' }, './members/profile/',
      'https://dcap-gw2.github.io/points/'), null);
  }
});
