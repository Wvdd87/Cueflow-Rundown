-- ============================================================
-- PHASE 4 — Advanced cells: mentions, variables, attachments
-- Run this in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- ------------------------------------------------------------
-- MENTIONS  (@-references: name + rich-text description)
-- ------------------------------------------------------------
create table if not exists public.mentions (
  id           uuid primary key default uuid_generate_v4(),
  rundown_id   uuid not null references public.rundowns(id) on delete cascade,
  name         text not null,
  description  text,                 -- rich-text HTML (supports images)
  color        text,                 -- optional accent colour
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.mentions enable row level security;

create policy "team members can manage mentions"
  on public.mentions for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create index if not exists mentions_rundown on public.mentions(rundown_id);

create trigger mentions_updated_at
  before update on public.mentions
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------
-- VARIABLES  ($-tokens: key + value, live-updatable)
-- ------------------------------------------------------------
create table if not exists public.variables (
  id           uuid primary key default uuid_generate_v4(),
  rundown_id   uuid not null references public.rundowns(id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9-]+$'),  -- lowercase-letters-numbers-hyphens
  value        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (rundown_id, key)
);

alter table public.variables enable row level security;

create policy "team members can manage variables"
  on public.variables for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create index if not exists variables_rundown on public.variables(rundown_id);

create trigger variables_updated_at
  before update on public.variables
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------
-- STORAGE  (inline images + file attachments in cells/mentions)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cell-attachments', 'cell-attachments', true)
on conflict (id) do nothing;

-- Public read (bucket is public); authenticated users manage objects.
create policy "public read cell attachments"
  on storage.objects for select
  using (bucket_id = 'cell-attachments');

create policy "authenticated upload cell attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'cell-attachments');

create policy "authenticated update cell attachments"
  on storage.objects for update to authenticated
  using (bucket_id = 'cell-attachments');

create policy "authenticated delete cell attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cell-attachments');
