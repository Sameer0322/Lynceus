#!/usr/bin/env bash
# Seed dummy teams, release groups, and pipelines into the running backend.
set -e

API="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASS="Admin@123"

echo "──────────────────────────────────────────────"
echo "  Seeding demo data"
echo "──────────────────────────────────────────────"

# ── Login (retry up to 15s — AdminBootstrap may still be running) ───────────
echo "→ Logging in as $ADMIN_USER ..."
HTTP_CODE="000"; BODY=""; ATTEMPTS=0
until [ "$HTTP_CODE" = "200" ] || [ $ATTEMPTS -ge 10 ]; do
  sleep 2
  ATTEMPTS=$((ATTEMPTS + 1))
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)
  [ "$HTTP_CODE" != "200" ] && printf "  waiting for admin user... (attempt $ATTEMPTS)\r"
done

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Login failed (HTTP $HTTP_CODE) after $ATTEMPTS attempts. Is the backend running at $API?"
  exit 1
fi

TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not extract token from: $BODY"
  exit 1
fi
echo "  ✓ Authenticated"

AUTH="Authorization: Bearer $TOKEN"

# ── Teams ───────────────────────────────────────────────────────────────────
echo "→ Creating Frontend Team ..."
curl -s -X POST "$API/api/teams" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Frontend Team","repos":["demo-org/frontend-app","demo-org/mobile-app"]}' > /dev/null
echo "  ✓ Frontend Team (demo-org/frontend-app, demo-org/mobile-app)"

echo "→ Creating Backend Team ..."
curl -s -X POST "$API/api/teams" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Backend Team","repos":["demo-org/backend-api","demo-org/data-pipeline"]}' > /dev/null
echo "  ✓ Backend Team (demo-org/backend-api, demo-org/data-pipeline)"

# ── Release Groups ──────────────────────────────────────────────────────────
echo "→ Creating Release Group: v2.1.0 Release ..."
RG1=$(curl -s -X POST "$API/api/releases" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"v2.1.0 Release"}')
RG1_ID=$(echo "$RG1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  ✓ v2.1.0 Release (id: $RG1_ID)"

echo "→ Creating Release Group: Hotfix v2.0.3 ..."
RG2=$(curl -s -X POST "$API/api/releases" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Hotfix v2.0.3"}')
RG2_ID=$(echo "$RG2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  ✓ Hotfix v2.0.3 (id: $RG2_ID)"

# ── Pipelines in v2.1.0 ─────────────────────────────────────────────────────
if [ -n "$RG1_ID" ]; then
  echo "→ Adding pipelines to v2.1.0 Release ..."
  curl -s -X POST "$API/api/releases/$RG1_ID/pipelines" \
    -H "Content-Type: application/json" -H "$AUTH" \
    -d '{"runId":"10101","repo":"demo-org/frontend-app","branch":"main","runNumber":1,"message":"feat: add user authentication flow","note":"Frontend v2.1.0 — deploy verified"}' > /dev/null
  curl -s -X POST "$API/api/releases/$RG1_ID/pipelines" \
    -H "Content-Type: application/json" -H "$AUTH" \
    -d '{"runId":"20002","repo":"demo-org/backend-api","branch":"main","runNumber":2,"message":"fix: resolve null pointer in service layer","note":"Backend API v2.1.0"}' > /dev/null
  curl -s -X POST "$API/api/releases/$RG1_ID/pipelines" \
    -H "Content-Type: application/json" -H "$AUTH" \
    -d '{"runId":"30001","repo":"demo-org/mobile-app","branch":"main","runNumber":1,"message":"refactor: extract common utilities","note":"Mobile v2.1.0"}' > /dev/null
  echo "  ✓ 3 pipelines added"
fi

# ── Pipelines in Hotfix ──────────────────────────────────────────────────────
if [ -n "$RG2_ID" ]; then
  echo "→ Adding pipelines to Hotfix v2.0.3 ..."
  curl -s -X POST "$API/api/releases/$RG2_ID/pipelines" \
    -H "Content-Type: application/json" -H "$AUTH" \
    -d '{"runId":"20001","repo":"demo-org/backend-api","branch":"hotfix/db-connection","runNumber":1,"message":"fix: memory leak in connection pool","note":"Critical — deploy ASAP"}' > /dev/null
  echo "  ✓ 1 pipeline added"
fi

# ── Demo viewer user ─────────────────────────────────────────────────────────
echo "→ Creating demo viewer user ..."
curl -s -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"username":"viewer","password":"Viewer@123","role":"viewer"}' > /dev/null
echo "  ✓ Viewer user created (viewer / Viewer@123)"

echo ""
echo "──────────────────────────────────────────────"
echo "  Demo data seeded successfully!"
echo "  Open http://localhost:5173"
echo "  Login: admin / Admin@123"
echo "  Login: viewer / Viewer@123"
echo "──────────────────────────────────────────────"
