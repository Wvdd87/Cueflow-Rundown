-- ============================================================
-- PHASE 13 — Soft-delete trash for cues and columns
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

ALTER TABLE cues
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE columns
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
