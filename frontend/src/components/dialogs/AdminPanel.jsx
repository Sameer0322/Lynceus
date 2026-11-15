import React, { useState, useEffect, useRef } from 'react';
import {
  apiGetTeams, apiCreateTeam, apiUpdateTeam, apiDeleteTeam,
  apiGetUsers, apiCreateUser, apiDeleteUser, apiResetUserPassword, apiChangeUserRole,
} from '../../services/api.js';
import { GithubAPI } from '../../services/github.js';
import { shortRepo } from '../../utils.js';
import { useApp } from '../../context/AppContext.jsx';

function Spin({ size = 'sm' }) { return <span className={`spin spin-${size}`} />; }

function RateLimitWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setErr('');
    try {
      const d = await GithubAPI.rateLimitAll();
      setData(d);
    } catch (e) {
      setErr(e.message || 'Failed to load rate limit.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Spin size="sm" />;
  if (err) return <span style={{ color: 'var(--failure)', fontSize: 12 }}>⚠ {err}</span>;
  if (!data) return null;

  const primaryExhausted = !data.primary?.rate || data.primary.rate.remaining === 0;

  function TokenBlock({ rate, label, badgeCls }) {
    const badgeLabel = { 'rl-badge-active': 'Active', 'rl-badge-standby': 'Standby', 'rl-badge-exhausted': 'Exhausted' }[badgeCls];
    if (!rate) {
      return (
        <div className="rl-token-block">
          <div className="rl-token-label">{label} <span className={`rl-badge ${badgeCls}`}>{badgeLabel}</span></div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not configured</span>
        </div>
      );
    }
    const pct = Math.round((rate.used / rate.limit) * 100);
    const fillCls = pct >= 80 ? 'rl-fill-danger' : pct >= 50 ? 'rl-fill-warn' : 'rl-fill-ok';
    const resetMins = Math.max(0, Math.round((rate.reset * 1000 - Date.now()) / 60000));
    return (
      <div className="rl-token-block">
        <div className="rl-token-label">{label} <span className={`rl-badge ${badgeCls}`}>{badgeLabel}</span></div>
        <div className="rl-row">
          <span className="rl-nums">{rate.used.toLocaleString()} / {rate.limit.toLocaleString()} requests used</span>
          <span className="rl-reset">Resets in {resetMins} min</span>
        </div>
        <div className="rl-bar-track"><div className={`rl-bar-fill ${fillCls}`} style={{ width: `${pct}%` }} /></div>
        <div className="rl-remaining">{rate.remaining.toLocaleString()} remaining ({100 - pct}%)</div>
      </div>
    );
  }

  return (
    <>
      <TokenBlock rate={data.primary?.rate} label="Token 1 (Primary)" badgeCls={primaryExhausted ? 'rl-badge-exhausted' : 'rl-badge-active'} />
      <TokenBlock rate={data.secondary?.rate} label="Token 2 (Secondary)" badgeCls={primaryExhausted ? 'rl-badge-active' : 'rl-badge-standby'} />
      <button className="btn-icon" style={{ marginTop: 6 }} onClick={load}>↻ Refresh</button>
    </>
  );
}

function TeamCard({ team, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [reposText, setReposText] = useState(
    (team.repos || []).map(r => typeof r === 'string' ? r : r.repo).join('\n')
  );
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const repos = (team.repos || []).map(r => typeof r === 'string' ? r : r.repo);
  const cnt = repos.length;

  async function handleSave() {
    if (!name.trim()) { setErr('Team name is required.'); return; }
    setErr(''); setSaving(true);
    const updatedRepos = reposText.split('\n').map(r => r.trim()).filter(Boolean);
    try {
      await apiUpdateTeam(team.id, { name: name.trim(), repos: updatedRepos });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e.message || 'Failed to save team.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete team "${team.name}" and all ${cnt} repo association${cnt !== 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    try {
      await apiDeleteTeam(team.id);
      onDeleted();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
      setDeleting(false);
    }
  }

  return (
    <div className="admin-team-card">
      <div className="admin-team-header">
        <span className="admin-team-name">{team.name}</span>
        <span className="admin-team-count">{cnt} repo{cnt !== 1 ? 's' : ''}</span>
        <div className="admin-team-actions">
          {editing
            ? <button className="btn-icon" onClick={() => setEditing(false)}>Cancel</button>
            : <button className="btn-icon" onClick={() => setEditing(true)}>✏ Edit</button>
          }
          <button className="btn-icon btn-danger-icon" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Spin /> : '🗑 Delete'}
          </button>
        </div>
      </div>
      {editing && (
        <div className="admin-team-edit">
          <div className="field">
            <label>Team name</label>
            <input className="finput" type="text" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Repositories (one per line)</label>
            <textarea className="finput" rows={5} value={reposText} onChange={e => setReposText(e.target.value)} />
          </div>
          {err && <div className="form-error" style={{ display: 'block' }}>{err}</div>}
          <button className="btn-save" style={{ marginTop: 4 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [formErr, setFormErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // username being reset
  const [resetPw, setResetPw] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true); setErr('');
    try { setUsers(await apiGetUsers()); }
    catch (e) { setErr(e.message || 'Failed to load users.'); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!newUsername.trim()) { setFormErr('Username is required.'); return; }
    if (newPassword.length < 6) { setFormErr('Password must be at least 6 characters.'); return; }
    setFormErr(''); setCreating(true);
    try {
      await apiCreateUser(newUsername.trim(), newPassword, newRole);
      setNewUsername(''); setNewPassword(''); setNewRole('viewer'); setShowForm(false);
      loadUsers();
    } catch (e) { setFormErr(e.message || 'Failed to create user.'); }
    finally { setCreating(false); }
  }

  async function handleDelete(username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    try { await apiDeleteUser(username); loadUsers(); }
    catch (e) { alert(e.message || 'Failed to delete user.'); }
  }

  async function handleRoleToggle(username, currentRole) {
    const next = currentRole === 'admin' ? 'viewer' : 'admin';
    if (!confirm(`Change role of "${username}" to ${next}?`)) return;
    try { await apiChangeUserRole(username, next); loadUsers(); }
    catch (e) { alert(e.message || 'Failed to change role.'); }
  }

  async function handleResetPw() {
    if (resetPw.length < 6) { setResetErr('Password must be at least 6 characters.'); return; }
    setResetErr(''); setResetting(true);
    try { await apiResetUserPassword(resetTarget, resetPw); setResetTarget(null); setResetPw(''); }
    catch (e) { setResetErr(e.message || 'Failed to reset password.'); }
    finally { setResetting(false); }
  }

  return (
    <>
      <div className="admin-section-title" style={{ marginTop: 20 }}>
        Users
        <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(v => !v)}>+ New User</button>
      </div>

      {showForm && (
        <div className="admin-form">
          <div className="field">
            <label>Username</label>
            <input className="finput" type="text" placeholder="e.g. john" value={newUsername}
              onChange={e => setNewUsername(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Password (min 6 chars)</label>
            <input className="finput" type="password" placeholder="••••••••" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Role</label>
            <select className="finput" value={newRole} onChange={e => setNewRole(e.target.value)}
              style={{ cursor: 'pointer' }}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {formErr && <div className="form-error" style={{ display: 'block' }}>{formErr}</div>}
          <button className="btn-save" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create User'}
          </button>
        </div>
      )}

      {loading ? <div style={{ padding: '8px 0' }}><Spin size="sm" /></div>
        : err ? <div className="rg-empty" style={{ color: 'var(--failure)' }}>{err}</div>
        : users.length === 0 ? <div className="rg-empty">No users found.</div>
        : (
          <div className="admin-team-list">
            {users.map(u => (
              <div key={u.username} className="admin-team-card">
                <div className="admin-team-header">
                  <span className="admin-team-name">{u.username}</span>
                  <span className="admin-team-count">
                    <span style={{
                      background: u.role === 'admin' ? 'var(--running-bg)' : 'var(--bg-tertiary)',
                      color: u.role === 'admin' ? 'var(--running)' : 'var(--text-muted)',
                      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                    }}>{u.role}</span>
                  </span>
                  <div className="admin-team-actions">
                    <button className="btn-icon" onClick={() => handleRoleToggle(u.username, u.role)}
                      title={`Make ${u.role === 'admin' ? 'viewer' : 'admin'}`}>
                      {u.role === 'admin' ? '→ viewer' : '→ admin'}
                    </button>
                    <button className="btn-icon" onClick={() => { setResetTarget(u.username); setResetPw(''); setResetErr(''); }}
                      title="Reset password">🔑 Reset pw</button>
                    <button className="btn-icon btn-danger-icon" onClick={() => handleDelete(u.username)}
                      title="Delete user">🗑 Delete</button>
                  </div>
                </div>
                {resetTarget === u.username && (
                  <div className="admin-team-edit">
                    <div className="field">
                      <label>New password (min 6 chars)</label>
                      <input className="finput" type="password" placeholder="••••••••"
                        value={resetPw} onChange={e => setResetPw(e.target.value)} autoFocus />
                    </div>
                    {resetErr && <div className="form-error" style={{ display: 'block' }}>{resetErr}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button className="btn-save" onClick={handleResetPw} disabled={resetting}>
                        {resetting ? 'Saving…' : 'Save Password'}
                      </button>
                      <button className="btn-icon" onClick={() => setResetTarget(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  );
}

export default function AdminPanel({ open, onClose, onChangePassword }) {
  const { state } = useApp();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRepos, setNewRepos] = useState('');
  const [newErr, setNewErr] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) loadTeams();
  }, [open]);

  async function loadTeams() {
    setLoading(true); setErr('');
    try {
      const t = await apiGetTeams();
      setTeams(t);
    } catch (e) {
      setErr(e.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) { setNewErr('Team name is required.'); return; }
    setNewErr(''); setCreating(true);
    const repos = newRepos.split('\n').map(r => r.trim()).filter(Boolean);
    try {
      await apiCreateTeam(newName.trim(), repos);
      setNewName(''); setNewRepos(''); setShowNewForm(false);
      loadTeams();
    } catch (e) {
      setNewErr(e.message || 'Failed to create team.');
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;
  if (state.auth?.role !== 'admin') {
    return (
      <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal">
          <div className="modal-title">Access Denied</div>
          <div className="modal-sub">Admin privileges required.</div>
          <button className="btn-save" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <div className="admin-header">
          <span className="modal-title">Admin Panel</span>
          <button className="admin-close" onClick={onClose} title="Close">✕</button>
        </div>
        <div className="admin-rate-limit-section">
          <div className="admin-section-title">
            GitHub API Rate Limit
          </div>
          <div id="rateLimitWidget">
            <RateLimitWidget />
          </div>
        </div>

        {loading ? (
          <div className="state-box" style={{ minHeight: 80 }}><Spin size="md" /></div>
        ) : err ? (
          <div className="rg-empty" style={{ color: 'var(--failure)' }}>{err}</div>
        ) : (
          <>
            <div className="admin-team-list">
              {teams.length === 0
                ? <div className="rg-empty">No teams yet.</div>
                : teams.map(t => (
                  <TeamCard
                    key={t.id}
                    team={t}
                    onSaved={loadTeams}
                    onDeleted={loadTeams}
                  />
                ))
              }
            </div>
            <div className="admin-section-title">
              New Team
              <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => setShowNewForm(v => !v)}>+ New Team</button>
            </div>
            {showNewForm && (
              <div className="admin-form">
                <div className="field">
                  <label>Team name</label>
                  <input
                    className="finput"
                    type="text"
                    placeholder="e.g. Phoenix"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Repositories (one per line, optional)</label>
                  <textarea
                    className="finput"
                    placeholder="org/repo-name"
                    value={newRepos}
                    onChange={e => setNewRepos(e.target.value)}
                  />
                </div>
                {newErr && <div className="form-error" style={{ display: 'block' }}>{newErr}</div>}
                <button className="btn-save" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            )}

            <UsersSection />
          </>
        )}
      </div>
    </div>
  );
}
