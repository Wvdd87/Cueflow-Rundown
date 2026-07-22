-- ============================================================
-- PHASE 20 — Collaboration links (editable, role-based shared access)
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
--
-- Phase 1 of #64: data model + link management + permission-gated cell
-- editing and cue add/delete from an unauthenticated collaboration link.
-- Leader/show-control election and live presence cursors are a later phase.
-- ============================================================

-- `id` is the token itself (used directly in the URL, e.g. /share/collab/{id}).
create table if not exists public.collaboration_links (
  id                     text primary key default replace(uuid_generate_v4()::text, '-', ''),
  rundown_id             uuid not null references public.rundowns(id) on delete cascade,
  label                  text not null,
  editable_columns       jsonb not null default '[]'::jsonb, -- array of column ids (text)
  can_add_delete_cues    boolean not null default false,
  can_add_delete_columns boolean not null default false,
  can_run_show           boolean not null default false,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);

alter table public.collaboration_links enable row level security;

create policy "team members manage collaboration links"
  on public.collaboration_links for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create index if not exists collaboration_links_rundown on public.collaboration_links(rundown_id);

-- ------------------------------------------------------------
-- Public reader (security definer, bypasses RLS): full rundown payload plus
-- this link's own permissions. Returns null for an unknown token, and
-- {"revoked": true} for a deactivated one (distinct so the page can show a
-- "this link has been revoked" message instead of a generic 404).
-- ------------------------------------------------------------
create or replace function public.get_collab_rundown(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_link public.collaboration_links;
  result jsonb;
begin
  select * into v_link from public.collaboration_links where id = p_token;

  if v_link.id is null then
    return null;
  end if;

  if not v_link.active then
    return jsonb_build_object('revoked', true);
  end if;

  select jsonb_build_object(
    'rundown', (select to_jsonb(r) from public.rundowns r where r.id = v_link.rundown_id),
    'collab', jsonb_build_object(
      'label', v_link.label,
      'editableColumns', v_link.editable_columns,
      'canAddDeleteCues', v_link.can_add_delete_cues,
      'canAddDeleteColumns', v_link.can_add_delete_columns,
      'canRunShow', v_link.can_run_show
    ),
    'columns', coalesce(
      (select jsonb_agg(to_jsonb(c) order by c.position)
         from public.columns c
         where c.rundown_id = v_link.rundown_id
           and c.deleted_at is null), '[]'::jsonb),
    'cues', coalesce(
      (select jsonb_agg(to_jsonb(cu) order by cu.position)
         from public.cues cu
         where cu.rundown_id = v_link.rundown_id
           and cu.deleted_at is null), '[]'::jsonb),
    'cells', coalesce(
      (select jsonb_agg(to_jsonb(ce))
         from public.cells ce
         where ce.cue_id in (
           select id from public.cues
           where rundown_id = v_link.rundown_id
             and deleted_at is null
         )), '[]'::jsonb),
    'variables', coalesce(
      (select jsonb_agg(to_jsonb(v))
         from public.variables v where v.rundown_id = v_link.rundown_id), '[]'::jsonb),
    'mentions', coalesce(
      (select jsonb_agg(to_jsonb(m))
         from public.mentions m where m.rundown_id = v_link.rundown_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_collab_rundown(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Write: upsert a cell — only if the link is active and the column is in
-- this link's editable_columns set.
-- ------------------------------------------------------------
create or replace function public.collab_upsert_cell(
  p_token       text,
  p_cue_id      uuid,
  p_column_id   uuid,
  p_content     text,
  p_attachments jsonb default null
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
  if not (v_link.editable_columns @> to_jsonb(p_column_id::text)) then
    raise exception 'Column is not editable via this link';
  end if;
  if not exists (
    select 1 from public.cues
    where id = p_cue_id and rundown_id = v_link.rundown_id and deleted_at is null
  ) then
    raise exception 'Cue does not belong to this rundown';
  end if;

  insert into public.cells (cue_id, column_id, content, attachments)
  values (p_cue_id, p_column_id, p_content, coalesce(p_attachments, '[]'::jsonb))
  on conflict (cue_id, column_id)
  do update set content = excluded.content, attachments = excluded.attachments, updated_at = now();
end;
$$;

grant execute on function public.collab_upsert_cell(text, uuid, uuid, text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- Write: append a cue at the end of the rundown — only when
-- can_add_delete_cues is granted.
-- ------------------------------------------------------------
create or replace function public.collab_add_cue(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links;
  v_next_pos int;
  v_cue public.cues;
begin
  select * into v_link from public.collaboration_links where id = p_token;
  if v_link.id is null or not v_link.active then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  if not v_link.can_add_delete_cues then
    raise exception 'This link cannot add cues';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
    from public.cues where rundown_id = v_link.rundown_id;

  insert into public.cues (rundown_id, position, cue_number, title, duration_ms)
  values (v_link.rundown_id, v_next_pos, '', '', 0)
  returning * into v_cue;

  return to_jsonb(v_cue);
end;
$$;

grant execute on function public.collab_add_cue(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Write: soft-delete a cue — only when can_add_delete_cues is granted.
-- ------------------------------------------------------------
create or replace function public.collab_delete_cue(p_token text, p_cue_id uuid)
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
  if not v_link.can_add_delete_cues then
    raise exception 'This link cannot delete cues';
  end if;
  if not exists (select 1 from public.cues where id = p_cue_id and rundown_id = v_link.rundown_id) then
    raise exception 'Cue does not belong to this rundown';
  end if;

  update public.cues set deleted_at = now() where id = p_cue_id;
end;
$$;

grant execute on function public.collab_delete_cue(text, uuid) to anon, authenticated;
