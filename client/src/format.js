export function timeAgo(sqliteDate) {
  // SQLite datetime('now') is UTC without a zone marker.
  const then = new Date(`${sqliteDate.replace(' ', 'T')}Z`).getTime();
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const initials = (name = '') => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
