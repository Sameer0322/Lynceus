import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { apiGetTeams } from '../services/api.js';
import { GithubAPI } from '../services/github.js';
import { stCls, shortRepo, ago, sha7 } from '../utils.js';

function Spin({ size = 'sm' }) { return <span className={`spin spin-${size}`} />; }

function Badge({ cls }) {
  if (cls === 'running') return <span className="badge badge-running"><Spin /> Running</span>;
  if (cls === 'failure') return <span className="badge badge-failure">✗ Failed</span>;
  if (cls === 'waiting') return <span className="badge badge-waiting">⏸ Waiting</span>;
  if (cls === 'success') return <span className="badge badge-success">✓ Passing</span>;
  return <span className="badge badge-review">⏸ Review Required</span>;
}

export default function PipelinesPage({ onRefreshSignal, onSelectWorkflow }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [localSelected, setLocalSelected] = useState(new Set(state.selectedTeams));
  const [prevSelected, setPrevSelected] = useState(new Set());
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  // Load teams once
  useEffect(() => {
    apiGetTeams()
      .then(teams => dispatch({ type: 'SET_TEAMS', payload: teams }))
      .catch(() => {});
  }, []);

  // Sync localSelected when state.selectedTeams changes (e.g. on mount)
  useEffect(() => {
    setLocalSelected(new Set(state.selectedTeams));
  }, []);

  const loadRepo = useCallback(async (repo) => {
    dispatch({ type: 'SET_REPO_LOADING', repo, loading: true });
    try {
      const data = await GithubAPI.pipelineSummary(repo);
      dispatch({
        type: 'SET_REPO_DATA', repo,
        payload: {
          defaultBranch: data.defaultBranch,
          branches: (data.branches || []).map(b => b.name || b),
          workflows: (data.workflows || []).map(wf => ({
            id: wf.id,
            name: wf.name,
            runs: wf.runsRaw?.workflow_runs || [],
          })),
          error: null,
        },
      });
    } catch (e) {
      dispatch({ type: 'SET_REPO_DATA', repo, payload: { error: e.message, workflows: [] } });
    }
  }, [dispatch]);

  // Load repos for selected teams
  useEffect(() => {
    if (state.selectedTeams.size === 0) return;
    const repos = [...state.selectedTeams]
      .flatMap(i => (state.teams[i]?.repos || []).map(r => typeof r === 'string' ? r : r.repo));
    repos.forEach(r => { if (!state.repoData[r]?.workflows) loadRepo(r); });
  }, [state.selectedTeams, state.teams]);

  // Refresh signal
  useEffect(() => {
    if (!onRefreshSignal) return;
    const repos = [...state.selectedTeams]
      .flatMap(i => (state.teams[i]?.repos || []).map(r => typeof r === 'string' ? r : r.repo));
    repos.forEach(loadRepo);
  }, [onRefreshSignal]);

  function confirmSelection() {
    if (localSelected.size === 0) return;
    localStorage.setItem('pd_selectedTeams', JSON.stringify([...localSelected]));
    dispatch({ type: 'SET_SELECTED_TEAMS', payload: localSelected });
  }

  function switchTeam() {
    setPrevSelected(new Set(state.selectedTeams));
    dispatch({ type: 'SET_SELECTED_TEAMS', payload: new Set() });
    setLocalSelected(new Set());
  }

  function cancelPicker() {
    if (prevSelected.size === 0) return;
    setLocalSelected(new Set(prevSelected));
    dispatch({ type: 'SET_SELECTED_TEAMS', payload: prevSelected });
    setPrevSelected(new Set());
  }

  function toggleLocalTeam(idx) {
    setLocalSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleSection(idx) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleRepoClick(repo) {
    const rd = state.repoData[repo] || {};
    if (!rd.workflows?.length) {
      loadRepo(repo).then(() => {});
      return;
    }
    const wf = rd.workflows[0];
    if (wf) {
      onSelectWorkflow(repo, wf.id);
    }
  }

  // ── Team picker ───────────────────────────────────────────────────────────
  if (state.selectedTeams.size === 0) {
    if (!state.teams.length) {
      return (
        <div className="state-box">
          <Spin size="lg" />
          <span className="t1">Loading teams…</span>
        </div>
      );
    }
    return (
      <div className="team-picker">
        <div className="team-picker-title">Select your teams</div>
        <div className="team-picker-subtitle">Select one or more teams to view their pipelines.</div>
        <div className="team-picker-grid">
          {state.teams.map((team, idx) => {
            const repos = (team.repos || []).map(r => typeof r === 'string' ? r : r.repo);
            const sel = localSelected.has(idx);
            return (
              <div key={idx} className={`team-picker-card${sel ? ' selected' : ''}`} onClick={() => toggleLocalTeam(idx)}>
                {sel && <span className="team-picker-check">✓</span>}
                <div className="team-picker-name">{team.name}</div>
                <div className="team-picker-meta">{repos.length} repo{repos.length !== 1 ? 's' : ''}</div>
              </div>
            );
          })}
        </div>
        {localSelected.size > 0 && (
          <button className="btn-save team-picker-confirm" onClick={confirmSelection}>
            View Pipelines ({localSelected.size} team{localSelected.size !== 1 ? 's' : ''})
          </button>
        )}
        {prevSelected.size > 0 && (
          <button className="btn-icon team-picker-cancel" onClick={cancelPicker}>Cancel</button>
        )}
      </div>
    );
  }

  // ── Repo list ─────────────────────────────────────────────────────────────
  const visibleTeams = state.teams
    .map((team, idx) => ({ team, idx }))
    .filter(({ idx }) => state.selectedTeams.has(idx));

  const teamNames = [...state.selectedTeams].map(i => state.teams[i]?.name).filter(Boolean);
  const teamLabel = teamNames.length <= 3
    ? teamNames.map((n, i) => <React.Fragment key={i}>{i > 0 ? ', ' : ''}<strong>{n}</strong></React.Fragment>)
    : <strong>{teamNames.length} teams</strong>;

  return (
    <div className="fade-up">
      <div className="team-switch-bar">
        Showing: {teamLabel}
        <button className="btn-icon" onClick={switchTeam}>Switch Teams</button>
      </div>

      {visibleTeams.map(({ team, idx }) => {
        const repos = (team.repos || []).map(r => typeof r === 'string' ? r : r.repo);
        const collapsed = collapsedSections.has(idx);

        // Team stats
        let ok = 0, fail = 0, run = 0;
        for (const repo of repos) {
          const rd = state.repoData[repo] || {};
          const db = rd.defaultBranch;
          for (const wf of (rd.workflows || [])) {
            const r = db ? (wf.runs.find(r => r.head_branch === db) ?? wf.runs[0]) : wf.runs[0];
            if (!r) continue;
            const c = stCls(r.status, r.conclusion);
            if (c === 'success') ok++;
            else if (c === 'failure') fail++;
            else if (c === 'running') run++;
          }
        }

        return (
          <div className="team-section" key={idx}>
            <div className="team-section-header" onClick={() => toggleSection(idx)}>
              <span className={`team-chevron${collapsed ? '' : ' open'}`}>▶</span>
              <span className="team-section-title">{team.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repos.length} repos</span>
              <div className="team-stat-row">
                {run > 0 && <span className="stat-chip chip-running"><Spin /> {run} running</span>}
                {ok > 0 && <span className="stat-chip chip-success">✓ {ok}</span>}
                {fail > 0 && <span className="stat-chip chip-failure">✗ {fail}</span>}
              </div>
            </div>

            {!collapsed && (
              <div className="repo-list">
                {repos.map(repo => {
                  const rd = state.repoData[repo] || {};
                  if (rd.loading && !rd.workflows) {
                    return (
                      <div className="repo-list-row" key={repo} onClick={() => handleRepoClick(repo)}>
                        <div className="repo-row-main">
                          <div className="repo-row-top">
                            <span className="badge badge-running repo-card-loading-badge"><Spin /> Loading…</span>
                            <span className="repo-row-name">{shortRepo(repo)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const db = rd.defaultBranch;
                  const workflows = rd.workflows || [];
                  let ok2 = 0, fail2 = 0, run2 = 0, waiting2 = 0;
                  let lastUpdated = null;
                  for (const wf of workflows) {
                    const r = db ? (wf.runs.find(r => r.head_branch === db) ?? wf.runs[0]) : wf.runs[0];
                    if (!r) continue;
                    const c = stCls(r.status, r.conclusion);
                    if (c === 'success') ok2++;
                    else if (c === 'failure') fail2++;
                    else if (c === 'running') run2++;
                    else if (c === 'waiting') waiting2++;
                    const t = new Date(r.updated_at || r.created_at);
                    if (!lastUpdated || t > lastUpdated) lastUpdated = t;
                  }

                  const overallCls = run2 > 0 ? 'running' : fail2 > 0 ? 'failure' : waiting2 > 0 ? 'waiting' : ok2 > 0 ? 'success' : 'pending';
                  const wf0 = workflows[0];
                  const latestRun = db ? (wf0?.runs.find(r => r.head_branch === db) ?? wf0?.runs[0]) : wf0?.runs[0];
                  const commitMsg = (latestRun?.head_commit?.message || '').split('\n')[0];
                  const commitBranch = latestRun?.head_branch || '';
                  const commitSha = sha7(latestRun?.head_sha || '');
                  const actionsUrl = `https://github.com/${repo}/actions`;

                  return (
                    <div className={`repo-list-row row-${overallCls}`} key={repo} onClick={() => handleRepoClick(repo)}>
                      <div className="repo-row-main">
                        <div className="repo-row-top">
                          <Badge cls={overallCls} />
                          <span className="repo-row-name">{shortRepo(repo)}</span>
                          {commitBranch && <span className="repo-row-branch">⎇ {commitBranch}</span>}
                        </div>
                        {commitMsg && (
                          <div className="repo-row-commit">
                            <span className="sha">{commitSha}</span>{commitMsg}
                          </div>
                        )}
                        {rd.error && <div className="repo-row-error">⚠ {rd.error}</div>}
                      </div>
                      <div className="repo-row-center">
                        {lastUpdated && <span className="repo-row-time">{ago(lastUpdated.toISOString())}</span>}
                      </div>
                      <a className="ext-link" href={actionsUrl} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>
                        View in GitHub Actions ↗
                      </a>
                      <button
                        className="btn-repo-refresh"
                        title="Refresh"
                        onClick={e => { e.stopPropagation(); loadRepo(repo); }}
                      >
                        <span className="refresh-icon">↻</span>
                      </button>
                      {run2 > 0 && <div className="pl-live-bar"><div className="pl-live-fill" /></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
