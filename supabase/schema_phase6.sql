-- ============================================================
-- PHASE 6 — Cue groups / headings
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- A cue's parent group (null = top-level). A "group" is a cue with
-- cue_type = 'heading'; its members reference it via group_id.
-- Deleting a group heading ungroups its members (does not delete them).
alter table public.cues
  add column if not exists group_id uuid references public.cues(id) on delete set null;

create index if not exists cues_group on public.cues(group_id);
