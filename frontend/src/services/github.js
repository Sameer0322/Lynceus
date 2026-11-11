// GitHub proxy calls — routed through the backend (/api/github/*)
import { API_BASE } from './api.js';

function _ghHeaders() {
  return { 'Authorization': `Bearer ${sessionStorage.getItem('pd_jwt') || ''}` };
}

async function _ghGet(path, params = {}) {
  const url = new URL(API_BASE + '/api/github' + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url.toString(), { headers: _ghHeaders() });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`GitHub proxy ${r.status} – ${path} – ${msg}`);
  }
  return r.json();
}

export const GithubAPI = {
  workflows: (repo) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/workflows`).then(d => d.workflows || []);
  },
  runs: (repo, wfId, n = 100) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/workflows/${wfId}/runs`, { per_page: n }).then(d => d.workflow_runs || []);
  },
  allRunsForBranch: async (repo, wfId, branch) => {
    const [org, name] = repo.split('/', 2);
    const allRuns = [];
    let page = 1;
    while (true) {
      const data = await _ghGet(`/${org}/${name}/workflows/${wfId}/runs`, { per_page: 100, branch, page });
      const runs = data.workflow_runs || [];
      allRuns.push(...runs);
      if (runs.length < 100) break;
      page++;
    }
    return allRuns;
  },
  run: (repo, runId) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/runs/${runId}`);
  },
  jobs: (repo, runId) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/runs/${runId}/jobs`, { per_page: 100 }).then(d => d.jobs || []);
  },
  branches: (repo) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/branches`, { per_page: 100 }).then(d => d.map(b => b.name));
  },
  repoInfo: (repo) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/info`).then(d => d.default_branch || 'main');
  },
  rateLimitAll: () => _ghGet('/rate-limit-all'),
  pipelineSummary: (repo) => {
    const [org, name] = repo.split('/', 2);
    return _ghGet(`/${org}/${name}/pipeline-summary`);
  },
};
