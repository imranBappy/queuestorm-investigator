# QueueStorm Investigator API

Evidence-based fintech investigation engine for the QueueStorm hackathon. This service analyzes customer complaints against transaction history using **deterministic reasoning first**, with at most **one optional LLM call** for ambiguous or multilingual cases.

This is **not** a chatbot or ticket classifier — it is an investigation pipeline that matches evidence, applies rules, and returns structured JSON verdicts.

## Submission deliverables

| Deliverable | Location |
|-------------|----------|
| GitHub repository | https://github.com/imranBappy/ticket-sorting (public; collaborator access for organizer `bipulhf`) |
| Runbook (local replication) | **[RUNBOOK.md](./RUNBOOK.md)** — copy-paste setup, start, and verify commands |
| Dependency file | `package.json` + `pnpm-lock.yaml` |
| Sample output | **[sample_output.json](./sample_output.json)** — real API response for `SAMPLE-01` from `SUST_Preli_Sample_Cases.json` |
| Deployment guide | **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Vercel / Render / Railway |

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ / 20+ |
| HTTP framework | Express 5 |
| Validation | Zod |
| Logging | Pino + pino-http |
| Testing | Jest + Supertest |
| LLM gateway | OpenRouter (OpenAI-compatible API) |
| Deployment | Vercel serverless (`api/index.js`) or any Node host |
| Package manager | pnpm |

## AI approach

The system is **deterministic-first**. Every request flows through a fixed investigation pipeline before any model is considered:

1. **Complaint parser** — regex/heuristics extract amount, type, phone numbers, time references, intent, and language (no AI).
2. **Transaction matcher** — weighted scoring ranks transactions against parsed signals (amount ±1%, type, counterparty, timestamp ±2h).
3. **Evidence engine** — compares complaint intent against matched transaction status to produce `consistent`, `inconsistent`, or `insufficient_data`.
4. **Rule engine** — maps case type + evidence to department, severity, and `human_review_required`.
5. **Reply generator** — template-based `agent_summary`, `recommended_next_action`, and `customer_reply` for clear English cases.
6. **LLM (optional, max 1 call)** — invoked only when language is Bangla/Banglish/mixed, intent is ambiguous, or parser confidence is low. The model receives structured investigation state and returns JSON text fields only; it does not decide routing or evidence verdicts.
7. **Output safety scrub** — strips PIN/OTP/password/refund promises from all generated text before response validation.

This design keeps latency and cost low for the majority of English tickets while still handling multilingual and edge cases safely.

## MODELS

| Model | Provider | Where it runs | When invoked | Why chosen |
|-------|----------|---------------|--------------|------------|
| `openai/gpt-4o-mini` | OpenRouter (`https://openrouter.ai/api/v1`) | External API call from the Node.js service (local, Vercel, or any host) | At most **once per request**, only for Bangla/Banglish/mixed language, ambiguous intent, or parser confidence &lt; 0.6 | Fast, inexpensive, strong at structured JSON output and Bengali/Banglish text generation; temperature `0` for reproducibility |

**Cost reasoning:** Most sample and production-like English complaints complete on the deterministic path (`llmUsed: false`) at **$0 LLM cost**. When the LLM is called, `gpt-4o-mini` via OpenRouter costs roughly **$0.15 / 1M input tokens** and **$0.60 / 1M output tokens** — a single investigation prompt is typically &lt; 2k tokens, so cost per LLM-assisted ticket is well under **$0.001**. A hard **10s timeout** and safe template fallback prevent runaway spend on slow or failed calls.

Configurable via `LLM_MODEL` and `OPENROUTER_API_KEY` environment variables. See `.env.example`.

## Assumptions

