-- ============================================================
-- COLUMNS (user-defined columns in a rundown)
-- ============================================================
create table if not exists public.columns (
  id          uuid primary key default uuid_generate_v4(),
  rundown_id  uuid not null references public.rundowns(id) on delete cascade,
  name        text not null,
  col_type    text not null default 'richtext' check (col_type in ('richtext', 'dropdown')),
  position    int  not null default 0,
  width       int  not null default 200,
  options     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.columns enable row level security;

create policy "team members can manage columns"
  on public.columns for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create index columns_rundown_position on public.columns(rundown_id, position);

-- ============================================================
-- CUES (individual show items in a rundown)
-- ============================================================
create table if not exists public.cues (
  id                   uuid primary key default uuid_generate_v4(),
  rundown_id           uuid not null references public.rundowns(id) on delete cascade,
  position             int  not null default 0,
  cue_number           text not null default '',
  cue_type             text not null default 'cue' check (cue_type in ('cue', 'heading')),
  title                text not null default '',
  start_type           text not null default 'soft' check (start_type in ('soft', 'hard')),
  start_time_override  text,    -- HH:MM:SS, only relevant when start_type='hard'
  duration_ms          int  not null default 0,
  background_color     text,
  locked               boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.cues enable row level security;

create policy "team members can manage cues"
  on public.cues for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create index cues_rundown_position on public.cues(rundown_id, position);

create trigger cues_updated_at
  before update on public.cues
  for each row execute function public.handle_updated_at();

-- ============================================================
-- CELLS (cue × column content)
-- ============================================================
create table if not exists public.cells (
  id         uuid primary key default uuid_generate_v4(),
  cue_id     uuid not null references public.cues(id) on delete cascade,
  column_id  uuid not null references public.columns(id) on delete cascade,
  content    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cue_id, column_id)
);

alter table public.cells enable row level security;

create policy "team members can manage cells"
  on public.cells for all
  using (
    cue_id in (
      select c.id from public.cues c
      join public.rundowns r on r.id = c.rundown_id
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create trigger cells_updated_at
  before update on public.cells
  for each row execute function public.handle_updated_at();
