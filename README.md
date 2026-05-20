# Tempo — GitHub Insights Dashboard

A full-stack tool that pulls GitHub PR, review, and commit data into a local SQLite database and surfaces it as an interactive analytics dashboard with four panels: contributor breakdown, review health, PR timing, and an AI-generated narrative.

---

## Quickstart

```bash
# 1. Configure env
cp .env.example .env
# → fill in GITHUB_TOKEN (required) and ANTHROPIC_API_KEY (optional, for narrative panel)

# 2. Install
cd backend && npm install
cd ../frontend && npm install

# 3. Run (two terminals)
cd backend && npm run dev       # Terminal 1 — API on http://localhost:3000
cd frontend && npm run dev      # Terminal 2 — UI on http://localhost:5173
```

Open **http://localhost:5173**, enter `vercel` / `next.js` and a date range, click **Analyze**.

> **First sync takes 30–60 seconds** — the app is fetching PR and review data from GitHub. Progress logs in the backend terminal. All subsequent queries within the cache window are instant.

---

## Prerequisites

- **Node.js** 18+ and **npm**
- A **GitHub personal access token** with `repo` scope ([create one here](https://github.com/settings/tokens))
- *(Optional)* An **Anthropic API key** for the AI narrative panel ([console.anthropic.com](https://console.anthropic.com)) — requires a $5 credit top-up, no free tier

---

## Interacting with the dashboard

### Step 1 — Enter a repo and date range

Fill in the form at the top:

| Field | Example | Notes |
|-------|---------|-------|
| Owner | `vercel` | GitHub org or user |
| Repo | `next.js` | Repository name |
| From | `2026-04-01` | Start of analysis window |
| To | `2026-05-11` | End of analysis window |

Click **Run**. The app will trigger a sync in the background if data for that repo hasn't been fetched yet.

### Step 2 — Read the four panels

#### Contributors
A sortable table of everyone who merged a PR in the window. Click any column header to sort. Key columns:

| Column | What it means |
|--------|---------------|
| PRs Merged | PRs the author opened that were merged |
| Commits | Commits authored (across all branches, not just merged PRs) |
| Lines Added / Deleted | Net churn from their merged PRs |

#### Review Health
Two summary badges at the top, then an expandable **Reviewer breakdown** table.

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Silent Approvals | < 20% | 20–50% | > 50% |
| Unreviewed Merges | < 20% | 20–50% | > 50% |

**Silent approval** = an LGTM or approval with no inline comments and no review body. High rates suggest rubber-stamping. **Unreviewed merge** = a PR merged with no approvals at all.

The reviewer breakdown shows per-reviewer counts so you can see who is approving silently vs. leaving detailed feedback.

#### PR Timing
Three percentile stats (median, p75, p95) for how long PRs sit before someone picks them up, plus:

- **Distribution bar chart** — how many PRs fall into each pickup-time bucket (< 1 hour, 1–4 hours, etc.)
- **Hour-of-day heatmap** — when reviews actually land, in your repo's local pattern

A long p95 tail with a short median usually means a few PRs get stuck, not that the team is slow overall.

#### Narrative *(requires Anthropic API key)*
An AI-generated summary combining all four data sources into a plain-English paragraph with a confidence score. Expand **Evidence** to see which specific data points drove the narrative.

Without an API key the panel shows a stub placeholder. A `$5` credit on [console.anthropic.com → Billing](https://console.anthropic.com) covers many runs — the model used (Haiku) is very cheap.

---

## Other commands

```bash
# Backend tests
cd backend && npm test

# Eval harness — runs 4 fixture scenarios through narrative scoring
cd backend && npm run eval
```

---

## URL sharing

After running a query the URL updates to include your parameters:

```
http://localhost:5173/?owner=vercel&repo=next.js&from=2026-04-01&to=2026-05-11
```

Copy and paste it to share a specific view, or bookmark it for repos you check regularly.
