-- ============================================================
-- PHASE 12 — Rundown display and numbering settings
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

ALTER TABLE rundowns
  ADD COLUMN IF NOT EXISTS time_display text NOT NULL DEFAULT 'auto'
    CHECK (time_display IN ('auto','24h','12h','12h_no_ampm')),
  ADD COLUMN IF NOT EXISTS cue_number_prefix text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cue_number_start integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cue_number_digits integer NOT NULL DEFAULT 1;
