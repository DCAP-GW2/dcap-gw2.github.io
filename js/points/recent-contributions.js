const dateFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const numberFormat = new Intl.NumberFormat('en-NZ');

// Same-day order in each member's feed is canonical. Public IDs make the
// community-wide order deterministic without claiming a time of day.
export function communityRecentContributions(members) {
  if (members.some(member => !Array.isArray(member.recentContributions))) return null;
  return members.flatMap(member => member.recentContributions.map((contribution, index) =>
    ({ member, contribution, index })))
    .sort((a, b) => (a.contribution.eventDate < b.contribution.eventDate ? 1 :
      a.contribution.eventDate > b.contribution.eventDate ? -1 : 0) ||
      (a.member.id < b.member.id ? -1 : a.member.id > b.member.id ? 1 : 0) ||
      a.index - b.index)
    .slice(0, 10);
}

export function memberRecentContributions(member) {
  if (!Array.isArray(member.recentContributions)) return null;
  return member.recentContributions.map((contribution, index) => ({ member, contribution, index }));
}

/** Render validated public fields only. Never interpret feed text as markup. */
export function renderRecentContributions(list, records, profileBaseUrl = null) {
  const items = document.createDocumentFragment();
  for (const { member, contribution } of records) {
    const item = document.createElement('li');
    item.className = 'points-recent-entry';

    const details = document.createElement('div');
    details.className = 'points-recent-details';
    const heading = document.createElement('div');
    heading.className = 'points-recent-heading';
    const date = document.createElement('time');
    date.dateTime = contribution.eventDate;
    date.textContent = dateFormat.format(new Date(`${contribution.eventDate}T00:00:00Z`));
    heading.append(date);
    if (profileBaseUrl) {
      const url = new URL(profileBaseUrl);
      url.searchParams.set('member', member.id);
      const link = document.createElement('a');
      link.href = url.href;
      link.textContent = member.displayName;
      heading.append(link);
    }
    const event = document.createElement('p');
    event.className = 'points-recent-event';
    event.textContent = contribution.eventType;
    const role = document.createElement('p');
    role.className = 'points-recent-role';
    role.textContent = `Role: ${contribution.role}`;
    details.append(heading, event, role);

    const points = document.createElement('span');
    points.className = 'points-recent-points';
    points.textContent = `${numberFormat.format(contribution.points)} ${contribution.points === 1 ? 'Point' : 'Points'} awarded`;
    item.append(details, points);
    items.append(item);
  }
  list.replaceChildren(items);
}
