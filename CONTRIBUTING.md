# Contributing to Lynceus

Thank you for considering a contribution!

## Getting started locally

### Prerequisites
- Java 21
- Maven 3.9+
- Node.js 18+ (for the React frontend)
- Docker + Docker Compose (optional — for single-command startup)

### Quick start with Docker Compose

```bash
git clone https://github.com/your-fork/Lynceus.git
cd Lynceus
export GITHUB_TOKEN=ghp_...
export JWT_SECRET=a-random-string-at-least-32-characters-long
export ADMIN_PASSWORD=YourAdminPassword
docker-compose up --build
# Backend at http://localhost:8080, frontend at http://localhost:5173
```

### Manual startup (backend)
```bash
# Copy the example config and fill in your values
cp backend/srv/src/main/resources/application.yaml.example \
   backend/srv/src/main/resources/application.yaml

# Run the backend (starts on :8080 with H2 in-memory DB)
cd backend
mvn spring-boot:run -pl srv
```

### Frontend (React)
```bash
cd frontend
cp .env.example .env.local
# .env.local already points VITE_API_BASE to http://localhost:8080 — no edits needed for local dev
npm install
npm run dev   # starts at http://localhost:5173
```

## Project layout

| Path | What it is |
|---|---|
| `frontend/` | React + Vite frontend |
| `backend/` | Java 21 / Spring Boot / Spring JDBC backend |
| `backend/srv/src/main/java/` | Java controllers, services, security |
| `backend/srv/src/main/resources/` | Spring config, H2 SQL schema |
| `backend/srv/src/test/` | JUnit tests |
| `render.yaml` | Render deployment config (backend) |
| `frontend/vercel.json` | Vercel deployment config (frontend) |
| `backend/Dockerfile` | Docker image for Render / docker-compose |
| `docker-compose.yml` | One-command local startup (backend + frontend) |

## Making changes

- Open a branch from `master`.
- Keep commits focused — one logical change per commit.
- Run the backend tests before submitting: `cd backend && mvn test`.
- Open a pull request against `master`. Describe what you changed and why.

## Reporting issues

Use [GitHub Issues](../../issues). Include steps to reproduce, expected behaviour, and actual behaviour.

## Code of conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).
