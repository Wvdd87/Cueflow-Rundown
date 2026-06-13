-- ============================================================
-- PHASE 5 — Editor polish: subtitle, status, option colours, private notes
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- Cue subtitle (secondary line under the title)
alter table public.cues
  add column if not exists subtitle text;

-- Rundown status (Draft / Live / Done / Archived) — drives the header badge
alter table public.rundowns
  add column if not exists status text not null default 'draft'
  check (status in ('draft', 'live', 'done', 'archived'));

-- Per-option colours for dropdown columns: { "Option 1": "#7f1d1d", ... }
alter table public.columns
  add column if not exists option_colors jsonb;

-- ------------------------------------------------------------
-- PRIVATE NOTES  (per-user, per-cue — visible only to the author)
-- ------------------------------------------------------------
create table if not exists public.private_notes (
  id          uuid primary key default uuid_generate_v4(),
  cue_id      uuid not null references public.cues(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cue_id, user_id)
);

alter table public.private_notes enable row level security;

-- Only the author can read/write their own notes
create policy "users manage their own private notes"
  on public.private_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists private_notes_cue on public.private_notes(cue_id);

create trigger private_notes_updated_at
  before update on public.private_notes
  for each row execute function public.handle_updated_at();
