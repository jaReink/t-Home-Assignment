# Frontend

React + Vite single-page app that renders the four analytics panels. Talks to the backend over a local proxy — no CORS configuration needed in development.

## Stack

| Layer | Library |
|-------|---------|
| UI framework | React 19 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 3 |
| Data fetching | TanStack React Query 5 + Axios |
| Charts | Recharts 2 |
| Language | TypeScript 5 |

## Setup

```bash
npm install
```

No `.env` file needed. The Vite dev server proxies `/api` and `/health` to `http://localhost:3000`, so the backend must be running before you load the app.

## Running

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production bundle → dist/
npm run preview  # serve the production build locally
```

## Testing

```bash
npm test            # run all tests once
npm run test:watch  # watch mode — re-runs on file changes
```

Tests live in `src/test/` and use [Vitest](https://vitest.dev/) with React Testing Library.

## Project structure

```
src/
├── main.tsx               # React root
├── App.tsx                # Layout, query-string state, 2×2 grid
├── components/
│   ├── RepoForm.tsx        # Owner / repo / date range inputs
│   ├── ContributorsTable.tsx   # Sortable, scrollable contributor rows
│   ├── ReviewHealthPanel.tsx   # Silent approval badges + reviewer breakdown
│   ├── PrTimingChart.tsx       # Percentile stats + two Recharts bar charts
│   └── NarrativePanel.tsx      # AI summary, confidence meter, evidence list
├── hooks/
│   └── useInsights.ts     # React Query hooks for all four endpoints
└── lib/
    └── api.ts             # Axios client + TypeScript response interfaces
```

## Backend proxy

`vite.config.ts` forwards two prefixes to the backend:

```
/api/*   → http://localhost:3000/api/*
/health  → http://localhost:3000/health
```

If you run the backend on a different port, update `vite.config.ts`:

```ts
proxy: {
  '/api': 'http://localhost:<your-port>',
  '/health': 'http://localhost:<your-port>',
}
```

## URL state

App state (owner, repo, from, to) lives in the query string. Changing the form updates the URL so links are shareable and the browser back button works.

```
http://localhost:5173/?owner=vercel&repo=next.js&from=2026-04-01&to=2026-05-11
```
