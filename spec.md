# Rundown Studio — Rebuild Specification

## 1. Product Overview

**Rundown Studio** is a real-time collaborative show management platform for live production teams — broadcast directors, show callers, event producers, and their crews. Its core purpose is to keep live shows on time by providing a shared, synchronised rundown document with smart timing calculations and live playback controls.

**Target users:** Show callers, broadcast directors, production managers, stage managers, podcast producers, church A/V teams, esports event operators.

**Core value props:**
- Smart automatic timing (cascade-recalculate when any duration changes)
- Live show execution controls (play/pause/next cue) with real-time sync across all viewers
- Built-in teleprompter driven by the active cue's script
- Unlimited read-only guests at no extra cost
- API + WebSocket for hardware/software integrations (Stream Deck, QLab, etc.)

---

## 2. Data Model

```
Team
 └── Events (folders)
      └── Rundowns
           ├── Columns (user-defined, ordered)
           │    └── Cells (per cue × per column)
           ├── Cues (ordered list)
           │    ├── cue_number (display label)
           │    ├── start_time (hard or soft)
           │    ├── duration (HH:MM:SS)
           │    ├── title / description
           │    ├── background_color
           │    ├── locked (bool)
           │    └── type: "cue" | "heading" | "group"
           ├── Mentions (@ entities — crew, cameras, positions)
           └── Text Variables ($ dynamic values)
```

### Cue Start Time Types
| Type | Behaviour |
|------|-----------|
| **Soft** | Begins when the preceding cue ends; cascades through all subsequent soft cues |
| **Hard** | Fixed wall-clock time; creates visible gap or overlap relative to the previous cue |

---

## 3. Feature Inventory

### 3.1 Dashboard

- List of standalone rundowns and event folders, sorted by last modified
- Templates section (separate from active rundowns)
- Create new rundown (blank or from template)
- Create new event folder
- Move rundown into an event
- Duplicate rundown or entire event (including all contained rundowns)
- Rename / delete rundown or event
- Search/filter (implied by scale of usage)

### 3.2 Event Folders

- Group multiple rundowns under a single named event
- Custom logo upload → removes Rundown Studio branding from all rundowns and shared PDF exports inside the event
- Share entire event with guests via invitation link
- Duplicate full event with all rundowns

### 3.3 Rundown Editor

#### 3.3.1 Cue List

Each cue row (left to right):

| Element | Detail |
|---------|--------|
| Settings icon | Opens per-cue options menu |
| Cue number | Editable display label (e.g. "1", "1A", "INTRO") |
| Start time | Calculated (soft) or fixed (hard); styled differently |
| Duration | Editable; format HH:MM:SS; Enter/click-outside to save, Esc to cancel |
| Title / Description | Primary richtext field for cue name |
| Cells | One cell per defined column |

**Hover state:** reveals full edit affordances for each section.

#### 3.3.2 Batch Operations

Activate batch menu by clicking any cue number. Hold Shift to multi-select.

Available operations:
- Select all cues
- Duplicate selected
- Group / ungroup cues
- Move to position
- Change background colour
- Delete selected
- Clear selection

#### 3.3.3 Cue Groups / Headings

Cues can be grouped; groups act as collapsible sections with their own aggregate timing display.

### 3.4 Column Management

- **Add column** — button to the right of last column header
- **Rename** — click header name, type, Enter to save
- **Reorder** — drag-and-drop via reorder icon on header
- **Resize** — drag resize handle between headers
- **Hide (personal)** — "Hide for me" in `…` menu; eye icon to restore; does not affect other users
- **Delete** — removes column and all its cells for everyone; recoverable via Trash

**Special column — Private Notes:**
- Always present, visible only to the signed-in user
- Cannot be deleted or shared

#### Cell Types

| Type | Capabilities |
|------|-------------|
| **Richtext** | Bold/italic/underline, text colour, highlighting, bullet lists, inline images (drag-and-drop), file attachments (PDF, DOCX, CSV, video, audio) |
| **Dropdown** | Predefined option set; options editable via "Edit options" modal |

### 3.5 Timing System

