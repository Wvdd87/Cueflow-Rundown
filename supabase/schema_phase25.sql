-- ============================================================
-- PHASE 25 — Conditional rules (#65).
-- Rules are a small, owner-only-edited JSONB array stored directly on the
-- rundown (see RundownRule in src/lib/supabase/types.ts) — no separate table,
-- since they're evaluated entirely client-side and never queried relationally.
-- Existing RLS on rundowns already covers reads/writes; collaborators read
-- rules through get_collab_rundown's `to_jsonb(r)`, which picks this column
-- up automatically.
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

alter table public.rundowns
  add column if not exists rules jsonb not null default '[]'::jsonb;
