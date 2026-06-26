# Local Runbook — QueueStorm Investigator API

Copy-paste guide to run this service on your machine. Every command is listed; nothing is assumed.

**Time:** ~5 minutes  
**Result:** API listening on `http://localhost:5001` with working `/health` and `/analyze-ticket`.

---

## 0. What you need

| Requirement | Minimum | Check it |
|-------------|---------|----------|
| Node.js | 18.x or 20.x (22.x also works) | `node --version` |
| pnpm | 8+ | `pnpm --version` |
| Git | any recent version | `git --version` |
| curl | any recent version | `curl --version` |

### Install Node.js (if missing)

**macOS (Homebrew):**

```bash
brew install node@20
```

**Ubuntu / Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:

```bash
node --version
# Example output: v20.x.x
```

### Install pnpm (if missing)

Node 16.13+ ships with Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

Or install globally:

```bash
npm install -g pnpm
pnpm --version
```

---

## 1. Clone the repository

```bash
git clone https://github.com/imranBappy/ticket-sorting.git
cd ticket-sorting
```

Confirm you are in the project root (you should see `package.json`):

```bash
ls package.json index.js src/
```

---

## 2. Install dependencies

```bash
pnpm install
```

Expected: finishes without errors and creates `node_modules/`.

**No pnpm?** Use npm instead (lockfile is pnpm-specific; npm resolves from `package.json`):

```bash
npm install
```

For all following commands, replace `pnpm` with `npm run` where noted (e.g. `npm start`, `npm test`).

---

## 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` in any editor. For full functionality (Bangla / ambiguous cases that call the LLM), set your OpenRouter key:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Get a key at: https://openrouter.ai/keys

**Without a key:** the service still starts. English complaints that match the deterministic rules work; LLM-assisted paths return safe fallbacks.

Minimum `.env` for local dev (defaults are fine):

```env
PORT=5001
```

---

## 4. Start the server

**Foreground (recommended for first run — logs print to this terminal):**

```bash
pnpm start
```

Expected log line:

```text
QueueStorm Investigator API listening
```

The server binds to port `5001` unless you set `PORT` in `.env`.

**Background (optional — frees your terminal):**

```bash
pnpm start &
```

Note the process ID if you need to stop it later: `echo $!`

---

## 5. Verify the service

Open a **second terminal** (leave the server running in the first).

### 5.1 Health check

```bash
curl -i http://localhost:5001/health
```

**Expected:**

```text
HTTP/1.1 200 OK
...
{"status":"ok"}
```

### 5.2 Investigation endpoint

```bash
curl -s -X POST http://localhost:5001/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "TKT-100",
    "complaint": "I sent 5000 taka to wrong number 01712345678 around 2pm",
    "transaction_history": [
      {
        "id": "txn_abc123",
        "amount": 5000,
        "currency": "BDT",
        "type": "transfer",
        "counterparty": "01712345678",
        "merchant": null,
        "timestamp": "2026-06-26T14:05:00Z",
        "status": "completed"
      }
    ]
  }'
```

**Expected (abbreviated):** HTTP 200 JSON containing at least:

```json
{
  "ticket_id": "TKT-100",
  "relevant_transaction_id": "txn_abc123",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "department": "dispute_resolution",
  "human_review_required": true
}
```

Pretty-print (if `jq` is installed):

```bash
curl -s -X POST http://localhost:5001/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{"ticket_id":"TKT-100","complaint":"I sent 5000 taka to wrong number 01712345678 around 2pm","transaction_history":[{"id":"txn_abc123","amount":5000,"currency":"BDT","type":"transfer","counterparty":"01712345678","merchant":null,"timestamp":"2026-06-26T14:05:00Z","status":"completed"}]}' \
  | jq .
```

---

## 6. Run the test suite (optional)

From the project root (server can be running or stopped):

```bash
pnpm test
```

**Expected:**

```text
Test Suites: 6 passed, 6 total
Tests:       38 passed, 38 total
```

---

## 7. Stop the server

**Foreground:** press `Ctrl+C` in the terminal running the server.

**Background:**

```bash
pkill -f "node index.js"
```

Or kill by port:

```bash
lsof -ti :5001 | xargs kill
```

---

## 8. Development mode (auto-reload)

Uses `nodemon` to restart on file changes:

```bash
pnpm dev
```

Same port and env as `pnpm start`.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `command not found: pnpm` | pnpm not installed | See [§0 Install pnpm](#install-pnpm-if-missing) |
| `command not found: node` | Node not installed | See [§0 Install Node.js](#install-nodejs-if-missing) |
| `EADDRINUSE` on start | Port 5001 in use | `lsof -ti :5001 \| xargs kill` or set `PORT=5002` in `.env` |
| `curl: (7) Failed to connect` | Server not running | Run `pnpm start` and check for errors |
| Health returns non-200 | Wrong port or path | Use exactly `http://localhost:5001/health` |
| Analyze returns `400` + `validation_error` | Missing `ticket_id` or empty `complaint` | Include `"ticket_id": "TKT-..."` and non-empty `complaint` |
| Analyze returns `403` | Input safety block | Remove injection-like phrases from complaint |
| LLM paths return generic fallback | Missing/invalid API key | Set `OPENROUTER_API_KEY` in `.env` and restart |
| `pnpm install` network errors | Offline or proxy | Check internet; retry `pnpm install` |

---

## 10. Environment variables reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | For LLM paths | — | OpenRouter API key |
| `PORT` | No | `5001` | HTTP listen port |
| `LLM_MODEL` | No | `openai/gpt-4o-mini` | OpenRouter model id |
| `LLM_TIMEOUT_MS` | No | `10000` | LLM timeout (ms) |
| `LOG_LEVEL` | No | `info` | Pino log level |

---

## 11. API quick reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness — returns `{"status":"ok"}` |
| `POST` | `/analyze-ticket` | Investigate complaint vs transaction history |

**Required request fields:** `ticket_id` (string), `complaint` (string).  
**Optional:** `transaction_history` (array, default `[]`).

Full API docs: [README.md](./README.md#api-documentation)

Production deployment: [DEPLOYMENT.md](./DEPLOYMENT.md)
