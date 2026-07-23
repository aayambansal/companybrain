#!/usr/bin/env bash
# End-to-end CompanyBrain flow with curl: register, mint an API key, add a
# memory, search, and chat. Requires: curl, jq.
set -euo pipefail

API_URL="${COMPANYBRAIN_API_URL:-http://localhost:3333}"
EMAIL="${EMAIL:-you@example.com}"
PASSWORD="${PASSWORD:-supersecret}"

# 1. Register an org and its owner. Returns a session token.
TOKEN=$(curl -s -X POST "$API_URL/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"orgName\":\"Acme\"}" \
  | jq -r .token)

# 2. Mint an API key (cb_...) using the session token.
API_KEY=$(curl -s -X POST "$API_URL/v1/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"cli"}' \
  | jq -r .key.secret)
echo "API key: $API_KEY"

# 3. Add a memory.
curl -s -X POST "$API_URL/v1/memories" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"content":"We deploy to production every Thursday at 2pm.","title":"Deploy schedule","tags":["ops"]}' \
  | jq

# 4. Hybrid search.
curl -s -X POST "$API_URL/v1/search" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"q":"when do we deploy","mode":"hybrid","limit":5}' \
  | jq

# 5. Chat.
curl -s -X POST "$API_URL/v1/chat" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"message":"When do we deploy to production?"}' \
  | jq
