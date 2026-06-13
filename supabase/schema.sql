-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TEAMS (create table first, add RLS policy after profiles exists)
-- ============================================================
create table if not exists public.teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.teams enable row level security;

-- ============================================================
-- PROFILES  (one per auth.user)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  team_id     uuid references public.teams(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "team members can read each other"
  on public.profiles for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

-- Now that profiles exists, add the teams RLS policies
create policy "team members can read their team"
  on public.teams for select
  using (
    id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team owner can update team"
  on public.teams for update
  using (owner_id = auth.uid());

-- ============================================================
-- EVENTS  (folders grouping rundowns)
-- ============================================================
create table if not exists public.events (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  logo_url    text,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "team members can read events"
  on public.events for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can insert events"
  on public.events for insert
  with check (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can update events"
  on public.events for update
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can delete events"
  on public.events for delete
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- RUNDOWNS
-- ============================================================
create table if not exists public.rundowns (
  id           uuid primary key default uuid_generate_v4(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  event_id     uuid references public.events(id) on delete set null,
  name         text not null,
  show_date    date,
  timezone     text not null default 'UTC',
  created_by   uuid not null references auth.users(id),
  is_template  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.rundowns enable row level security;

create policy "team members can read rundowns"
  on public.rundowns for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can insert rundowns"
  on public.rundowns for insert
  with check (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can update rundowns"
  on public.rundowns for update
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can delete rundowns"
  on public.rundowns for delete
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teams_updated_at
  before update on public.teams
  for each row execute function public.handle_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

create trigger rundowns_updated_at
  before update on public.rundowns
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile + team on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_team_id uuid;
begin
  insert into public.teams (name, owner_id)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s Team',
    new.id
  )
  returning id into new_team_id;

  insert into public.profiles (id, email, full_name, team_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new_team_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
