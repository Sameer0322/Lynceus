import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { GithubAPI } from '../services/github.js';
import { apiGetReleases, apiAddPipeline, apiRemovePipeline, apiCreateRelease, apiGetReleasePipelines } from '../services/api.js';
import { stCls, stLabel, stIconText, ago, dur, sha7, shortRepo } from '../utils.js';
import TagPipelineDialog from '../components/dialogs/TagPipelineDialog.jsx';

function Spin({ size = 'sm' }) { return <span className={`spin spin-${size}`} />; }

function StatusIcon({ status, conclusion }) {
  if (status === 'in_progress' || status === 'queued') return <Spin />;
  return <>{stIconText(status, conclusion)}</>;
}

function ReleaseCell({ run, runIdx, releaseGroups, runGroupMap, auth, onTag, onRemove, onCreateAndAdd }) {
  const [dropOpen, setDropOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setDropOpen(false); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const mapped = runGroupMap[String(run.id)];
  if (mapped) {
    if (removeConfirm) {
      return (
        <div className="pl-release pl-release-confirm" onClick={e => e.stopPropagation()}>
          <span className="atr-confirm-text">Remove from <strong>{mapped.groupName}</strong>?</span>
          <button className="atr-confirm-yes" onClick={() => { setRemoveConfirm(false); onRemove(mapped.groupId, mapped.pipelineId, run.id); }}>Yes</button>
          <button className="atr-confirm-no" onClick={() => setRemoveConfirm(false)}>No</button>
        </div>
      );
    }
    return (
      <div className="pl-release" onClick={e => e.stopPropagation()}>
        <span className="atr-badge">In {mapped.groupName} ✓</span>
        <button className="atr-remove" title="Remove from group" onClick={() => setRemoveConfirm(true)}>✕</button>
      </div>
    );
  }

  return (
    <div className="pl-release" onClick={e => e.stopPropagation()} ref={ref}>
      <button className="atr-btn" onClick={() => setDropOpen(v => !v)}>+ Release</button>
      {dropOpen && (
        <div className="atr-dropdown open">
          {releaseGroups.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              No groups yet{auth?.role === 'admin' ? ' — create one below' : ''}
            </div>
          )}
          {releaseGroups.map(g => (
            <button key={g.id} className="atr-dropdown-item" onClick={() => { setDropOpen(false); onTag(g.id, runIdx); }}>
              {g.name}
            </button>
          ))}
          {auth?.role === 'admin' && (
            <>
              <div className="atr-dropdown-divider" />
              <button className="atr-dropdown-item" onClick={() => setShowNewForm(v => !v)}>+ New Group</button>
              {showNewForm && (
                <div className="atr-new-form">
                  <input
                    className="finput atr-new-input"
                    type="text"
                    placeholder="Group name"
                    maxLength={128}
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { onCreateAndAdd(newGroupName, runIdx); setDropOpen(false); } }}
                    autoFocus
                  />
                  <button className="atr-create-btn" onClick={() => { onCreateAndAdd(newGroupName, runIdx); setDropOpen(false); }}>Create & Add</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunListPage({ onSelectWorkflow }) {
  const { repo: encodedRepo, wfId } = useParams();
  const repo = decodeURIComponent(encodedRepo);
  const workflowId = Number(wfId);
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  const [runs, setRuns] = useState([]);
  const [baseRuns, setBaseRuns] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [wfName, setWfName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingBranch, setLoadingBranch] = useState(false);
  const [branchCache, setBranchCache] = useState({});
  const [tagRun, setTagRun] = useState(null);
  const [tagGroupId, setTagGroupId] = useState(null);
  const [refreshingBtn, setRefreshingBtn] = useState(false);

  useEffect(() => {
    // Check if data already in context
    const rd = state.repoData[repo];
    const wf = rd?.workflows?.find(w => w.id === workflowId);
    if (wf) {
      setWfName(wf.name);
      setBaseRuns(wf.runs);
      setRuns(wf.runs);
      setDefaultBranch(rd.defaultBranch || '');
      setBranch(rd.defaultBranch || '');
      setBranches(rd.branches || []);
      setLoading(false);
      // Filter to default branch runs
      if (rd.defaultBranch) {
        filterBranch(wf.runs, rd.defaultBranch, {});
      }
    } else {
      loadWorkflowData();
    }
    // Load release groups and populate runGroupMap for tagged status
    apiGetReleases()
      .then(async groups => {
        dispatch({ type: 'SET_RELEASE_GROUPS', payload: groups });
        const map = {};
        await Promise.allSettled(groups.map(async g => {
          try {
            const pipelines = await apiGetReleasePipelines(g.id);
            for (const p of pipelines) {
              map[String(p.runId)] = { pipelineId: p.id, groupId: g.id, groupName: g.name };
            }
          } catch {}
        }));
        dispatch({ type: 'SET_RUN_GROUP_MAP', payload: map });
      })
      .catch(() => {});
  }, [repo, workflowId]);

  async function loadWorkflowData() {
    setLoading(true);
    try {
      const data = await GithubAPI.pipelineSummary(repo);
      const wf = data.workflows?.find(w => w.id === workflowId) || data.workflows?.[0];
      if (!wf) return;
      const wfRuns = wf.runsRaw?.workflow_runs || [];
      const db = data.defaultBranch || '';
      const brs = (data.branches || []).map(b => b.name || b);
      setWfName(wf.name);
      setBaseRuns(wfRuns);
      setDefaultBranch(db);
      setBranches(brs);
      dispatch({
        type: 'SET_REPO_DATA', repo,
        payload: {
          defaultBranch: db,
          branches: brs,
          workflows: data.workflows.map(w => ({ id: w.id, name: w.name, runs: w.runsRaw?.workflow_runs || [] })),
        },
      });
      if (db) {
        await filterBranch(wfRuns, db, {});
      } else {
        setRuns(wfRuns);
        setBranch('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function filterBranch(base, b, cache) {
    if (!b) { setRuns(base); setBranch(''); return; }
    if (cache[b]) { setRuns(cache[b]); setBranch(b); return; }
    setLoadingBranch(true);
    setBranch(b);
    try {
      const allRuns = await GithubAPI.allRunsForBranch(repo, workflowId, b);
      setBranchCache(prev => ({ ...prev, [b]: allRuns }));
      setRuns(allRuns);
    } catch {
      setRuns(base.filter(r => r.head_branch === b));
    } finally {
      setLoadingBranch(false);
    }
  }

  async function handleBranchChange(b) {
    if (!b) { setRuns(baseRuns); setBranch(''); return; }
    if (branchCache[b]) { setRuns(branchCache[b]); setBranch(b); return; }
    setLoadingBranch(true);
    setBranch(b);
    try {
      const allRuns = await GithubAPI.allRunsForBranch(repo, workflowId, b);
      setBranchCache(prev => ({ ...prev, [b]: allRuns }));
      setRuns(allRuns);
    } catch {
      setRuns(baseRuns.filter(r => r.head_branch === b));
    } finally {
      setLoadingBranch(false);
    }
  }

  async function handleRefresh() {
    setRefreshingBtn(true);
    await loadWorkflowData();
    setRefreshingBtn(false);
  }

  function handleOpenTag(groupId, runIdx) {
    setTagGroupId(groupId);
    setTagRun(runs[runIdx]);
  }

  async function handleRemoveFromGroup(groupId, pipelineId, runId) {
    try {
      await apiRemovePipeline(groupId, pipelineId);
      dispatch({ type: 'REMOVE_RUN_GROUP', runId });
      dispatch({ type: 'UPDATE_RELEASE_GROUP_COUNT', id: groupId, delta: -1 });
    } catch (e) {
      alert(`Failed to remove: ${e.message}`);
    }
  }

  async function handleCreateAndAdd(groupName, runIdx) {
    if (!groupName?.trim()) return;
    try {
      const group = await apiCreateRelease(groupName.trim());
      dispatch({ type: 'SET_RELEASE_GROUPS', payload: [...state.releaseGroups, { ...group, pipelineCount: 0 }] });
      setTagGroupId(group.id);
      setTagRun(runs[runIdx]);
    } catch (e) {
      alert(`Failed to create group: ${e.message}`);
    }
  }

  const allBranches = [...new Set([...branches, ...runs.map(r => r.head_branch).filter(Boolean)])].sort((a, b) => {
    if (a === defaultBranch) return -1;
    if (b === defaultBranch) return 1;
    return a.localeCompare(b);
  });

  return (
    <>
      <div className="view-header fade-up">
        <button className="btn-back" onClick={() => navigate('/')}>← Repositories</button>
        <div className="view-header-row">
          <span className="view-title">{shortRepo(repo).toUpperCase()}</span>
          <div className="filter-bar">
            <select
              className="branch-select"
              style={{ flex: 1, maxWidth: 'none' }}
              value={branch}
              onChange={e => handleBranchChange(e.target.value)}
              title="Filter by branch"
            >
              <option value="">⎇ All branches</option>
              {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <button className="btn-run-refresh" onClick={handleRefresh}>
              {refreshingBtn ? <Spin /> : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="state-box"><Spin size="lg" /></div>
      ) : loadingBranch ? (
        <div className="state-box">
          <Spin size="lg" />
          <span className="t2" style={{ marginLeft: 8 }}>Loading all runs for <em>{branch}</em>…</span>
        </div>
      ) : runs.length === 0 ? (
        <div className="state-box"><span className="t1">No runs{branch ? ` on ${branch}` : ''}</span></div>
      ) : (
        <div className="pipeline-list fade-up">
          <div className="pl-header">
            <div />
            <div>Run</div>
            <div>Branch</div>
            <div>Triggered by</div>
            <div>Duration</div>
            <div style={{ textAlign: 'right' }}>Started</div>
            <div style={{ textAlign: 'right' }}>Release</div>
          </div>
          {runs.map((run, idx) => {
            const cls = stCls(run.status, run.conclusion);
            const isRun = run.status === 'in_progress';
            const msg = (run.head_commit?.message || '').split('\n')[0] || '(no commit message)';
            const mergedDate = run.head_commit?.timestamp
              ? new Date(run.head_commit.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
              : null;
            return (
              <div
                key={run.id}
                className={`pl-row row-${cls}`}
                onClick={() => navigate(`/repo/${encodeURIComponent(repo)}/wf/${workflowId}/run/${run.id}`)}
              >
                <div className="pl-status-icon">
                  <StatusIcon status={run.status} conclusion={run.conclusion} />
                </div>
                <div className="pl-name">
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={msg}>
                    {msg}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    #{run.run_number} · <span className="sha">{sha7(run.head_sha)}</span> · {stLabel(run.status, run.conclusion)}
                    {mergedDate ? ` · Merged ${mergedDate}` : ''}
                  </div>
                </div>
                <div className="pl-branch">⎇ {run.head_branch}</div>
                <div className="pl-actor">👤 {run.triggering_actor?.login || '—'}</div>
                <div className="pl-dur">{run.created_at ? dur(run.created_at, isRun ? null : run.updated_at) : '—'}</div>
                <div className="pl-time">
                  <a href={run.html_url} target="_blank" rel="noopener"
                     onClick={e => e.stopPropagation()}
                     style={{ color: 'var(--accent)', fontSize: 11, textDecoration: 'none', float: 'right' }}>↗</a>
                  <span>{ago(run.created_at)}</span>
                </div>
                <ReleaseCell
                  run={run}
                  runIdx={idx}
                  releaseGroups={state.releaseGroups}
                  runGroupMap={state.runGroupMap}
                  auth={state.auth}
                  onTag={handleOpenTag}
                  onRemove={handleRemoveFromGroup}
                  onCreateAndAdd={handleCreateAndAdd}
                />
                {isRun && <div className="pl-live-bar"><div className="pl-live-fill" /></div>}
              </div>
            );
          })}
        </div>
      )}

      {tagRun && tagGroupId && (
        <TagPipelineDialog
          open
          run={tagRun}
          repo={repo}
          groupId={tagGroupId}
          groupName={state.releaseGroups.find(g => g.id === tagGroupId)?.name || ''}
          onClose={success => {
            setTagRun(null);
            setTagGroupId(null);
          }}
          onTagged={(runId, pipelineId, groupId, groupName) => {
            dispatch({ type: 'UPDATE_RUN_GROUP', runId, payload: { pipelineId, groupId, groupName } });
            dispatch({ type: 'UPDATE_RELEASE_GROUP_COUNT', id: groupId, delta: 1 });
          }}
        />
      )}
    </>
  );
}
