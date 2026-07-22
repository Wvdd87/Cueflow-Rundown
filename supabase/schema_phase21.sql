-- ============================================================
-- PHASE 21 — Collaboration links, round 2:
--   - title is always editable (not gated by editable_columns)
--   - collaborators can create/edit/delete mentions + variables
--   - a lightweight single-leader system so a collaborator with
--     can_run_show can actually drive the live show without
--     colliding with the owner's broadcast
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- ------------------------------------------------------------
-- Title is a cue-level field, not a column — any active collaboration
-- link may edit it, regardless of editable_columns.
-- ------------------------------------------------------------
create or replace function public.collab_update_title(
  p_token  text,
  p_cue_id uuid,
  p_title  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  if not exists (
    select 1 from public.cues
    where id = p_cue_id and rundown_id = v_link.rundown_id and deleted_at is null
  ) then
    raise exception 'Cue does not belong to this rundown';
  end if;

  update public.cues set title = p_title, updated_at = now() where id = p_cue_id;
end;
$$;

grant execute on function public.collab_update_title(text, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Mentions — any active collaboration link may create/update/delete.
-- ------------------------------------------------------------
create or replace function public.collab_add_mention(
  p_token       text,
  p_name        text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
  v_row public.mentions;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;

  insert into public.mentions (rundown_id, name, description)
  values (v_link.rundown_id, p_name, p_description)
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.collab_update_mention(
  p_token       text,
  p_id          uuid,
  p_name        text default null,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  if not exists (select 1 from public.mentions where id = p_id and rundown_id = v_link.rundown_id) then
    raise exception 'Mention does not belong to this rundown';
  end if;

  update public.mentions
     set name = coalesce(p_name, name),
         description = p_description,
         updated_at = now()
   where id = p_id;
end;
$$;

create or replace function public.collab_delete_mention(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  delete from public.mentions where id = p_id and rundown_id = v_link.rundown_id;
end;
$$;

grant execute on function public.collab_add_mention(text, text, text)    to anon, authenticated;
grant execute on function public.collab_update_mention(text, uuid, text, text) to anon, authenticated;
grant execute on function public.collab_delete_mention(text, uuid)       to anon, authenticated;

-- ------------------------------------------------------------
-- Variables — any active collaboration link may create/update/delete.
-- ------------------------------------------------------------
create or replace function public.collab_add_variable(
  p_token text,
  p_key   text,
  p_value text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
  v_row public.variables;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;

  insert into public.variables (rundown_id, key, value)
  values (v_link.rundown_id, p_key, p_value)
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.collab_update_variable(
  p_token text,
  p_id    uuid,
  p_key   text default null,
  p_value text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  if not exists (select 1 from public.variables where id = p_id and rundown_id = v_link.rundown_id) then
    raise exception 'Variable does not belong to this rundown';
  end if;

  update public.variables
     set key = coalesce(p_key, key),
         value = coalesce(p_value, value),
         updated_at = now()
   where id = p_id;
end;
$$;

create or replace function public.collab_delete_variable(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  delete from public.variables where id = p_id and rundown_id = v_link.rundown_id;
end;
$$;

grant execute on function public.collab_add_variable(text, text, text)      to anon, authenticated;
grant execute on function public.collab_update_variable(text, uuid, text, text) to anon, authenticated;
grant execute on function public.collab_delete_variable(text, uuid)         to anon, authenticated;

-- ------------------------------------------------------------
-- Single-leader show control. `leader_token is null` means the owner is
-- driving (the default — unchanged behavior for rundowns nobody has taken
-- control of). A collaboration link can only take control if can_run_show.
-- ------------------------------------------------------------
create table if not exists public.rundown_leader (
  rundown_id   uuid primary key references public.rundowns(id) on delete cascade,
  leader_token text,
  leader_label text not null default 'Owner',
  taken_at     timestamptz not null default now()
);

alter table public.rundown_leader enable row level security;

create policy "team members manage rundown leader"
  on public.rundown_leader for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

-- Public reader (security definer): anyone with the rundown id can see who's
-- currently leading — needed by anonymous collaborator/read-only viewers.
create or replace function public.get_rundown_leader(p_rundown_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row public.rundown_leader;
begin
  select * into v_row from public.rundown_leader where rundown_id = p_rundown_id;
  if v_row.rundown_id is null then
    return jsonb_build_object('leaderToken', null, 'leaderLabel', 'Owner');
  end if;
  return jsonb_build_object('leaderToken', v_row.leader_token, 'leaderLabel', v_row.leader_label);
end;
$$;

grant execute on function public.get_rundown_leader(uuid) to anon, authenticated;

-- Owner reclaims control (authenticated, RLS-gated table write also works,
-- but a function keeps the upsert one round trip).
create or replace function public.take_show_control(p_rundown_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.rundowns r
    join public.profiles p on p.team_id = r.team_id
    where r.id = p_rundown_id and p.id = auth.uid()
  ) then
    raise exception 'Not authorized for this rundown';
  end if;

  insert into public.rundown_leader (rundown_id, leader_token, leader_label, taken_at)
  values (p_rundown_id, null, 'Owner', now())
  on conflict (rundown_id)
  do update set leader_token = null, leader_label = 'Owner', taken_at = now();
end;
$$;

grant execute on function public.take_show_control(uuid) to authenticated;

-- Collaborator takes control — only if can_run_show is granted.
create or replace function public.collab_take_control(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  if not v_link.can_run_show then
    raise exception 'This link cannot take show control';
  end if;

  insert into public.rundown_leader (rundown_id, leader_token, leader_label, taken_at)
  values (v_link.rundown_id, v_link.id, v_link.label, now())
  on conflict (rundown_id)
  do update set leader_token = v_link.id, leader_label = v_link.label, taken_at = now();
end;
$$;

grant execute on function public.collab_take_control(text) to anon, authenticated;