- **Auto-recalculate:** changing any cue's duration immediately recascades start times for all subsequent soft-start cues
- **Gap indicator:** positive gap between a hard-start cue and the previous cue's end = unused buffer (acceptable)
- **Overlap indicator:** negative gap = conflict that must be resolved before running
- **Floating bar (hard-start warning):** appears while running to show the next upcoming hard-start cue, countdown to it, gap/overlap delta, and cue title. Clicking scrolls to that cue.

### 3.6 Show Running (Live Mode)

#### Transport Controls

| Control | Behaviour |
|---------|-----------|
| **Play** | Starts timer for the current cue |
| **Pause** | Freezes all active timers |
| **Next Cue** | Advances to next cue (last cue → becomes "End" button) |
| **Jump to cue** | Click any cue number to make it the active cue |

#### Visual Feedback

- Active cue: highlighted / colour-coded background
- Next cue: pulsing white border
- Auto-scroll: rundown scrolls to keep active cue in view

#### Timer Adjustment (during live execution)

- Quick buttons: **−1m / +1m** on the transport bar
- Dropdown calculator:
  - Preset nudges: 10s, 30s, 1m, 5m, 10m (positive and negative)
  - Numpad for arbitrary duration entry
  - Keyboard input supported

#### Auto-Start

**Hard-start cues:** Set the rundown date (header), then enable auto-start via the arrow icon on the cue. The cue fires automatically at its wall-clock time. (Cannot be in the past.)

**Soft-start cues:** Click the linking line that appears on hover between cues to chain auto-advance. When the current cue's duration elapses, the next cue starts automatically. Chains can span multiple cues.

### 3.7 Mentions

- Triggered by `@` in any cell
- Created and managed in the Rundown Settings modal
- Each mention has: **Name** + **Rich-text description** (supports images)
- Hover over a mention inline → popup with full description
- Editing a mention updates every instance across the rundown instantly
- Accessible via public API (CRUD)

**Common use cases:** crew headshots, camera positions, sponsor logos, venue floor plans, guest bios with name pronunciations, emergency contacts.

### 3.8 Text Variables

- Triggered by `$` in any cell
- Key format: `lowercase-letters-numbers-hyphens` (e.g. `crew-lunch-location`)
- Value: free text, updatable at any time
- Live update: all viewers see new value instantly without page refresh
- Accessible via public API (get, create, delete, bulk-update)

**Common use cases:** video asset durations, call times, guest/sponsor names for lower-thirds, venue names for graphics.

### 3.9 Templates

- Any rundown can be saved as a template from the rundown context menu
- Templates appear in a dedicated section on the dashboard
- When creating a new rundown, user can pick a template or start blank
- Stores column structure, cue skeleton, and settings; reuse as many times as needed

### 3.10 Sharing & Outputs

| Output | Description |
|--------|-------------|
| **Read-only link** | Shareable URL; guests see the live rundown with auto-scroll but cannot edit |
| **Editable link** | Shareable URL granting edit access without a login |
| **PDF export** | Snapshot of rundown at export time; respects event branding/logo |
| **CSV export** | Tabular export of all cues and cells |
| **Prompter view** | Dedicated full-screen teleprompter; syncs scroll position to active cue's script |

### 3.11 Teleprompter (Prompter)

- Full-screen mode, separate URL/view
- Displays the script content (richtext cell) of each cue
- Automatically advances and syncs scroll position when the active cue changes during a live show
- Designed for professional talent reading to camera

### 3.12 Rundown Settings

Accessible from the rundown header menu:

- **Rundown name** — rename
- **Date** — sets the wall-clock reference for hard-start times and auto-start
- **Timezone** — used for start time display and auto-start scheduling
- **Mentions** — manage @ entities
- **Text Variables** — manage $ variables
- **Trash** — recover deleted columns and cues

### 3.13 Integrations

#### HTTP API

- Base URL: `https://app.rundownstudio.app/api-v0/rundown/{rundown_id}/{action}`
- Auth: `?token=API_TOKEN` query param
- Actions: `start`, `pause`, `next`
- Rate limit: 60 requests/minute per team (sliding window); returns HTTP 429 with `RateLimit-*` headers
- Full Swagger docs at `/api-v0/docs/`
- Also supports: mentions CRUD, text variables CRUD

#### WebSocket (socket.io)

