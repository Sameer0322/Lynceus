// Backend API — all calls require JWT (Authorization: Bearer <token>)
// API_BASE: empty string uses Vite's proxy (/api/* → backend). Set VITE_API_BASE for production direct calls.
export const API_BASE = import.meta.env.VITE_API_BASE || '';

function _jwt() {
  return sessionStorage.getItem('pd_jwt') || '';
}

function _headers(json = true) {
  const h = { 'Authorization': `Bearer ${_jwt()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function apiLogin(username, password) {
  const r = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    let msg = 'Login failed.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(r.status === 401 ? 'Invalid username or password.' : msg);
  }
  return r.json();
}

export async function apiRefreshToken() {
  const r = await fetch(`${API_BASE}/api/auth/refresh`, { headers: _headers(false) });
  if (!r.ok) throw new Error('Session expired.');
  return r.json();
}

export async function apiChangePassword(oldPassword, newPassword) {
  const r = await fetch(`${API_BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (!r.ok) {
    let msg = 'Failed to update password.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

// ── Releases ─────────────────────────────────────────────────────────────────

export async function apiGetReleases() {
  const r = await fetch(`${API_BASE}/api/releases`, { headers: _headers(false) });
  if (!r.ok) throw new Error(`Failed to load releases (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.value || []);
}

export async function apiCreateRelease(name) {
  const r = await fetch(`${API_BASE}/api/releases`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ name, createdBy: sessionStorage.getItem('pd_username') || 'Admin' }),
  });
  if (!r.ok) {
    let msg = 'Failed to create release group.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export async function apiDeleteRelease(id) {
  const r = await fetch(`${API_BASE}/api/releases/${id}`, {
    method: 'DELETE',
    headers: _headers(false),
  });
  if (!r.ok) {
    let msg = 'Failed to delete release group.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

export async function apiGetReleasePipelines(id) {
  const r = await fetch(`${API_BASE}/api/releases/${id}/pipelines`, { headers: _headers(false) });
  if (!r.ok) throw new Error(`Failed to load pipelines (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.value || []);
}

export async function apiAddPipeline(releaseId, payload) {
  const r = await fetch(`${API_BASE}/api/releases/${releaseId}/pipelines`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    let msg = 'Failed to add pipeline.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export async function apiRemovePipeline(releaseId, pipelineId) {
  const r = await fetch(`${API_BASE}/api/releases/${releaseId}/pipelines/${pipelineId}`, {
    method: 'DELETE',
    headers: _headers(false),
  });
  if (!r.ok) {
    let msg = 'Failed to remove pipeline.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

// ── Admin: Teams ─────────────────────────────────────────────────────────────

export async function apiGetTeams() {
  const r = await fetch(`${API_BASE}/api/teams`, { headers: _headers(false) });
  if (!r.ok) throw new Error(`Failed to load teams (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data.value || []);
}

export async function apiCreateTeam(name, repos) {
  const r = await fetch(`${API_BASE}/api/teams`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ name, repos }),
  });
  if (!r.ok) {
    let msg = 'Failed to create team.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export async function apiUpdateTeam(id, payload) {
  const r = await fetch(`${API_BASE}/api/teams/${id}`, {
    method: 'PUT',
    headers: _headers(),
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    let msg = 'Failed to update team.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

export async function apiDeleteTeam(id) {
  const r = await fetch(`${API_BASE}/api/teams/${id}`, {
    method: 'DELETE',
    headers: _headers(false),
  });
  if (!r.ok) {
    let msg = 'Failed to delete team.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

// ── Admin: Users ─────────────────────────────────────────────────────────────

export async function apiGetUsers() {
  const r = await fetch(`${API_BASE}/api/auth/users`, { headers: _headers(false) });
  if (!r.ok) throw new Error(`Failed to load users (${r.status})`);
  return r.json();
}

export async function apiCreateUser(username, password, role = 'viewer') {
  const r = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ username, password, role }),
  });
  if (!r.ok) {
    let msg = 'Failed to create user.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

export async function apiDeleteUser(username) {
  const r = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: _headers(false),
  });
  if (!r.ok) {
    let msg = 'Failed to delete user.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

export async function apiResetUserPassword(username, password) {
  const r = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(username)}/reset-password`, {
    method: 'POST',
    headers: _headers(),
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    let msg = 'Failed to reset password.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

export async function apiChangeUserRole(username, role) {
  const r = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(username)}/role`, {
    method: 'PATCH',
    headers: _headers(),
    body: JSON.stringify({ role }),
  });
  if (!r.ok) {
    let msg = 'Failed to change role.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}

export async function apiReorderPipelines(releaseId, orderedIds) {
  const r = await fetch(`${API_BASE}/api/releases/${releaseId}/pipelines/order`, {
    method: 'PATCH',
    headers: _headers(),
    body: JSON.stringify({ order: orderedIds }),
  });
  if (!r.ok) {
    let msg = 'Failed to save order.';
    try { const d = await r.json(); msg = d.message || d.error || msg; } catch {}
    throw new Error(msg);
  }
}
