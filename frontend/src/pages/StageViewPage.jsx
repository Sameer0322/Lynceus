import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GithubAPI } from '../services/github.js';
import { stCls, stLabel, stIconText, dur, sha7, shortRepo } from '../utils.js';

function Spin({ size = 'sm' }) { return <span className={`spin spin-${size}`} />; }

function StatusIcon({ status, conclusion }) {
  if (status === 'in_progress' || status === 'queued') return <Spin size="sm" />;
  return <>{stIconText(status, conclusion)}</>;
}

export default function StageViewPage() {
  const { repo: encodedRepo, wfId, runId } = useParams();
  const repo = decodeURIComponent(encodedRepo);
  const workflowId = Number(wfId);
  const navigate = useNavigate();

  const [run, setRun] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [wfName, setWfName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, [runId]);

  async function loadData(opts = {}) {
    if (opts.refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [runData, jobsData] = await Promise.all([
        GithubAPI.run(repo, runId),
        GithubAPI.jobs(repo, runId),
      ]);
      setRun(runData);
      setJobs(jobsData);
      if (!wfName && runData) {
        setWfName(runData.name || `Workflow #${workflowId}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const mergedDate = run?.head_commit?.timestamp
    ? new Date(run.head_commit.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`drilldown fade-up`}>
      <div className="dd-header">
        <button className="btn-back" onClick={() => navigate(`/repo/${encodeURIComponent(repo)}/wf/${wfId}`)}>← Runs</button>
        <div>
          <div className="dd-title">
            {wfName || `Workflow #${workflowId}`}
            {run && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 14 }}> #{run.run_number}</span>}
          </div>
          <div className="dd-repo">{repo}</div>
        </div>
        {run && (
          <a className="ext-link" href={run.html_url} target="_blank" rel="noopener">Open in GitHub ↗</a>
        )}
        <button
          className="btn-repo-refresh"
          title="Refresh stages"
          onClick={() => loadData({ refresh: true })}
        >
          {refreshing ? <Spin size="sm" /> : <span className="refresh-icon">↻</span>}
        </button>
      </div>

      {run && (
        <div className="run-summary">
          <span>Branch <strong>{run.head_branch}</strong></span>
          <span>SHA <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{sha7(run.head_sha)}</code></span>
          <span>By <strong>{run.triggering_actor?.login || '—'}</strong></span>
          <span>Duration <strong>{dur(run.created_at, run.updated_at)}</strong></span>
          <span>Event <strong>{run.event || '—'}</strong></span>
          {mergedDate && <span>Merged <strong>{mergedDate}</strong></span>}
        </div>
      )}

      {loading ? (
        <div className="jobs-list">
          <div className="state-box" style={{ height: 100 }}><Spin size="lg" /></div>
        </div>
      ) : (
        <div className="jobs-list">
          {jobs.length === 0 ? (
            <div className="state-box"><span className="t1">No jobs found</span></div>
          ) : jobs.map(job => {
            const cls = stCls(job.status, job.conclusion);
            return (
              <div key={job.id} className={`job-card job-${cls}`}>
                <div className="job-header" style={{ cursor: 'default' }}>
                  <span style={{ fontSize: 13 }}>
                    <StatusIcon status={job.status} conclusion={job.conclusion} />
                  </span>
                  <span className={`badge badge-${cls}`} style={{ fontSize: 11 }}>
                    {stLabel(job.status, job.conclusion)}
                  </span>
                  <span className="job-name">{job.name}</span>
                  <span className="job-dur">
                    {job.started_at ? dur(job.started_at, job.completed_at) : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
