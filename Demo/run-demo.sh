#!/usr/bin/env bash
# Run the full Pipeline Dashboard locally with mock GitHub data.
# Usage: bash Demo/run-demo.sh   (from project root)
#
# What it does:
#   1. Starts the mock GitHub API server (node, port 3001)
#   2. Builds & starts the Spring Boot backend (port 8080) with demo settings
#   3. Starts the Vite frontend dev server (port 5173)
#   4. Waits for the backend to be ready, then seeds dummy data
#   5. Opens the browser

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO="$ROOT/Demo"
LOGS="$DEMO/logs"
mkdir -p "$LOGS"

echo "════════════════════════════════════════════════"
echo "  Pipeline Dashboard — Local Demo"
echo "  Project root: $ROOT"
echo "════════════════════════════════════════════════"

# ── 0. Check prerequisites ──────────────────────────────────────────────────
for cmd in java mvn node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Please install it and re-run."
    exit 1
  fi
done
echo "✓ Prerequisites OK (java, mvn, node, npm)"

# ── 1. Kill any leftover processes on our ports ─────────────────────────────
for PORT in 3001 8080 5173; do
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "⚠  Port $PORT in use (PID $PID) — killing..."
    kill -9 "$PID" 2>/dev/null || true
    sleep 0.5
  fi
done

# ── 2. Start mock GitHub server ─────────────────────────────────────────────
echo ""
echo "→ Starting mock GitHub server (port 3001)..."
node "$DEMO/mock-github-server.js" > "$LOGS/mock-github.log" 2>&1 &
MOCK_PID=$!
echo "  PID $MOCK_PID  |  log: Demo/logs/mock-github.log"

# ── 3. Start Spring Boot backend ────────────────────────────────────────────
echo ""
echo "→ Building & starting backend (port 8080) — first run may take ~60s..."
echo "  log: Demo/logs/backend.log"
(
  cd "$ROOT/backend/srv"
  mvn spring-boot:run \
    -Dspring-boot.run.jvmArguments="\
      -Dapp.github-token=mock-token \
      -Dapp.github-api-url=http://localhost:3001 \
      -Dapp.admin.username=admin \
      -Dapp.admin.password=Admin@123 \
      -Dapp.jwt-secret=local-dev-secret-min-32-characters-ok!" \
    > "$LOGS/backend.log" 2>&1
) &
BACKEND_PID=$!
echo "  PID $BACKEND_PID"

# ── 4. Start frontend ────────────────────────────────────────────────────────
echo ""
echo "→ Starting frontend (port 5173)..."
(
  cd "$ROOT/frontend"
  [ ! -d node_modules ] && npm install --silent
  VITE_API_BASE="http://localhost:8080" npm run dev > "$LOGS/frontend.log" 2>&1
) &
FRONTEND_PID=$!
echo "  PID $FRONTEND_PID  |  log: Demo/logs/frontend.log"

# ── 5. Wait for backend ──────────────────────────────────────────────────────
echo ""
echo "→ Waiting for backend to start (up to 120s)..."
WAITED=0
until curl -s http://localhost:8080/api/auth/status > /dev/null 2>&1 || \
      curl -s http://localhost:8080/actuator/health > /dev/null 2>&1 || \
      curl -s http://localhost:8080/api/teams > /dev/null 2>&1; do
  sleep 3
  WAITED=$((WAITED + 3))
  if [ $WAITED -ge 120 ]; then
    echo "ERROR: Backend did not start within 120s. Check Demo/logs/backend.log"
    cat "$LOGS/backend.log" | tail -20
    exit 1
  fi
  printf "  still waiting... ${WAITED}s\r"
done
echo "  ✓ Backend ready after ${WAITED}s                   "

# ── 6. Seed demo data ─────────────────────────────────────────────────────────
echo ""
bash "$DEMO/seed-demo-data.sh"

# ── 7. Open browser ───────────────────────────────────────────────────────────
sleep 1
echo ""
echo "→ Opening http://localhost:5173 ..."
open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true

echo ""
echo "════════════════════════════════════════════════"
echo "  All services running. Press Ctrl+C to stop."
echo "  Frontend : http://localhost:5173"
echo "  Backend  : http://localhost:8080"
echo "  Login    : admin / Admin@123"
echo "════════════════════════════════════════════════"
echo ""

# ── 8. Trap Ctrl+C to clean up ───────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Stopping all services..."
  kill "$MOCK_PID" "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup INT TERM

# Keep script alive (tails backend log so user can see output)
wait
