# Lynceaus — Operations Manual

A step-by-step guide for cloning, configuring, and deploying the dashboard.

---

## Table of contents

1. [What you need](#1-what-you-need)
2. [Local development](#2-local-development)
3. [GitHub PAT — what scope you need](#3-github-pat--what-scope-you-need)
4. [Configuring repos — org, team, or personal](#4-configuring-repos--org-team-or-personal)
5. [Deploy to Render + Vercel (recommended)](#5-deploy-to-render--vercel-recommended)
6. [First login and user management](#6-first-login-and-user-management)
7. [Environment variable reference](#7-environment-variable-reference)

---

## 1. What you need

| Tool | Version | Notes |
|---|---|---|
| Java | 21+ | For building / running the backend |
| Maven | 3.9+ | `mvn --version` to check |
| Node.js | 18+ | For building / running the frontend |
| Git | any | For cloning the repo |

For cloud deployment:
- A [Render](https://render.com) account (free tier works for the backend; persistent disk requires a paid plan)
- A [Vercel](https://vercel.com) account (free tier is enough for the frontend)

---

## 2. Local development

### 2a. Clone and set up the backend

```bash
git clone https://github.com/your-fork/lynceaus.git
cd lynceaus

# Copy the example config
cp backend/srv/src/main/resources/application.yaml.example \
   backend/srv/src/main/resources/application.yaml
```

Open `backend/srv/src/main/resources/application.yaml` and fill in:

```yaml
app:
  github-token: "ghp_yourTokenHere"   # see section 3
  jwt-secret: "a-random-string-at-least-32-characters-long"
  admin:
    password: "YourAdminPassword"     # change after first login
  allowed-origin: "http://localhost:5173"
```

Start the backend (runs on port 8080):

```bash
cd backend
mvn spring-boot:run -pl srv
```

### 2b. Set up the frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local — set VITE_API_BASE to http://localhost:8080
npm install
npm run dev   # opens at http://localhost:5173
```

The default `VITE_API_BASE=http://localhost:8080` in `.env.example` is correct for local dev.

### 2c. Verify it works

1. Open `http://localhost:5173`.
2. Click the lock icon in the header to log in: username `admin`, password from your config.
3. Open the Admin Panel → Teams tab, add a team, and add repos in `owner/repo` format (see section 4).
4. The Pipelines page will start showing your GitHub Actions runs.

---

## 3. GitHub PAT — what scope you need

Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**.

Create a token with these scopes:

| Scope | Why |
|---|---|
| `repo` | Read private repository info and Actions data |
| `workflow` (read) | List and read workflow runs |

> **Fine-grained PATs:** If you use a fine-grained token, grant **Actions: Read** and **Contents: Read** for each repository you want to monitor.

> **Public repos only?** If all your repos are public, a token with no scopes (or just `public_repo`) is enough.

You can add a second token (`GITHUB_TOKEN_SECONDARY`) as a fallback if the primary hits GitHub's rate limit (5 000 requests/hour per token).

---

## 4. Configuring repos — org, team, or personal

Repos are added through the **Admin Panel → Teams** tab (no config files needed). The format is always `owner/repo`:

| Scenario | Example |
|---|---|
| GitHub org | `my-company/backend-service` |
| Personal account | `alice/my-project` |
| Another user's public repo | `octocat/Hello-World` |

There is no restriction on org vs. personal. Any GitHub repo your PAT can access will work.

**GitHub Enterprise:** Set `GITHUB_API_URL` to `https://your-ghe-host/api/v3` instead of the default `https://api.github.com`.

---

## 5. Deploy to Render + Vercel (recommended)

### 5a. Fork the repo

Fork this repository on GitHub so Render and Vercel can connect to it.

### 5b. Backend + Database → Render

The `render.yaml` blueprint creates two resources automatically: a **PostgreSQL database** (`pipeline-db`) and a **Docker web service** (`lynceaus-backend`). The backend is wired to the database via `JDBC_DATABASE_URL` — no manual connection string needed.

1. In [Render](https://render.com), click **New → Blueprint**.
2. Connect your fork. Render reads `render.yaml` and creates both the database and the web service.
3. Set the following environment variables in the Render dashboard (marked `sync: false` in `render.yaml` — you must set these manually):

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Your GitHub PAT (see section 3) |
| `ALLOWED_ORIGIN` | Your Vercel frontend URL — e.g. `https://my-dashboard.vercel.app` (fill this in after step 5c) |
| `ADMIN_PASSWORD` | The admin password you want to use |

4. (Optional) Add `GITHUB_TOKEN_SECONDARY` for a second PAT.
5. Deploy. The first deploy runs the schema migrations and bootstraps the `admin` user automatically.

> **Database tier:** Render's free PostgreSQL tier expires after 90 days, after which it costs ~$7/month. The schema is small and low-write, so the free tier is sufficient for initial use.

### 5c. Frontend → Vercel

1. In [Vercel](https://vercel.com), click **Add New → Project** and import your fork.
2. Set **Root directory** to `frontend`.
3. Add these environment variables:

| Variable | Value |
|---|---|
| `VITE_API_BASE` | Your Render backend URL — e.g. `https://lynceaus-backend.onrender.com` |
| `VITE_WORKFLOW_NAME` | Optional — filter to one workflow name; leave blank to show all |

4. Deploy. Vercel detects Vite automatically.

> **CORS:** `ALLOWED_ORIGIN` on the backend must match your Vercel URL exactly (no trailing slash).

---

## 6. First login and user management

### Default admin account

On first startup the backend creates one admin user:

| Field | Default |
|---|---|
| Username | `admin` (configurable via `ADMIN_USERNAME`) |
| Password | Value of `ADMIN_PASSWORD` env var |

**Change the password immediately** after first login via Admin Panel → Account → Change Password.

### Adding users

Only the admin can add and delete users. In the Admin Panel → **Users** tab:

1. Enter a username and an initial password (min 6 characters) and click **Add**.
2. The new user is created with the `viewer` role.
3. Send the user their initial credentials. They can log in and change their password via Admin Panel → Account → Change Password.

### Roles

| Role | What they can do |
|---|---|
| `admin` | Full access: manage teams, repos, release groups, users |
| `viewer` | View pipelines and release groups; tag runs into release groups |

Admins can promote a viewer to admin (or demote an admin to viewer) at any time using the **Manage Accounts** icon next to any user in the Users tab. An admin cannot change their own role.

### Brute-force protection

The login endpoint is rate-limited: 10 consecutive failed attempts from the same IP address within 5 minutes locks that IP out for 15 minutes.

---

## 7. Environment variable reference

### Backend

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | Yes | — | GitHub Personal Access Token |
| `GITHUB_TOKEN_SECONDARY` | No | — | Second PAT for rate-limit failover |
| `GITHUB_API_URL` | No | `https://api.github.com` | Override for GitHub Enterprise |
| `WORKFLOW_NAME` | No | _(all workflows)_ | Filter to a single workflow by name |
| `JWT_SECRET` | Yes | — | Random string ≥ 32 chars; signs session tokens |
| `ALLOWED_ORIGIN` | Yes | — | Frontend URL (exact match, no trailing slash) |
| `ADMIN_USERNAME` | No | `admin` | Username of the bootstrapped admin account |
| `ADMIN_PASSWORD` | Yes | — | Password of the bootstrapped admin account |
| `SPRING_PROFILES_ACTIVE` | Yes | — | `postgres` (Render/cloud), or omit for local dev (H2) |

### PostgreSQL deployment

To use PostgreSQL instead of H2, set `SPRING_PROFILES_ACTIVE=postgres` and provide the JDBC connection URL:

| Variable | Description |
|---|---|
| `JDBC_DATABASE_URL` | Full JDBC URL, e.g. `jdbc:postgresql://host:5432/dbname?user=u&password=p` |

On Render, if you add a PostgreSQL database to your service, Render automatically injects `JDBC_DATABASE_URL` in the correct format. Then just set `SPRING_PROFILES_ACTIVE=postgres` and the app will connect to it.

The same schema file (`h2-init.sql`) is used for both H2 and PostgreSQL — all DDL is compatible with both databases.

### Frontend

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE` | Yes | Backend URL (e.g. `http://localhost:8080` locally, Render URL in prod) |
| `VITE_WORKFLOW_NAME` | No | Optional workflow name filter (same as the backend setting) |
| `VITE_STAGE_FLOW_URL` | No | Optional link shown in the header for an external pipeline status tool |
