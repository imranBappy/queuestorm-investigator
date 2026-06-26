# Deployment & Replication Runbook

QueueStorm Investigator API — evidence-based fintech investigation engine.

## Architecture

```
Client  --HTTPS-->  Express API (Node.js)
                         |
                         +--> GET  /health
                         +--> POST /analyze-ticket
                                    |
                                    v
                              Deterministic Pipeline
                              (parser → matcher → evidence → rules)
                                    |
                                    v (optional, max 1 call)
                              OpenRouter API (gpt-4o-mini)
```

## 1. Local replication

Use **[RUNBOOK.md](./RUNBOOK.md)** — full step-by-step commands (prerequisites, clone, install, env, start, verify, troubleshoot). No steps omitted.

Quick summary:

```bash
git clone https://github.com/imranBappy/ticket-sorting.git
cd ticket-sorting
pnpm install
cp .env.example .env
# optional: set OPENROUTER_API_KEY in .env
pnpm start
curl -i http://localhost:5001/health
```

---

## 2. Production deployment

### Common requirements

| Item | Value |
|------|-------|
| Start command | `node index.js` |
| Node version | 18 or 20 |
| Required env var | `OPENROUTER_API_KEY` (for LLM paths) |
| Health check path | `/health` |
| Listen port | `PORT` env var or `5001` |

### 2.1 Vercel (recommended)

1. Push repo to GitHub.
2. Import project in [Vercel dashboard](https://vercel.com/new).
3. Add environment variable: `OPENROUTER_API_KEY`
4. Deploy with default settings.
5. Verify:

```bash
curl https://<your-project>.vercel.app/health
curl -s -X POST https://<your-project>.vercel.app/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{"complaint":"Payment failed","transaction_history":[]}'
```

**CLI deploy:**

```bash
pnpm install
vercel link
vercel env add OPENROUTER_API_KEY
vercel --prod
```

`vercel.json` sets `maxDuration: 30` for the serverless function.

### 2.2 Render / Railway / Fly.io

Use start command `node index.js`, set `OPENROUTER_API_KEY`, health check `/health`.

---

## 3. Post-deploy checklist

- [ ] Repository is public on GitHub
- [ ] `README.md` and [RUNBOOK.md](./RUNBOOK.md) are in the repo
- [ ] Live base URL uses HTTPS
- [ ] `GET <base-url>/health` returns `200` and body `{"status":"ok"}`
- [ ] `POST <base-url>/analyze-ticket` returns valid JSON
- [ ] `OPENROUTER_API_KEY` is set only in platform secrets
- [ ] `pnpm test` passes locally

---

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/health` connection refused | Server not running | Check start command and logs |
| `/analyze-ticket` 400 | Invalid request body | Check Zod validation errors in response |
| `/analyze-ticket` 403 | Input safety block | Remove injection-like phrases from complaint |
| LLM always skipped | Clear English complaint | Expected for deterministic path |
| LLM fallback response | Timeout or API error | Check `OPENROUTER_API_KEY` and OpenRouter status |
| Vercel timeout | Cold start + LLM | Deterministic cases are fast; LLM has 10s timeout |

---

## 5. Rollback

Redeploy a previous successful commit from your platform dashboard or `git checkout <commit> && vercel --prod`.