- Complaints are plain text in English, Bangla, Banglish, or mixed; no attachments or images.
- Transaction history is provided inline in the request body (no external ledger lookup).
- Amounts are in BDT unless otherwise stated; phone numbers follow Bangladesh formats.
- The service is stateless — no ticket persistence, audit log, or case reopening across requests.
- `OPENROUTER_API_KEY` is available in production for multilingual/ambiguous paths; without it, deterministic English cases still work and LLM paths return safe fallbacks.
- Judges and integrators call `POST /analyze-ticket` with JSON matching the published schema (`ticket_id`, `complaint`, optional `transaction_history`).
- Human agents always review high-severity and dispute cases (`human_review_required: true` for wrong transfers, fraud, and inconsistent evidence).

## Live endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check — returns `OK` |
| `POST` | `/analyze-ticket` | Investigate a complaint against transaction history |

## Quick start (local)

**Full copy-paste runbook:** **[RUNBOOK.md](./RUNBOOK.md)** — step-by-step commands to clone, install, configure, start, and verify the service. Use this if Docker or one-click deploy is unavailable.

```bash
git clone https://github.com/imranBappy/ticket-sorting.git
cd ticket-sorting
pnpm install
cp .env.example .env
pnpm start
```

In a second terminal:

```bash
curl -i http://localhost:5001/health
# Expected: HTTP 200 and {"status":"ok"}
```

### Example request

```bash
curl -X POST http://localhost:5001/analyze-ticket \
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

### Example response

```json
{
  "ticket_id": "TKT-100",
  "relevant_transaction_id": "txn_abc123",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Case classified as wrong_transfer. Evidence verdict: consistent. Matched transaction txn_abc123.",
  "recommended_next_action": "Verify beneficiary details and initiate dispute review per wrong-transfer policy. Do not promise reversal.",
  "customer_reply": "We have received your report regarding a possible wrong transfer. Our dispute resolution team is reviewing the transaction details. Please contact official support if you have additional information. We cannot confirm any reversal at this stage.",
  "human_review_required": true,
  "confidence": 0.95,
  "reason_codes": [
    "intent_classified",
    "status_match",
    "completed_transfer_found",
    "amount_match",
    "type_match",
    "counterparty_match",
    "time_reference",
    "status_considered",
    "wrong_transfer_policy",
    "deterministic_path"
  ]
}
```

## Architecture

```
Incoming Request
       ↓
Request Validation (Zod)
       ↓
Input Safety Guard
       ↓
Complaint Parser (deterministic)
       ↓
Transaction Matcher (scoring)
       ↓
Evidence Engine
       ↓
Rule Engine
       ↓
Need LLM? ──No──→ Template Replies
       │
      Yes
       ↓
Single LLM Call (10s timeout)
       ↓
Output Safety Scrub
       ↓
Response Validation (Zod)
       ↓
JSON Response
```

## Folder structure

```
src/
  app.js                    # Express app factory
  server.js                 # Local dev entry
  routes/                   # Route definitions
  controllers/              # Thin HTTP handlers
  services/
    investigation/          # Parser, matcher, evidence, rules, orchestrator
    llm.service.js            # OpenRouter integration
  validators/               # Zod validation helpers
  schemas/                  # Request/response contracts
  middleware/               # Logging, safety, error handling
  config/                   # App configuration and enums
  prompts/                  # LLM system prompts
  utils/                    # Language detect, scoring, fallbacks
tests/
  unit/                     # Module unit tests
  integration/              # API integration tests
api/index.js                # Vercel serverless entry
```

## API documentation

### `POST /analyze-ticket`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket_id` | string | Yes | Ticket or case identifier |
| `complaint` | string | Yes | Customer complaint text |
| `transaction_history` | array | No | List of transactions (default `[]`) |

**Transaction object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique transaction ID |
| `amount` | number | Positive amount |
| `currency` | string | Currency code (default `BDT`) |
| `type` | enum | `transfer`, `payment`, `refund`, `withdrawal`, `other` |
| `counterparty` | string \| null | Phone or account identifier |
| `merchant` | string \| null | Merchant name |
| `timestamp` | string | ISO or parseable datetime |
| `status` | enum | `completed`, `failed`, `pending`, `reversed`, `cancelled` |

