# GitHub Insights Backend

## Setup

```bash
npm install
cp .env.example .env   # fill in GITHUB_TOKEN
```

## Running

```bash
npm run dev    # development, with watch
npm start      # production
npm test       # vitest
npm run eval   # eval harness (4 fixtures, 5 criteria each)
```

## Endpoints

### Health

```bash
curl http://localhost:3000/health
```

---

### Sync

Fetches PR, review, and commit data from GitHub into SQLite. Must be called before insight endpoints return data. Subsequent calls within the cache TTL are no-ops.

> **First sync is slow.** `vercel/next.js` has hundreds of PRs — expect 30–60 seconds. The GraphQL API batches 100 PRs per request so the call count is low, but each page still takes a round trip. Progress is logged to the terminal running `npm run dev`.

**Trigger a sync**
```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"owner":"vercel","repo":"next.js","lookbackMonths":3}'
```

**Check sync status**
```bash
curl "http://localhost:3000/api/sync/status?owner=vercel&repo=next.js"
```

---

### Insight endpoints

All three take the same query parameters: `owner`, `repo`, `from` (ISO date), `to` (ISO date).

**Contributors**
```bash
curl "http://localhost:3000/api/contributors?owner=vercel&repo=next.js&from=2026-04-01&to=2026-05-11"
```

**Review health**
```bash
curl "http://localhost:3000/api/review-health?owner=vercel&repo=next.js&from=2026-04-01&to=2026-05-11"
```

**PR timing**
```bash
curl "http://localhost:3000/api/pr-timing?owner=vercel&repo=next.js&from=2026-04-01&to=2026-05-11"
```

**Narrative**
```bash
curl "http://localhost:3000/api/narrative?owner=vercel&repo=next.js&from=2026-04-01&to=2026-05-11"
```

> **Stub mode:** if `ANTHROPIC_API_KEY` is not set in `.env`, this returns a placeholder response with `"stub": true`. All other endpoints work normally without it. The Anthropic API has no free tier — a $5 credit top-up at console.anthropic.com → Billing is required. Haiku is cheap enough that the entire demo costs well under $1.

> **Timing:** always run the sync endpoint first (see above). Once the cache is warm, the narrative call takes 2–5 seconds for the LLM response. Calling it cold will trigger an automatic sync inline, adding 30–60 seconds before any response arrives.

---

### Eval harness

Runs 4 pre-built fixture scenarios through the narrative endpoint and scores the output against 5 criteria: data points referenced, confidence calibration, caveat presence, no hallucination, and hypothesis specificity.

```bash
npm run eval
```

In stub mode all criteria that require a real LLM response are auto-passed. Set `ANTHROPIC_API_KEY` to run against the real model.

---

### Error cases

**Missing required parameters → 422**
```bash
curl "http://localhost:3000/api/contributors?owner=vercel&repo=next.js"
```

**Invalid owner characters → 422**
```bash
curl "http://localhost:3000/api/contributors?owner=bad/owner&repo=next.js&from=2025-02-01&to=2025-05-01"
```

**Concurrent sync on same repo → 409**
```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"owner":"vercel","repo":"next.js"}' &
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"owner":"vercel","repo":"next.js"}'
```
