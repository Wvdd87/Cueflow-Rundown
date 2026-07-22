-- ============================================================
-- PHASE 18 — File/image attachments on dropdown (and other) cells
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- `attachments`: array of { url, name, type } uploaded files, independent of
-- the cell's selected dropdown value(s)/content. Lets dropdown-type columns
-- carry the same image/file uploads richtext columns already support inline.
alter table public.cells
  add column if not exists attachments jsonb not null default '[]'::jsonb;
