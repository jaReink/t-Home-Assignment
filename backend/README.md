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
