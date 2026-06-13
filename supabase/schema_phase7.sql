-- ============================================================
-- PHASE 7 — Soft-start auto-advance (auto-start chains)
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- When true, a (soft-start) cue automatically starts as soon as the previous
-- cue's duration elapses while the show is running. Toggled via the down-arrow
-- linking control between cues. Hard-start cues keep their fixed start time.
alter table public.cues
  add column if not exists auto_start boolean not null default false;
