# curl

Copy-pasteable `curl` commands for the full flow: register, mint an API key,
add a memory, search, and chat. `run.sh` does all five in order.

## Prerequisites

- A running CompanyBrain API (default `http://localhost:3333`).
- `curl` and `jq`.

## Run the script

```bash
export COMPANYBRAIN_API_URL=http://localhost:3333
bash run.sh
```

## Or step by step

```bash
API_URL=http://localhost:3333

# 1. Register. Returns a session token.
TOKEN=$(curl -s -X POST "$API_URL/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret","orgName":"Acme"}' \
  | jq -r .token)

# 2. Mint an API key (cb_...). The secret is shown once.
API_KEY=$(curl -s -X POST "$API_URL/v1/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"cli"}' \
  | jq -r .key.secret)

# 3. Add a memory.
curl -s -X POST "$API_URL/v1/memories" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"content":"We deploy to production every Thursday at 2pm.","title":"Deploy schedule","tags":["ops"]}'

# 4. Search.
curl -s -X POST "$API_URL/v1/search" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"q":"when do we deploy","mode":"hybrid","limit":5}'

# 5. Chat.
curl -s -X POST "$API_URL/v1/chat" \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"message":"When do we deploy to production?"}'
```
