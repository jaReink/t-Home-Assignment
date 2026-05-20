# Notes

## How to Run

See the [Quickstart in the README](README.md#quickstart).

---

## The Tour

**Backend.** The entry point is [backend/src/index.ts](backend/src/index.ts), which calls `buildServer()` from [backend/src/server.ts](backend/src/server.ts), a Fastify factory that registers five route plugins (`sync`, `contributors`, `reviewHealth`, `prTiming`, `narrative`) and a central error handler that maps `ZodError` to 422, `RateLimitError` to 503, and `GitHubError` to 404 or 502. Environment variables are validated at startup via Zod in [backend/src/config.ts](backend/src/config.ts), so a missing `GITHUB_TOKEN` fails immediately with a clear message rather than mid-request. The database is a Kysely-wrapped SQLite instance in [backend/src/db/client.ts](backend/src/db/client.ts) that runs the schema migration on first access. GitHub data comes in through [backend/src/github/client.ts](backend/src/github/client.ts), which uses the GraphQL API to fetch PRs with their embedded reviews in a single paginated query and the REST API for commits; responses are parsed through Zod schemas at the boundary before any transform logic runs. [backend/src/sync/syncRepo.ts](backend/src/sync/syncRepo.ts) orchestrates the fetch and upserts everything into SQLite, holding an in-memory lock to prevent concurrent syncs for the same repo. The three insight functions ([backend/src/insights/contributors.ts](backend/src/insights/contributors.ts), [backend/src/insights/reviewHealth.ts](backend/src/insights/reviewHealth.ts), [backend/src/insights/prTiming.ts](backend/src/insights/prTiming.ts)) are pure functions that take a `db` instance and a date range and return typed results; each route calls auto-sync if the cache is stale, then calls the relevant function. The narrative endpoint ([backend/src/llm/client.ts](backend/src/llm/client.ts)) passes all three metric results to Claude Haiku as structured JSON and returns a headline, narrative, hypothesis, confidence score, and evidence chain; it falls back to a stub response if `ANTHROPIC_API_KEY` is not set.

**Frontend.** [frontend/src/App.tsx](frontend/src/App.tsx) reads `owner`, `repo`, `from`, and `to` from URL search params on load and passes them to four TanStack Query hooks in [frontend/src/hooks/useInsights.ts](frontend/src/hooks/useInsights.ts), each backed by a typed fetcher in [frontend/src/lib/api.ts](frontend/src/lib/api.ts). All four requests fire in parallel; each panel renders independently as its query resolves. Submitting the form in [frontend/src/components/RepoForm.tsx](frontend/src/components/RepoForm.tsx) updates `window.location.search`, which re-renders `App` with new params, making every view directly shareable by URL. The four display components ([ContributorsTable](frontend/src/components/ContributorsTable.tsx), [ReviewHealthPanel](frontend/src/components/ReviewHealthPanel.tsx), [PrTimingChart](frontend/src/components/PrTimingChart.tsx), [NarrativePanel](frontend/src/components/NarrativePanel.tsx)) each handle their own loading skeleton and receive typed data props.

**Eval harness.** [backend/evals/runner.ts](backend/evals/runner.ts) loads four fixture JSON files from [backend/evals/fixtures/](backend/evals/fixtures/) (healthy team, review theater, sparse data, solo contributor), calls `generateNarrative()` directly with each fixture's pre-computed metric data, then runs the output through [backend/evals/scorer.ts](backend/evals/scorer.ts) against five criteria:

1. Data points in the signals are traceable to numbers in the input
2. Confidence is calibrated to sample size
3. A caveat is present for sparse fixtures
4. The narrative contains no numbers absent from the input
5. Any hypothesis is specific rather than generic

The runner exits with code 1 if any criterion fails, making it usable in CI.

### Brief Checklist

| Requirement | How it's met |
|---|---|
| External API integration | GitHub GraphQL API (PRs + reviews) and REST API (commits) |
| Interesting insight endpoint | Three: contributor breakdown, review health (silent approvals + unreviewed merges), PR pickup timing |
| LLM narrative endpoint | `GET /api/narrative`: headline, narrative citing specific numbers, hypothesis, confidence (capped at 0.85; required `< 0.5` when `totalMergedPrs < 20`), evidence chain |
| HTTP queryable | REST API, documented with curl examples in the [README](README.md) |
| Local setup | Two-terminal dev mode; see the [README quickstart](README.md#quickstart) |
| Frontend | React + Vite, four panels with skeleton loaders, shareable URLs |
| Caching | SQLite: fetched data persists across restarts; repeated queries are instant |
| Eval harness | `npm run eval`: four fixtures, five scoring criteria, CI-friendly exit code |
| Unit tests | Backend: insight computation, sync conflict handling, route validation, and narrative stub/parse-failure behaviour (`cd backend && npm test`). Frontend: component tests for `ContributorsTable` and `RepoForm` (`cd frontend && npm test`) |

### Trade-offs

**GraphQL over REST for PR + review data.** Embedding reviews inside the PR query cuts the GitHub API call count from ~400 to ~4 for a busy repo. The cost is a more complex query shape and Zod validation that needs to match the nested response structure. Commits still use REST because the GraphQL commit history API is slower (it computes diffs per node) and we only need author and date.

**SQLite over Postgres.** SQLite requires zero setup and is fast enough for the indexed analytical queries here. The limitation is it doesn't support concurrent writes across processes. A production version would swap in Postgres and add a proper migration tool; the Kysely query builder used here is database-agnostic so the switch is a driver change, not a query rewrite.

**Fastify over NestJS.** The plugin chain is explicit and linear: a route file reads like plain TypeScript without decorator or DI indirection. Fastify's `app.inject()` runs routes in-process with no port binding, making route tests fast and setup-free. NestJS would be the right call if this service grew to dozens of routes with role-based auth and multiple teams, because its DI system makes swapping implementations cleaner at scale and it generates OpenAPI docs automatically.

**Haiku for narrative.** Fast, cheap, and the structured output quality is sufficient for a few-sentence synthesis. Confidence is capped at 0.85 because single-repo analysis over a bounded time window is inherently limited, and the prompt enforces this so the LLM can't overstate certainty. Swapping to Sonnet or Opus is a one-line change in the LLM client.

**No background sync worker.** Sync is on-demand: triggered by the first metric request for a repo or explicitly via `POST /api/sync`. A production version would add a scheduled worker that keeps SQLite warm and push-based invalidation via GitHub webhooks. The architecture supports this (`syncRepo()` is already a standalone function with a concurrency lock), but webhook delivery requires a publicly reachable server, which doesn't fit a local-first service.

---

## What I'd Add Next

**Multi-repo comparison.** Right now the UI analyses one repo at a time. Tabs at the top showing recently queried repos would make it easy to switch between them without re-entering the form, and a side-by-side comparison view would let you see whether a slow review pickup time is a team pattern or specific to one repo.

**Additional insight endpoints.** Issue turnaround time (time from open to close) and stale PR detection (PRs open for more than a configurable threshold with no recent activity) would be natural extensions. Both are computable from data the sync already fetches and would give a fuller picture of how work actually moves through a team.

**Background sync as a nightly cron job.** The initial fetch from a cold start takes 30-60 seconds for a busy repo, which is a noticeable wait. A scheduled sync running overnight would mean the data is always warm by the time someone opens the dashboard. `syncRepo()` is already isolated enough to run from a cron context without touching the HTTP layer.

**Containerization.** A Dockerfile and `docker-compose.yml` would reduce the reviewer setup to a single command. The natural shape is a multi-stage build: Vite builds the frontend, `tsc` compiles the backend, and a slim Node Alpine image runs the result with Fastify serving the static frontend on a single port. The SQLite file would mount as a volume so data persists across restarts.

**Postgres instead of SQLite.** This would have been worth the setup time. Postgres handles concurrent writes across processes, supports proper connection pooling, and makes the service deployable as a multi-instance setup. Because the query layer is Kysely the migration is mostly a driver swap and a connection string change, but it also unlocks using something like pg-cron for the background sync rather than an external scheduler.

---

## AI Workflow

I used an agentic workflow throughout this project and want to be transparent about how, because I think the approach reflects how I work as an engineer rather than obscuring it.

Before touching any code I wrote out the requirements myself: flagging the parts I considered core, noting the edge cases and gotchas I anticipated, and sketching a high-level implementation direction alongside a couple of alternative approaches worth considering or rejecting. I fed all of that into a model in plan mode and iterated on the output, pushing back on areas that needed more detail, proposing better approaches where I had them, and refining the subtask breakdown until it was comprehensive enough to actually work from.

For core and critical subtasks I kept full manual approval, reviewing every generated output before accepting it. This was deliberate: I wanted to be able to pivot early if something was structurally wrong and to maintain a complete understanding of the foundation the rest of the service builds on. The GitHub integration, database schema, and sync layer all went through this process. I also tested regularly throughout: manual smoke tests after each subtask and unit tests once the relevant logic was in place.

For work further off the critical path that or work that could be parallelised cleanly, I ran multiple agents in separate worktrees. The UI components and the first pass at the narrative endpoint were both built this way, with a human code review before any agent-led output was merged back in.

The throughline is that I treated the model as a capable collaborator operating within constraints I set, not as a replacement for engineering judgement. The decisions about what to build, how to structure it, and where to invest review time were mine.

