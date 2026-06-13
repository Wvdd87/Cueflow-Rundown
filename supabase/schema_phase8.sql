-- ============================================================
-- PHASE 8 — Rundown status states
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- New states: draft | awaiting_data | approved | finalized | rejected
-- ============================================================

-- 1. Map any legacy values (live/done/archived) to a valid new state first,
--    so the new CHECK constraint can be applied.
update public.rundowns
  set status = 'draft'
  where status not in ('draft', 'awaiting_data', 'approved', 'finalized', 'rejected');

-- 2. Swap the CHECK constraint for the new set.
alter table public.rundowns drop constraint if exists rundowns_status_check;

alter table public.rundowns
  add constraint rundowns_status_check
  check (status in ('draft', 'awaiting_data', 'approved', 'finalized', 'rejected'));
