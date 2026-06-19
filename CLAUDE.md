# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Next.js, localhost:3000)
npm run build    # production build
npm run start    # run production build

# Playwright tests (standalone scripts, no test runner)
node tests/live-mode.spec.mjs
node tests/phase4-cells.spec.mjs
# etc. — requires the dev server to be running on localhost:3000
```

There is no lint or type-check script in package.json. Run `npx tsc --noEmit` for type checking.

**Important (from AGENTS.md):** This project uses Next.js 16 with React 19, which may differ from training data. Check `node_modules/next/dist/docs/` for current API conventions before writing Next.js-specific code.

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind CSS 4 · Supabase (auth + DB + Realtime) · shadcn/ui · TipTap rich text · dnd-kit drag-and-drop

### Route groups

- `src/app/(auth)/` — login, signup (unauthenticated)
- `src/app/(app)/` — dashboard, rundown editor, trash (all require Supabase auth)
- `src/app/share/[token]/` — public token-based read/edit view (no auth required)
- `src/app/(app)/rundown/[id]/export/` — CSV and PDF route handlers

### Data model (Supabase)

`teams` → `events` → `rundowns` → `cues` + `columns` + `cells` (per-cue/per-column)

Auxiliary per-rundown tables: `mentions`, `variables`, `private_notes`, `rundown_shares`

All types are in [src/lib/supabase/types.ts](src/lib/supabase/types.ts). The schema is split across `supabase/schema.sql` and `supabase/schema_phase*.sql` files applied incrementally.

Key enum values:
- `cues.cue_type`: `'cue' | 'heading'` — headings act as group headers and are excluded from timing
- `cues.start_type`: `'soft' | 'hard'` — hard-start cues anchor the timing cascade to a wall-clock time
- `rundowns.status`: `'draft' | 'awaiting_data' | 'approved' | 'finalized' | 'rejected'`

### Server actions

All DB mutations live in `src/app/actions/`. They use `'use server'` and call `createClient()` from [src/lib/supabase/server.ts](src/lib/supabase/server.ts). Every action checks auth before touching the DB.

### RundownEditor — the core client component

[src/components/rundown/RundownEditor.tsx](src/components/rundown/RundownEditor.tsx) owns all mutable state for an open rundown: cues, columns, cells (as a flat `Record<"${cueId}:${columnId}", string>` map), mentions, variables, private notes. It follows an **optimistic-update pattern**: update local state immediately, call the server action, roll back on error via `toast.error`.

Per-user view state (hidden columns, collapsed groups) is persisted in `localStorage` under `rundown:{id}:{what}` keys — it is not shared with other users.

### Cue layout and timing pipeline

1. **[cueTree.ts](src/components/rundown/cueTree.ts)** — `buildCueLayout(cues)` turns the flat sorted cue array into a one-level group tree. Cues with `cue_type='heading'` become group headers; regular cues reference their group via `group_id`. Returns `{ items, docOrder, numberOf }`.
2. **[timing.ts](src/lib/timing.ts)** — `calculateTimings(docOrder)` cascades start times. Hard-start cues (`start_type='hard'`) anchor to `start_time_override` (wall-clock HH:MM:SS); soft-start cues follow the previous cue's end. Heading rows pass through without contributing duration.

### Live show transport

[useLiveShow.ts](src/components/rundown/useLiveShow.ts) — wall-clock-based state machine (idle → running → paused). Uses `performance.now()` to accumulate elapsed time across pause/resume cycles. Tracks schedule drift (over/under) across all completed cues. Hard-start cues fire automatically when wall-clock time reaches their `start_time_override`. Soft-start cues with `auto_start=true` advance automatically when their predecessor finishes.

[liveSync.ts](src/components/rundown/liveSync.ts) — Supabase Realtime broadcast to sync live state from operator to read-only viewers. The operator calls `useBroadcastLive`; viewers call `useLiveSubscription`. The operator re-broadcasts every 2 s while live so late-joining viewers catch up.

### Supabase clients

- Server components / actions: `createClient()` from [src/lib/supabase/server.ts](src/lib/supabase/server.ts) (cookie-based SSR client)
- Client components: `createClient()` from [src/lib/supabase/client.ts](src/lib/supabase/client.ts) (browser singleton)

### Sharing

`rundown_shares` rows hold a `token`, a `mode` (`'view' | 'edit'`), and an optional `visible_columns` array. The share page at `/share/[token]` resolves the token server-side and renders [SharedRundownView](src/components/share/SharedRundownView.tsx).

### Export

- PDF: [src/lib/RundownPdf.tsx](src/lib/RundownPdf.tsx) via `@react-pdf/renderer`
- CSV: [src/lib/rundownExport.ts](src/lib/rundownExport.ts)
- Both are served as route handlers under `/rundown/[id]/export/`

### UI conventions

- UI primitives from shadcn/ui live in `src/components/ui/`
- `cn()` from [src/lib/utils.ts](src/lib/utils.ts) merges Tailwind classes
- Toast notifications via `sonner`
- Dark theme throughout (bg-zinc-950 base)

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