**Response fields:** `ticket_id`, `relevant_transaction_id`, `evidence_verdict`, `case_type`, `severity`, `department`, `agent_summary`, `recommended_next_action`, `customer_reply`, `human_review_required`, `confidence`, `reason_codes`

**Error responses** are always JSON with `error` and `reason_codes`.

## Reasoning engine

### Complaint parser

Regex/heuristic extraction — no AI:

- Amount (`5000`, `5,000 taka`, `৳5000`)
- Transaction type keywords
- Bangladesh phone numbers
- Time references
- Intent classification
- Language detection (`en`, `bn`, `banglish`, `mixed`)

### Evidence matching algorithm

Weighted transaction scoring:

| Signal | Weight |
|--------|--------|
| Amount match (±1%) | 40 |
| Type match | 20 |
| Counterparty/phone match | 25 |
| Timestamp proximity (±2h) | 10 |
| Status considered | 5 |

Best match returned if score ≥ 50; otherwise `relevant_transaction_id` is `null`.

### Evidence verdicts

| Scenario | Verdict |
|----------|---------|
| Payment failed + completed txn | `inconsistent` |
| Wrong transfer + completed txn | `consistent` |
| No matching transaction | `insufficient_data` |
| Ambiguous intent | `insufficient_data` |

## Safety logic

**Input safety** (`src/middleware/input-safety.js`): Blocks prompt injection, jailbreak attempts, and SQL-injection-like patterns in complaint text. Returns `403` with `reason_codes` — adversarial instructions embedded in complaints cannot override system rules.

**Output safety** (`src/utils/output-safety.js`): Scrubs PIN, OTP, password, API key, refund confirmations, and stack traces from `agent_summary`, `recommended_next_action`, and `customer_reply`. Forces `human_review_required: true` when sensitive patterns are detected.

**Policy guardrails in replies:** Customer-facing text never promises refunds/reversals, never requests credentials, and never directs users to third-party channels. Template and LLM outputs are validated against these rules before the response is returned.

## Sample output

A real response generated by this service is committed at **[sample_output.json](./sample_output.json)**.

It was produced by posting the `SAMPLE-01` input from `SUST_Preli_Sample_Cases.json` to `POST /analyze-ticket`. Key fields match the reference case: `relevant_transaction_id: TXN-9101`, `evidence_verdict: consistent`, `case_type: wrong_transfer`, `department: dispute_resolution`.

Regenerate locally:

```bash
pnpm start   # terminal 1
node scripts/generate-sample-output.js   # terminal 2
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes* | — | OpenRouter API key |
| `PORT` | No | `5001` | HTTP port |
| `LLM_MODEL` | No | `openai/gpt-4o-mini` | Model identifier |
| `LLM_TIMEOUT_MS` | No | `10000` | LLM timeout in ms |
| `LOG_LEVEL` | No | `info` | Pino log level |

\*Required for LLM-assisted paths. Deterministic investigations work without it.

## Deployment

- **Local setup:** **[RUNBOOK.md](./RUNBOOK.md)** (copy-paste commands)
- **Production:** **[DEPLOYMENT.md](./DEPLOYMENT.md)** (Vercel, Render, Railway)

**Vercel:** `api/index.js` exports the Express app. `vercel.json` rewrites all routes with `maxDuration: 30`.

```bash
pnpm install
vercel env add OPENROUTER_API_KEY
vercel --prod
```

## Testing

```bash
pnpm test
pnpm lint
```

## Known limitations

- Complaint parser uses heuristics; highly unstructured complaints may require LLM assistance.
- Transaction time matching uses relative text when ISO parse fails.
- Bangla NLP is routed to LLM rather than fully parsed deterministically.
- No persistent case storage or ticket ID tracking.

## Future improvements

- Bengali deterministic parser with dedicated token dictionaries
- Fuzzy merchant name matching
- Case persistence and audit trail
- Rate limiting and API authentication
- Confidence calibration from labeled dispute outcomes

## License

ISC
