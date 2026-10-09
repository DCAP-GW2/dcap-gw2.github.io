/** Use the same opaque feed ID and route as the Members directory and profile page. */
export function memberProfileUrl(member, relativePath, pageUrl = window.location.href) {
  if (typeof member?.id !== 'string' || !member.id.trim()) return null;
  const url = new URL(relativePath, pageUrl);
  url.searchParams.set('member', member.id);
  return url.href;
}

export function memberNameNode(member, relativePath) {
  const href = memberProfileUrl(member, relativePath);
  const name = document.createElement(href ? 'a' : 'span');
  if (href) {
    name.href = href;
    name.className = 'points-member-profile-link';
  }
  name.textContent = member.displayName;
  return name;
}
