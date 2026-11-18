#!/usr/bin/env node
'use strict';

const http = require('http');
const PORT = 3001;

function ago(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

const COMMITS = [
  'feat: add user authentication flow',
  'fix: resolve null pointer in service layer',
  'chore: update dependencies to latest versions',
  'feat: implement dashboard metrics endpoint',
  'fix: handle edge case in data processing',
  'refactor: extract common utilities',
  'test: add integration tests for auth module',
  'docs: update API documentation',
  'feat: add rate limiting to public endpoints',
  'fix: memory leak in connection pool',
  'ci: bump node version to 22',
  'feat: paginate results on list endpoints',
];

function makeRun(id, wfId, repoFullName, status, conclusion, commitIdx, branch, runNumber) {
  return {
    id,
    workflow_id: wfId,
    name: 'run #' + runNumber,
    head_branch: branch || 'main',
    head_sha: id.toString(16).padStart(8, '0') + 'deadbeef',
    run_number: runNumber,
    status,
    conclusion: status === 'completed' ? conclusion : null,
    created_at: ago(runNumber * 20),
    updated_at: ago(runNumber * 20 - 4),
    html_url: `https://github.com/${repoFullName}/actions/runs/${id}`,
    head_commit: {
      id: id.toString(16).padStart(8, '0'),
      message: COMMITS[commitIdx % COMMITS.length],
      author: { name: 'Demo User', email: 'demo@example.com' },
    },
    repository: { id: 1, full_name: repoFullName },
  };
}

function makeJobs(runId, status, conclusion) {
  const done = status === 'completed';
  const jc = done ? conclusion : null;
  return {
    total_count: 3,
    jobs: [
      {
        id: runId * 10 + 1, run_id: runId, name: 'Build',
        status: 'completed', conclusion: 'success',
        started_at: ago(6), completed_at: ago(4),
        steps: [
          { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1 },
          { name: 'Checkout code', status: 'completed', conclusion: 'success', number: 2 },
          { name: 'Install dependencies', status: 'completed', conclusion: 'success', number: 3 },
          { name: 'Build', status: 'completed', conclusion: 'success', number: 4 },
        ],
      },
      {
        id: runId * 10 + 2, run_id: runId, name: 'Test',
        status: done ? 'completed' : 'in_progress',
        conclusion: jc,
        started_at: ago(4), completed_at: done ? ago(2) : null,
        steps: [
          { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1 },
          { name: 'Run unit tests', status: done ? 'completed' : 'in_progress', conclusion: jc, number: 2 },
          { name: 'Upload coverage', status: done ? 'completed' : 'queued', conclusion: done ? 'success' : null, number: 3 },
        ],
      },
      {
        id: runId * 10 + 3, run_id: runId, name: 'Lint',
        status: 'completed', conclusion: 'success',
        started_at: ago(5), completed_at: ago(3),
        steps: [
          { name: 'Set up job', status: 'completed', conclusion: 'success', number: 1 },
          { name: 'Run ESLint', status: 'completed', conclusion: 'success', number: 2 },
        ],
      },
    ],
  };
}

// ── Repo definitions ─────────────────────────────────────────────────────────

const REPOS = {
  'demo-org/frontend-app': {
    defaultBranch: 'main',
    branches: ['main', 'develop', 'feature/new-dashboard', 'fix/login-bug'],
    workflows: [
      {
        id: 1001, name: 'CI',
        runs: [
          makeRun(10001, 1001, 'demo-org/frontend-app', 'in_progress', null,     0, 'feature/new-dashboard', 1),
          makeRun(10002, 1001, 'demo-org/frontend-app', 'completed',   'success', 1, 'main',                  2),
          makeRun(10003, 1001, 'demo-org/frontend-app', 'completed',   'failure', 2, 'main',                  3),
          makeRun(10004, 1001, 'demo-org/frontend-app', 'completed',   'success', 3, 'develop',               4),
          makeRun(10005, 1001, 'demo-org/frontend-app', 'completed',   'success', 4, 'main',                  5),
        ],
      },
      {
        id: 1002, name: 'Deploy to Production',
        runs: [
          makeRun(10101, 1002, 'demo-org/frontend-app', 'completed', 'success',   5, 'main',    1),
          makeRun(10102, 1002, 'demo-org/frontend-app', 'completed', 'success',   6, 'main',    2),
          makeRun(10103, 1002, 'demo-org/frontend-app', 'completed', 'cancelled', 7, 'develop', 3),
        ],
      },
    ],
  },
  'demo-org/backend-api': {
    defaultBranch: 'main',
    branches: ['main', 'develop', 'feature/auth-refactor', 'hotfix/db-connection'],
    workflows: [
      {
        id: 2001, name: 'CI',
        runs: [
          makeRun(20001, 2001, 'demo-org/backend-api', 'completed', 'failure', 8, 'main',    1),
          makeRun(20002, 2001, 'demo-org/backend-api', 'completed', 'success', 9, 'main',    2),
          makeRun(20003, 2001, 'demo-org/backend-api', 'completed', 'success', 0, 'develop', 3),
          makeRun(20004, 2001, 'demo-org/backend-api', 'completed', 'success', 1, 'main',    4),
        ],
      },
      {
        id: 2002, name: 'Security Scan',
        runs: [
          makeRun(20101, 2002, 'demo-org/backend-api', 'completed', 'success', 10, 'main', 1),
          makeRun(20102, 2002, 'demo-org/backend-api', 'completed', 'success', 11, 'main', 2),
        ],
      },
    ],
  },
  'demo-org/mobile-app': {
    defaultBranch: 'main',
    branches: ['main', 'release/v2.1', 'develop'],
    workflows: [
      {
        id: 3001, name: 'Build & Test',
        runs: [
          makeRun(30001, 3001, 'demo-org/mobile-app', 'completed', 'success', 3, 'main',         1),
          makeRun(30002, 3001, 'demo-org/mobile-app', 'completed', 'success', 4, 'main',         2),
          makeRun(30003, 3001, 'demo-org/mobile-app', 'completed', 'success', 5, 'release/v2.1', 3),
        ],
      },
    ],
  },
  'demo-org/data-pipeline': {
    defaultBranch: 'main',
    branches: ['main', 'develop'],
    workflows: [
      {
        id: 4001, name: 'Data Processing',
        runs: [
          makeRun(40001, 4001, 'demo-org/data-pipeline', 'in_progress', null,     6, 'main', 1),
          makeRun(40002, 4001, 'demo-org/data-pipeline', 'completed',   'success', 7, 'main', 2),
          makeRun(40003, 4001, 'demo-org/data-pipeline', 'completed',   'success', 8, 'main', 3),
        ],
      },
    ],
  },
};

// Flat index for single-run lookups
const RUNS_INDEX = {};
for (const repo of Object.values(REPOS)) {
  for (const wf of repo.workflows) {
    for (const run of wf.runs) {
      RUNS_INDEX[run.id] = run;
    }
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

function getRepo(org, name) {
  return REPOS[`${org}/${name}`] || {
    defaultBranch: 'main',
    branches: ['main', 'develop'],
    workflows: [{
      id: 9001, name: 'CI',
      runs: [makeRun(90001, 9001, `${org}/${name}`, 'completed', 'success', 0, 'main', 1)],
    }],
  };
}

// ── Server ───────────────────────────────────────────────────────────────────

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const parts = url.split('/').filter(Boolean);
  console.log(`[mock-gh] ${req.method} ${url}`);

  // GET /rate_limit
  if (url === '/rate_limit') {
    return send(res, 200, {
      rate: { limit: 5000, remaining: 4876, reset: Math.floor(Date.now() / 1000) + 3600, used: 124 },
      resources: { core: { limit: 5000, remaining: 4876 } },
    });
  }

  if (parts[0] !== 'repos' || parts.length < 3) {
    return send(res, 404, { message: 'Not Found' });
  }

  const org      = parts[1];
  const repoName = parts[2];
  const repo     = getRepo(org, repoName);
  const full     = `${org}/${repoName}`;
  const rest     = parts.slice(3);

  // GET /repos/:org/:repo
  if (rest.length === 0) {
    return send(res, 200, { id: 1, name: repoName, full_name: full, private: false,
      default_branch: repo.defaultBranch, description: `Demo repository: ${full}`,
      html_url: `https://github.com/${full}` });
  }

  // GET /repos/:org/:repo/branches
  if (rest[0] === 'branches' && rest.length === 1) {
    return send(res, 200, repo.branches.map(n => ({
      name: n,
      commit: { sha: n.length.toString(16).padStart(40, '0') },
      protected: n === 'main',
    })));
  }

  // GET /repos/:org/:repo/actions/workflows
  if (rest[0] === 'actions' && rest[1] === 'workflows' && rest.length === 2) {
    const wfs = repo.workflows.map(wf => ({
      id: wf.id, name: wf.name, state: 'active',
      path: `.github/workflows/${wf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yml`,
      html_url: `https://github.com/${full}/actions/workflows/${wf.id}`,
    }));
    return send(res, 200, { total_count: wfs.length, workflows: wfs });
  }

  // GET /repos/:org/:repo/actions/workflows/:wfId/runs
  if (rest[0] === 'actions' && rest[1] === 'workflows' && rest.length === 4 && rest[3] === 'runs') {
    const wfId = parseInt(rest[2]);
    const wf = repo.workflows.find(w => w.id === wfId);
    const runs = wf ? wf.runs : [];
    return send(res, 200, { total_count: runs.length, workflow_runs: runs });
  }

  // GET /repos/:org/:repo/actions/runs/:runId  (single run)
  if (rest[0] === 'actions' && rest[1] === 'runs' && rest.length === 3) {
    const runId = parseInt(rest[2]);
    return send(res, 200, RUNS_INDEX[runId] || makeRun(runId, 9001, full, 'completed', 'success', 0, 'main', 1));
  }

  // GET /repos/:org/:repo/actions/runs/:runId/jobs
  if (rest[0] === 'actions' && rest[1] === 'runs' && rest.length === 4 && rest[3] === 'jobs') {
    const runId = parseInt(rest[2]);
    const run = RUNS_INDEX[runId];
    return send(res, 200, makeJobs(runId, run?.status || 'completed', run?.conclusion || 'success'));
  }

  return send(res, 404, { message: 'Not Found' });

}).listen(PORT, () => {
  console.log(`\n✓ Mock GitHub server running at http://localhost:${PORT}`);
  console.log('  Repos: demo-org/frontend-app, demo-org/backend-api, demo-org/mobile-app, demo-org/data-pipeline\n');
});
