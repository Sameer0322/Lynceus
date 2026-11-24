import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sortable from 'sortablejs';
import {
  apiGetReleases, apiCreateRelease, apiDeleteRelease,
  apiGetReleasePipelines, apiRemovePipeline, apiReorderPipelines
} from '../services/api.js';
import { useApp } from '../context/AppContext.jsx';
import { ago, shortRepo } from '../utils.js';

function Spin({ size = 'sm' }) { return <span className={`spin spin-${size}`} />; }

function GroupList({ groups, auth, onSelect, onNewGroup, onDeleteGroup, loading, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  async function handleCreate() {
    if (!newName.trim()) { setCreateErr('Group name is required.'); return; }
    setCreateErr(''); setCreating(true);
    try {
      const g = await apiCreateRelease(newName.trim());
      setNewName(''); setShowForm(false);
      onNewGroup(g);
    } catch (e) {
      setCreateErr(e.message || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  }

  function toggleForm() {
    setShowForm(v => !v);
    setCreateErr('');
  }

  return (
    <div className="rg-view">
      <div className="view-header">
        <button className="btn-back" onClick={onBack}>← Repositories</button>
        <div className="view-header-row">
          <span className="view-title">Release Groups</span>
          {auth?.role === 'admin' && (
            <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={toggleForm}>
              + New Group
            </button>
          )}
        </div>
        {showForm && (
          <div className="rg-create-form">
            <input
              className="finput rg-name-input"
              type="text"
              placeholder="e.g. 2610"
              maxLength={128}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
            <button className="btn-save rg-create-btn" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button className="btn-icon" onClick={toggleForm}>Cancel</button>
            {createErr && <div className="form-error" style={{ display: 'block' }}>{createErr}</div>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="state-box"><Spin size="lg" /></div>
      ) : groups.length === 0 ? (
        <div className="rg-empty">
          No release groups yet.{auth?.role === 'admin' ? ' Click "+ New Group" to create one.' : ''}
        </div>
      ) : (
        <div className="rg-list">
          {groups.map(g => {
            const count = g.pipelineCount ?? 0;
            const dateStr = g.createdAt ? ago(g.createdAt) : '';
            return (
              <div key={g.id} className="rg-card">
                <div className="rg-card-info">
                  <span className="rg-card-name">{g.name}</span>
                  <span className="rg-card-meta">
                    {count} pipeline{count !== 1 ? 's' : ''}
                    {g.createdBy ? ` · by ${g.createdBy}` : ''}
                    {dateStr ? ` · ${dateStr}` : ''}
                  </span>
                </div>
                <div className="rg-card-actions">
                  <button className="btn-icon" onClick={() => onSelect(g)}>▶ View</button>
                  {auth?.role === 'admin' && (
                    <button
                      className="btn-icon btn-danger-icon"
                      onClick={() => onDeleteGroup(g.id, g.name, count)}
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupDetail({ group, auth, onBack }) {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const listRef = useRef(null);
  const sortableRef = useRef(null);

  useEffect(() => {
    loadPipelines();
  }, [group.id]);

  useEffect(() => {
    if (!loading && pipelines.length > 1 && auth?.role === 'admin' && listRef.current) {
      sortableRef.current?.destroy();
      sortableRef.current = Sortable.create(listRef.current, {
        handle: '.rg-drag-handle',
        animation: 150,
        onEnd: async () => {
          const orderedIds = [...listRef.current.querySelectorAll('[data-pipeline-id]')]
            .map(el => el.dataset.pipelineId);
          listRef.current.querySelectorAll('.rg-seq').forEach((badge, i) => { badge.textContent = i + 1; });
          try {
            await apiReorderPipelines(group.id, orderedIds);
          } catch (e) {
            console.error('Failed to save order:', e);
          }
        },
      });
      return () => sortableRef.current?.destroy();
    }
  }, [loading, pipelines, auth]);

  async function loadPipelines() {
    setLoading(true); setErr('');
    try {
      const p = await apiGetReleasePipelines(group.id);
      setPipelines(p);
    } catch (e) {
      setErr(e.message || 'Failed to load pipelines.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(pipelineId) {
    if (!confirm('Remove this pipeline from the group?')) return;
    try {
      await apiRemovePipeline(group.id, pipelineId);
      setPipelines(prev => prev.filter(p => p.id !== pipelineId));
    } catch (e) {
      alert(`Failed to remove: ${e.message}`);
    }
  }

  function handleDownloadExcel() {
    const rows = pipelines.map((p, idx) => ({
      '#': idx + 1,
      'Repo': p.repo ?? '',
      'Run #': p.runNumber ?? '',
      'Branch': p.branch ?? '',
      'Commit Message': (p.message ?? '').slice(0, 200),
      'Run URL': p.repo && p.runId ? `https://github.com/${p.repo}/actions/runs/${p.runId}` : '',
      'Added By': p.addedBy ?? '',
      'I-Number': p.iNumber ?? '',
      'Note': p.note ?? '',
      'Added At': p.addedAt ? new Date(p.addedAt).toLocaleString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pipelines');
    const safeGroupName = (group.name ?? 'release').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    XLSX.writeFile(wb, `${safeGroupName}_pipelines.xlsx`);
  }

  const count = pipelines.length;

  return (
    <div className="rg-view">
      <div className="view-header">
        <div className="view-header-row">
          <button className="btn-icon" onClick={onBack}>← Release Groups</button>
          <span className="rg-detail-slash">/</span>
          <span className="view-title" style={{ fontSize: 18 }}>{group.name}</span>
          <span className="rg-card-meta">
            {count} pipeline{count !== 1 ? 's' : ''}
            {group.createdBy ? ` · created by ${group.createdBy}` : ''}
          </span>
          {auth?.role === 'admin' && (
            <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={handleDownloadExcel}>
              ⬇ Download Sequence
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="state-box"><Spin size="lg" /></div>
      ) : err ? (
        <div className="rg-empty" style={{ color: 'var(--failure)' }}>Failed to load pipelines — {err}</div>
      ) : pipelines.length === 0 ? (
        <div className="rg-empty">No pipelines added yet. Go to a repo's run list and click "+ Release".</div>
      ) : (
        <div className="rg-pipeline-list" id="rgPipelineList" ref={listRef}>
          {pipelines.map((p, idx) => {
            const runUrl = `https://github.com/${p.repo}/actions/runs/${p.runId}`;
            const dragHandle = auth?.role === 'admin'
              ? <span className="rg-drag-handle" title="Drag to reorder">⠿</span>
              : null;
            return (
              <div key={p.id} className="rg-pipeline-row" data-pipeline-id={p.id}>
                <div className="rg-pipeline-main">
                  {dragHandle}
                  <span className="rg-seq">{idx + 1}</span>
                  <a className="rg-pipeline-repo" href={runUrl} target="_blank" rel="noopener">
                    {shortRepo(p.repo || '')}
                  </a>
                  <span className="rg-pipeline-num">#{p.runNumber}</span>
                  <span className="rg-pipeline-branch">⎇ {p.branch}</span>
                  <span className="rg-pipeline-msg">{(p.message || '').slice(0, 80)}</span>
                  <button
                    className="rg-remove-btn"
                    title="Remove from group"
                    onClick={() => handleRemove(p.id)}
                  >✕</button>
                </div>
                <div className="rg-pipeline-meta">
                  Added by {p.addedBy}
                  {p.iNumber ? ` (${p.iNumber})` : ''}
                  {' · '}{ago(p.addedAt)}
                  {p.note ? ` · Note: ${p.note}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReleaseGroupsPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    try {
      const groups = await apiGetReleases();
      dispatch({ type: 'SET_RELEASE_GROUPS', payload: groups });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleNewGroup(group) {
    dispatch({ type: 'SET_RELEASE_GROUPS', payload: [...state.releaseGroups, { ...group, pipelineCount: 0 }] });
  }

  async function handleDeleteGroup(groupId, name, count) {
    const noun = `pipeline${count !== 1 ? 's' : ''}`;
    if (!confirm(`Delete release group "${name}" and all ${count} ${noun} inside it?`)) return;
    try {
      await apiDeleteRelease(groupId);
      dispatch({ type: 'SET_RELEASE_GROUPS', payload: state.releaseGroups.filter(g => g.id !== groupId) });
      if (selected?.id === groupId) setSelected(null);
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  if (selected) {
    const latestGroup = state.releaseGroups.find(g => g.id === selected.id) || selected;
    return (
      <GroupDetail
        group={latestGroup}
        auth={state.auth}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <GroupList
      groups={state.releaseGroups}
      auth={state.auth}
      loading={loading}
      onSelect={setSelected}
      onNewGroup={handleNewGroup}
      onDeleteGroup={handleDeleteGroup}
      onBack={() => navigate('/')}
    />
  );
}
