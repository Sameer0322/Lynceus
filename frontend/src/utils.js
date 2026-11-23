export function stCls(status, conclusion) {
  if (status === 'in_progress' || status === 'queued') return 'running';
  if (status === 'waiting') return 'waiting';
  if (conclusion === 'success') return 'success';
  if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure';
  return 'pending';
}

export function stLabel(status, conclusion) {
  if (status === 'in_progress') return 'Running';
  if (status === 'queued') return 'Queued';
  if (status === 'waiting') return 'Waiting';
  if (status === 'completed') {
    const m = { success: 'Success', failure: 'Failed', cancelled: 'Cancelled', timed_out: 'Timed out', skipped: 'Skipped', neutral: 'Neutral' };
    return m[conclusion] || conclusion || 'Done';
  }
  return status || 'Unknown';
}

export function stIconText(status, conclusion) {
  if (status === 'in_progress' || status === 'queued') return null; // caller renders <Spin>
  if (status === 'waiting') return '⏸';
  const m = { success: '✓', failure: '✗', cancelled: '⊘', timed_out: '✗', skipped: '⊝', neutral: '○' };
  return m[conclusion] || '·';
}

export function ago(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function dur(a, b) {
  if (!a) return '';
  const s = Math.floor((new Date(b || Date.now()) - new Date(a)) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function sha7(s) { return s ? s.slice(0, 7) : ''; }
export function shortRepo(r) { return r.split('/')[1] || r; }

export function jwtDecode(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { username: p.sub, role: p.role, exp: p.exp };
  } catch { return null; }
}
