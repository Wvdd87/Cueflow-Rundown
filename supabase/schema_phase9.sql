-- ============================================================
-- PHASE 9 — Trash / recovery (soft-delete rundowns)
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- Soft-delete marker. Deleting a rundown sets deleted_at; the Trash view lists
-- rows where deleted_at is not null, with Restore / Delete forever.
alter table public.rundowns
  add column if not exists deleted_at timestamptz;

create index if not exists rundowns_deleted on public.rundowns(deleted_at);
