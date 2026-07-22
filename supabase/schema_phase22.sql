-- ============================================================
-- PHASE 22 — Full editor parity for collaboration links.
--
-- A collaborator (any active link) can now do everything the admin editor
-- can do to cue content and columns — reorder/resize/rename columns, reorder
-- cues, recolor, script, duration, not-final, add/duplicate/delete cues —
-- with the ONE remaining restriction being which columns are editable
-- (editable_columns, enforced in collab_upsert_cell from schema_phase20).
-- Group/ungroup and rundown-level "project management" (settings, trash,
-- templates, sharing, rename rundown) are intentionally NOT exposed here.
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- Superseded by the richer, ungated versions below — schema_phase20/21 gated
-- these on can_add_delete_cues, which no longer exists as a distinct
-- permission (see the header comment above).
drop function if exists public.collab_add_cue(text);
drop function if exists public.collab_delete_cue(text, uuid);

create or replace function public.collab_link_or_raise(p_token text)
returns public.collaboration_links
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
  return v_link;
end;
$$;

-- ------------------------------------------------------------
-- Cues
-- ------------------------------------------------------------
create or replace function public.collab_get_rundown_cues(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  return jsonb_build_object(
    'cues', coalesce(
      (select jsonb_agg(to_jsonb(cu) order by cu.position)
         from public.cues cu where cu.rundown_id = v_link.rundown_id and cu.deleted_at is null), '[]'::jsonb),
    'cells', coalesce(
      (select jsonb_agg(to_jsonb(ce))
         from public.cells ce
         where ce.cue_id in (select id from public.cues where rundown_id = v_link.rundown_id and deleted_at is null)),
      '[]'::jsonb)
  );
end;
$$;

create or replace function public.collab_add_cue(
  p_token          text,
  p_after_position int,
  p_group_id       uuid default null,
  p_cue_type       text default 'cue'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_cue public.cues;
begin
  update public.cues set position = position + 1
   where rundown_id = v_link.rundown_id and position > p_after_position;

  insert into public.cues (rundown_id, position, cue_number, cue_type, title, duration_ms, group_id)
  values (v_link.rundown_id, p_after_position + 1, '', p_cue_type, '', 0, p_group_id)
  returning * into v_cue;

  return to_jsonb(v_cue);
end;
$$;

create or replace function public.collab_update_cue(p_token text, p_cue_id uuid, p_updates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_allowed_keys text[] := array[
    'title','subtitle','cue_number','duration_ms','duration_mode','scripts',
    'not_final','start_type','start_time_override','auto_start',
    'background_color','locked','group_id','cue_type'
  ];
  v_key text;
  v_patch jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from public.cues where id = p_cue_id and rundown_id = v_link.rundown_id) then
    raise exception 'Cue does not belong to this rundown';
  end if;
  for v_key in select jsonb_object_keys(p_updates) loop
    if v_key = any(v_allowed_keys) then
      v_patch := v_patch || jsonb_build_object(v_key, p_updates -> v_key);
    end if;
  end loop;

  update public.cues set
    title = coalesce(v_patch->>'title', title),
    subtitle = case when v_patch ? 'subtitle' then v_patch->>'subtitle' else subtitle end,
    cue_number = coalesce(v_patch->>'cue_number', cue_number),
    duration_ms = coalesce((v_patch->>'duration_ms')::int, duration_ms),
    duration_mode = coalesce(v_patch->>'duration_mode', duration_mode),
    scripts = coalesce(v_patch->'scripts', scripts),
    not_final = coalesce((v_patch->>'not_final')::boolean, not_final),
    start_type = coalesce(v_patch->>'start_type', start_type),
    start_time_override = case when v_patch ? 'start_time_override' then v_patch->>'start_time_override' else start_time_override end,
    auto_start = coalesce((v_patch->>'auto_start')::boolean, auto_start),
    background_color = case when v_patch ? 'background_color' then v_patch->>'background_color' else background_color end,
    locked = coalesce((v_patch->>'locked')::boolean, locked),
    group_id = case when v_patch ? 'group_id' then (v_patch->>'group_id')::uuid else group_id end,
    cue_type = coalesce(v_patch->>'cue_type', cue_type),
    updated_at = now()
  where id = p_cue_id;
end;
$$;

create or replace function public.collab_delete_cue(p_token text, p_cue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.cues set deleted_at = now()
   where id = p_cue_id and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_restore_cue(p_token text, p_cue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.cues set deleted_at = null
   where id = p_cue_id and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_delete_cues(p_token text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.cues set deleted_at = now()
   where id = any(p_ids) and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_reorder_cues(p_token text, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_id uuid;
  v_pos int := 0;
begin
  foreach v_id in array p_ordered_ids loop
    update public.cues set position = v_pos where id = v_id and rundown_id = v_link.rundown_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

create or replace function public.collab_set_cues_background(p_token text, p_ids uuid[], p_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.cues set background_color = p_color, updated_at = now()
   where id = any(p_ids) and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_duplicate_cues(p_token text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_src record;
  v_new_id uuid;
  v_map jsonb := '{}'::jsonb;
  v_order uuid[] := '{}';
  v_all record;
  v_pos int := 0;
begin
  for v_src in
    select * from public.cues where id = any(p_ids) and rundown_id = v_link.rundown_id order by position
  loop
    insert into public.cues (
      rundown_id, position, cue_number, cue_type, group_id, title, subtitle,
      start_type, start_time_override, duration_ms, duration_mode, scripts,
      not_final, background_color, locked
    ) values (
      v_link.rundown_id, 1000000, '', v_src.cue_type, v_src.group_id, v_src.title, v_src.subtitle,
      v_src.start_type, v_src.start_time_override, v_src.duration_ms, v_src.duration_mode, v_src.scripts,
      v_src.not_final, v_src.background_color, v_src.locked
    ) returning id into v_new_id;

    insert into public.cells (cue_id, column_id, content, attachments)
    select v_new_id, column_id, content, attachments from public.cells where cue_id = v_src.id;

    v_map := v_map || jsonb_build_object(v_src.id::text, v_new_id::text);
  end loop;

  -- Walk the original (non-duplicate) cues in position order, emitting each
  -- duplicate right after its source.
  for v_all in
    select id from public.cues where rundown_id = v_link.rundown_id and position < 1000000 order by position
  loop
    v_order := array_append(v_order, v_all.id);
    if v_map ? v_all.id::text then
      v_order := array_append(v_order, (v_map ->> v_all.id::text)::uuid);
    end if;
  end loop;

  foreach v_new_id in array v_order loop
    update public.cues set position = v_pos where id = v_new_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Columns
-- ------------------------------------------------------------
create or replace function public.collab_add_column(
  p_token          text,
  p_name           text,
  p_col_type       text default 'richtext',
  p_options        jsonb default null,
  p_option_colors  jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_next_pos int;
  v_col public.columns;
begin
  select coalesce(max(position), -1) + 1 into v_next_pos
    from public.columns where rundown_id = v_link.rundown_id and deleted_at is null;

  insert into public.columns (rundown_id, name, col_type, position, options, option_colors)
  values (
    v_link.rundown_id, p_name, p_col_type, v_next_pos,
    case when p_col_type = 'dropdown' then coalesce(p_options, '[]'::jsonb) else null end,
    case when p_col_type = 'dropdown' then p_option_colors else null end
  )
  returning * into v_col;

  return to_jsonb(v_col);
end;
$$;

create or replace function public.collab_rename_column(p_token text, p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.columns set name = p_name where id = p_id and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_delete_column(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.columns set deleted_at = now() where id = p_id and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_update_column_options(
  p_token text, p_id uuid, p_options jsonb, p_option_colors jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.columns
     set options = p_options, option_colors = p_option_colors
   where id = p_id and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_update_column_width(p_token text, p_id uuid, p_width int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.columns set width = p_width where id = p_id and rundown_id = v_link.rundown_id;
end;
$$;

create or replace function public.collab_reorder_columns(p_token text, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_id uuid;
  v_pos int := 0;
begin
  foreach v_id in array p_ordered_ids loop
    update public.columns set position = v_pos where id = v_id and rundown_id = v_link.rundown_id;
    v_pos := v_pos + 1;
  end loop;
end;
$$;

grant execute on function public.collab_get_rundown_cues(text) to anon, authenticated;
grant execute on function public.collab_add_cue(text, int, uuid, text) to anon, authenticated;
grant execute on function public.collab_update_cue(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.collab_delete_cue(text, uuid) to anon, authenticated;
grant execute on function public.collab_restore_cue(text, uuid) to anon, authenticated;
grant execute on function public.collab_delete_cues(text, uuid[]) to anon, authenticated;
grant execute on function public.collab_reorder_cues(text, uuid[]) to anon, authenticated;
grant execute on function public.collab_set_cues_background(text, uuid[], text) to anon, authenticated;
grant execute on function public.collab_duplicate_cues(text, uuid[]) to anon, authenticated;
grant execute on function public.collab_add_column(text, text, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.collab_rename_column(text, uuid, text) to anon, authenticated;
grant execute on function public.collab_delete_column(text, uuid) to anon, authenticated;
grant execute on function public.collab_update_column_options(text, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.collab_update_column_width(text, uuid, int) to anon, authenticated;
grant execute on function public.collab_reorder_columns(text, uuid[]) to anon, authenticated;
