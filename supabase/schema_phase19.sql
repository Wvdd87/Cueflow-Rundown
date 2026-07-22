-- ============================================================
-- PHASE 19 — "Not final" cue flag + rundown finalize warning
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- Leaf cues only carry this — headings/groups are never "not final" (enforced
-- in the app layer, not the DB, same as other cue_type-conditional fields).
alter table public.cues
  add column if not exists not_final boolean not null default false;
