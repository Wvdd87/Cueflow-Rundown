-- ============================================================
-- PHASE 23 — Collaboration links, round 3:
--   - group / ungroup cues
--   - per-link private notes (reuses share_private_notes — a token is a
--     token regardless of which link table it came from)
--   - file/image uploads to the cell-attachments bucket
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- ------------------------------------------------------------
-- Group cues: wrap the given cues in a new "New group" heading, mirroring
-- src/app/actions/cues.ts groupCues (position math kept identical: the
-- heading lands at the position of the first selected cue, and every
-- selected cue is pulled together immediately after it).
-- ------------------------------------------------------------
create or replace function public.collab_group_cues(p_token text, p_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
  v_heading_id uuid;
  v_all_ids uuid[];
  v_order uuid[] := '{}';
  v_cnt int;
  v_first_idx int;
  i int;
  j int;
  v_cur uuid;
  v_pos int := 0;
begin
  insert into public.cues (rundown_id, position, cue_type, title, cue_number, duration_ms)
  values (v_link.rundown_id, 1000000, 'heading', 'New group', '', 0)
  returning id into v_heading_id;

  update public.cues set group_id = v_heading_id
   where id = any(p_ids) and rundown_id = v_link.rundown_id;

  select array_agg(id order by position) into v_all_ids
    from public.cues where rundown_id = v_link.rundown_id and position < 1000000;
  v_cnt := coalesce(array_length(v_all_ids, 1), 0);

  v_first_idx := null;
  for i in 1..v_cnt loop
    if v_all_ids[i] = any(p_ids) then
      v_first_idx := i;
      exit;
    end if;
  end loop;

  for i in 1..v_cnt loop
    v_cur := v_all_ids[i];
    if i = v_first_idx then
      v_order := array_append(v_order, v_heading_id);
      for j in 1..v_cnt loop
        if v_all_ids[j] = any(p_ids) then
          v_order := array_append(v_order, v_all_ids[j]);
        end if;
      end loop;
    end if;
    if not (v_cur = any(p_ids)) then
      v_order := array_append(v_order, v_cur);
    end if;
  end loop;

  foreach v_cur in array v_order loop
    update public.cues set position = v_pos where id = v_cur;
    v_pos := v_pos + 1;
  end loop;

  return v_heading_id;
end;
$$;

-- ------------------------------------------------------------
-- Ungroup: members lose their group_id; selected headings are deleted
-- outright (the FK's ON DELETE SET NULL ungroups their children too),
-- mirroring src/app/actions/cues.ts ungroupCues.
-- ------------------------------------------------------------
create or replace function public.collab_ungroup_cues(p_token text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.collaboration_links := public.collab_link_or_raise(p_token);
begin
  update public.cues set group_id = null
   where id = any(p_ids) and rundown_id = v_link.rundown_id and cue_type != 'heading';

  delete from public.cues
   where id = any(p_ids) and rundown_id = v_link.rundown_id and cue_type = 'heading';
end;
$$;

grant execute on function public.collab_group_cues(text, uuid[]) to anon, authenticated;
grant execute on function public.collab_ungroup_cues(text, uuid[]) to anon, authenticated;

-- ------------------------------------------------------------
-- Private notes, scoped to this one collaboration link only — not visible
-- to the owner or to any other collaboration link. share_private_notes.
-- share_token is a plain text column (not FK'd), so a collaboration link's
-- id works as a token here exactly the same way a read-only share token does.
-- ------------------------------------------------------------
create or replace function public.get_collab_private_notes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.collaboration_links where id = p_token and active) then
    return '[]'::jsonb;
  end if;
  return coalesce(
    (select jsonb_agg(jsonb_build_object('cue_id', cue_id, 'content', content))
     from public.share_private_notes
     where share_token = p_token),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.upsert_collab_private_note(p_token text, p_cue_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.collaboration_links where id = p_token and active) then
    raise exception 'Invalid or revoked collaboration link';
  end if;
  insert into public.share_private_notes (share_token, cue_id, content, updated_at)
  values (p_token, p_cue_id, p_content, now())
  on conflict (share_token, cue_id)
  do update set content = excluded.content, updated_at = now();
end;
$$;

grant execute on function public.get_collab_private_notes(text) to anon, authenticated;
grant execute on function public.upsert_collab_private_note(text, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- File/image uploads — the bucket only allowed `authenticated` writers
-- (schema_phase4.sql). Widen it to `anon`, but only into a rundown folder
-- that currently has an active collaboration link — matches the app-level
-- checks used everywhere else in this file. Reads stay public (unchanged).
-- ------------------------------------------------------------
create policy "collab links can upload cell attachments"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'cell-attachments'
    and exists (
      select 1 from public.collaboration_links cl
      where cl.active
        and cl.rundown_id::text = (storage.foldername(name))[1]
    )
  );
