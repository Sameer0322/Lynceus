# Lynceaus

A self-hosted **release tracking dashboard** built on top of GitHub Actions. Most CI dashboards show per-repo status — Lynceaus aggregates runs across many repos into logical teams, and lets you tag runs into named release groups (sprints, milestones) that you manage entirely through the UI, with no config files or redeployments needed.

- **Cross-repo team view** — group any number of repos into a team, see pass/fail/running status at a glance
- **Release groups** — tag runs into named groups (e.g. sprint numbers), drag to reorder
- **Drill into run history** — last 100 runs per workflow, filterable by branch
- **Stage view** — inspect individual jobs and their durations
- **Admin panel** — manage teams, repos, users and release groups through the UI, no code deploys needed
- **PAT stays server-side** — all GitHub API calls are proxied through the backend; your token never reaches the browser
- **Works with any GitHub repos** — org repos, personal repos, or public repos
- **Dark / light mode** — follows your OS preference

---

## Quick start

**Option A — Docker Compose (one command)**

```bash
export GITHUB_TOKEN=ghp_yourTokenHere
export JWT_SECRET=a-random-string-at-least-32-characters-long
export ADMIN_PASSWORD=YourAdminPassword
docker-compose up --build
# Backend at :8080, frontend at :5173
```

**Option B — Manual**

### 1. Backend

The backend is a Java 21 / Spring Boot service. It proxies all GitHub API calls (your PAT stays server-side) and stores team + release data in an embedded H2 database.

```bash
# Copy and fill in your config
cp backend/srv/src/main/resources/application.yaml.example \
   backend/srv/src/main/resources/application.yaml
# Edit application.yaml — set github-token, jwt-secret, admin password

# Build and run (starts on :8080)
cd backend
mvn spring-boot:run -pl srv
```

**Key config values** (`application.yaml`):

| Key | Description |
|---|---|
| `app.github-token` | GitHub Personal Access Token (needs `repo` + `actions:read` scopes — or `public_repo` for public-only repos) |
| `app.github-api-url` | `https://api.github.com` for GitHub.com; `https://your-ghe-host/api/v3` for GitHub Enterprise |
| `app.jwt-secret` | Random string ≥ 32 characters — used to sign session tokens |
| `app.admin.password` | Initial admin password (change via the UI after first login) |
| `app.allowed-origin` | URL of your frontend — `http://localhost:5173` for local dev |
| `app.workflow-name` | Leave blank to show all workflows; set to filter by exact name (e.g. `"CI"`) |

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# .env.local already points VITE_API_BASE to http://localhost:8080 — no edits needed for local dev
npm install
npm run dev   # opens at http://localhost:5173
```

### 3. Add your repos

Log in with username `admin` and the password from your config. Open the **Admin Panel** (lock icon in the header) → **Teams** tab. Add teams and repos in `owner/repo` format:

- GitHub org: `my-company/backend-service`
- Personal account: `alice/my-project`
- Any public repo: `octocat/Hello-World`

---

## Authentication

On first startup the backend creates one admin account using `app.admin.username` (default: `admin`) and `app.admin.password`. These values are **only used on first startup** — after that, user accounts are managed entirely through the UI.

**Admin Panel → Users tab:**
- Admin can **add** new users with an initial password (users can change it after logging in)
- Admin can **delete** users (except their own account)
- Admin can **reset** any user's password
- Admin can **change** a user's role (promote to admin / demote to viewer)
- Users cannot modify their own role or delete their own account

| Role | Capabilities |
|---|---|
| `admin` | Manage teams, repos, users, and release groups |
| `viewer` | View pipelines, tag runs into release groups |

Login is rate-limited: 10 failed attempts within 5 minutes locks the IP out for 15 minutes.

---

## Deploy on Render + Vercel

See [Manual.md](Manual.md) for a step-by-step deployment guide including environment variable reference, persistent storage setup, and GitHub Enterprise configuration.

**Short version:**
1. Fork this repo.
2. Connect the fork to Render — it reads `render.yaml` automatically. Set `GITHUB_TOKEN`, `ALLOWED_ORIGIN`, and `ADMIN_PASSWORD` in the Render dashboard.
3. Import the fork into Vercel, set root directory to `frontend`, set `VITE_API_BASE` to your Render URL.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, Material UI v5 |
| Backend | Java 21, Spring Boot, Spring JDBC |
| Database | H2 (local dev + Render); PostgreSQL (via `postgres` profile) |
| Auth | JWT — admin logs in with username + password; admin manages other users |
| GitHub proxy | All GitHub API calls go through the backend — PAT never reaches the browser |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[Apache 2.0](LICENSE)