- Endpoint: `wss://socket.rundownstudio.app` with path `/api-v0/socket.io`
- Auth: `{ rundownId, apiToken }` passed as auth object on connect
- Events emitted by server (only on state change, not on connect):

| Event | Payload |
|-------|---------|
| `serverTime` | ISO timestamp (emitted every 30s) |
| `rundown` | Rundown metadata |
| `currentCue` | `{ id, type, title, duration, backgroundColor, locked }` |
| `nextCue` | Same shape as currentCue |
| `timesnap` | `{ lastStop, kickoff, running, cueId, deadline }` (all in ms) |

**Note:** Server only emits on change. Newly connected clients must wait for the next state change to receive current state.

#### Bitfocus Companion

- Official Companion module available
- Enables hardware button control (Stream Deck, etc.) for play/pause/next

#### QLab

- Integration documented (likely via HTTP API or OSC bridge)

#### CSV Import

- Import rundowns from Google Sheets or Excel CSV
- Field mapping to cue structure

---

## 4. UI Layout

### 4.1 Marketing Site

```
Header: Logo | Product · Features · Use Cases · Resources | Pricing | Log In | Get Started (CTA)
Hero: "Keep your show on time" headline + live demo embed (Summer Festival Rundown)
Feature sections: Smart Timing · Live Tracking · Teleprompter · Collaboration
Use case gallery with images
Testimonial cards
FAQ accordion
Footer: product links · resources · social
```

### 4.2 App — Dashboard

```
Sidebar / Top nav: Team name, navigation links (Rundowns, Templates, Settings)
Main area:
  ┌─ Events section ──────────────────────────────────┐
  │  [Event Card] [Event Card] [+ New Event]           │
  └───────────────────────────────────────────────────┘
  ┌─ Rundowns section ────────────────────────────────┐
  │  [Rundown Card] [Rundown Card] [+ New Rundown]     │
  └───────────────────────────────────────────────────┘
  ┌─ Templates section ───────────────────────────────┐
  │  [Template Card] (or empty state prompt)           │
  └───────────────────────────────────────────────────┘
```

### 4.3 App — Rundown Editor

