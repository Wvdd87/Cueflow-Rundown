-- ============================================================
-- PHASE 15 — Event date, location, archived
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

alter table public.events add column if not exists event_date date;
alter table public.events add column if not exists location   text;
alter table public.events add column if not exists archived   boolean not null default false;

create index if not exists events_event_date on public.events(event_date);
create index if not exists events_archived   on public.events(archived);
