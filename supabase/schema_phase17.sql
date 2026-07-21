-- ============================================================
-- PHASE 17 — Script/talent text blocks + auto-duration from script length
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- `scripts`: array of { id, content, collapsed } script/talent text blocks
-- rendered as a full-width drawer under the cue row (not a column cell).
-- `duration_mode`: when 'auto', the cue's duration_ms is derived from the
-- combined word count of its scripts (150 wpm) instead of being manually set.
alter table public.cues
  add column if not exists scripts jsonb not null default '[]'::jsonb,
  add column if not exists duration_mode text not null default 'manual'
    check (duration_mode in ('manual', 'auto'));

-- get_shared_rundown() (schema_phase16.sql) already serializes full cue rows
-- via to_jsonb(cu), so scripts/duration_mode flow through to share links
-- automatically — no function change needed.