```
┌─ Rundown Header ───────────────────────────────────────────────────────┐
│  [← Back]  Rundown Name   [Date/Time]  [Settings ⚙]  [Share]  [Play ▶]│
└────────────────────────────────────────────────────────────────────────┘
┌─ Column Headers ───────────────────────────────────────────────────────┐
│  [#] [Start] [Duration] [Title]  [Col A] [Col B] [Col C]  [+ Add Col] │
└────────────────────────────────────────────────────────────────────────┘
┌─ Cue Rows (scrollable) ────────────────────────────────────────────────┐
│  [⚙] [1]  [09:00:00]  [0:05:00]  [Opening Remarks]  [Cell] [Cell] ... │
│  [⚙] [2]  [09:05:00]  [0:10:00]  [Keynote]          [Cell] [Cell] ... │
│  ...                                                                    │
│  [+ Add Cue]                                                           │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.4 App — Live / Show Running Mode

```
┌─ Transport Bar ────────────────────────────────────────────────────────┐
│  [⏸ Pause]  [▶ Next Cue]   CURRENT: "Keynote"  ⏱ 00:07:23 remaining │
│  [-1m] [+1m ▾]                                                         │
└────────────────────────────────────────────────────────────────────────┘
┌─ Cue List (auto-scrolling) ────────────────────────────────────────────┐
│  [1] Opening Remarks  ✓ DONE                                           │
│  [2] Keynote          ← ACTIVE (highlighted background)               │
│  [3] Q&A              ← NEXT (pulsing border)                         │
│  [4] Closing          ...                                              │
└────────────────────────────────────────────────────────────────────────┘
[Floating Bar if hard-start upcoming]: "Next hard start: 10:00:00 · in 12:37 · +2:00 gap"
```

---

## 5. Authentication & Team Model

- Email/password signup (no credit card for free tier)
- Team-based: each account belongs to a team
- API tokens: generated by team admins; scoped per team
- Guest access: via shareable links (no account required for read-only or editable guest links)
- Event guest invitations: email-based invitation links

---

## 6. Pricing Tiers

| Tier | Price | Members | Rundowns | Access |
|------|-------|---------|----------|--------|
| **Solo** | Free | 1 | Limited | Read-only guests only |
| **Event** | $25 | 2 | Unlimited | 10–20 day access window |
| **Team** | $600/year | 2 | Unlimited | Ongoing; all features |

---

## 7. Proposed Tech Stack for Rebuild

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | SSR for marketing, CSR for app |
| Language | TypeScript | Required by coding standards |
| Styling | Tailwind CSS v4 | Required by coding standards |
| UI Components | shadcn/ui | Accessible, composable, unstyled base |
| Realtime | Supabase Realtime or Liveblocks | WebSocket presence + document sync |
| Database | Supabase (Postgres) | Auth + DB + Storage in one |
| Auth | Supabase Auth | Email/password + magic link |
| Rich text | TipTap | ProseMirror-based, extensible for @-mentions and $-variables |
| Drag-and-drop | @dnd-kit | Accessible, TypeScript-first |
| File storage | Supabase Storage | For cell attachments, logos |
| Exports | react-pdf + PapaParse | PDF and CSV generation |
| API | Next.js Route Handlers | REST endpoints |
| Deployment | Vercel | Edge-ready, preview URLs |

---

## 8. Proposed File Structure

```
src/
├── app/
│   ├── (marketing)/          # Public marketing pages
│   │   ├── page.tsx          # Homepage
│   │   ├── pricing/
│   │   └── use-cases/
│   ├── (app)/                # Authenticated app
│   │   ├── dashboard/
│   │   ├── rundown/[id]/
│   │   │   ├── page.tsx      # Editor view
│   │   │   └── live/         # Show running mode
│   │   ├── prompter/[id]/    # Teleprompter full-screen
│   │   └── settings/
│   ├── api/
│   │   └── v0/               # Public API routes
│   └── share/[token]/        # Read-only / editable guest views
├── components/
│   ├── rundown/
│   │   ├── CueRow.tsx
│   │   ├── CueList.tsx
│   │   ├── ColumnHeader.tsx
│   │   ├── CellRichtext.tsx
│   │   ├── CellDropdown.tsx
│   │   ├── BatchToolbar.tsx
│   │   └── TimingBadge.tsx
│   ├── live/
│   │   ├── TransportBar.tsx
│   │   ├── TimerAdjuster.tsx
│   │   └── FloatingHardStartBar.tsx
│   ├── prompter/
│   │   └── PrompterView.tsx
│   └── ui/                   # shadcn base components
├── lib/
│   ├── timing.ts             # Cascade recalculation logic
│   ├── supabase/
│   └── api/
└── types/
    ├── rundown.ts
    ├── cue.ts
    └── column.ts
```

---

## 9. Build Phases

| Phase | Scope |
|-------|-------|
| **1 — Foundation** | Auth, dashboard, create/list rundowns and events |
| **2 — Rundown Editor** | Cue list, column management, richtext cells, timing calculation |
| **3 — Live Mode** | Transport controls, timer, auto-scroll, auto-advance chains |
| **4 — Advanced Cells** | Dropdown cells, file uploads, @-mentions, $-variables |
| **5 — Sharing & Outputs** | Read-only links, PDF export, CSV import/export |
| **6 — Teleprompter** | Prompter view synced to live cue |
| **7 — Integrations** | HTTP API, WebSocket, Companion module docs |
| **8 — Polish** | Templates, trash/recovery, branding, mobile responsiveness |

---

## 10. Key UX Details to Replicate

- Cue rows reveal edit affordances only on hover (keeps the grid scannable when not editing)
- Duration field: click to edit inline, Enter or click-outside to save, Esc to cancel — no modal
- Column resize: drag handle appears between headers on hover
- Batch select: clicking the cue number activates it; Shift+click extends selection
- Hard-start cues visually distinct from soft-start cues (different time label style)
- Gap/overlap coloured indicators on the cue start time (green gap, red overlap)
- Next cue pulsing border is a key live-mode affordance — must feel real-time
- Private notes column always on the right, visually separated with a lock icon
- Mentions hover popup appears with a short delay (not instant) to avoid noise
- Text variable inline display shows current value, not the variable key
