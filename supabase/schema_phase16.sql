-- ============================================================
-- PHASE 16 — Fix get_shared_rundown: filter soft-deleted cues & columns
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- Previous versions omitted `deleted_at IS NULL` filters, causing soft-deleted
-- cues and columns to appear on share links.
create or replace function public.get_shared_rundown(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rundown_id uuid;
  v_visible jsonb;
  v_label text;
  result jsonb;
begin
  select rundown_id, visible_columns, label
    into v_rundown_id, v_visible, v_label
    from public.rundown_shares
    where token = p_token;

  if v_rundown_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'rundown', (select to_jsonb(r) from public.rundowns r where r.id = v_rundown_id),
    'share', jsonb_build_object('label', v_label, 'visible_columns', v_visible),
    'columns', coalesce(
      (select jsonb_agg(to_jsonb(c) order by c.position)
         from public.columns c
         where c.rundown_id = v_rundown_id
           and c.deleted_at is null
           and (v_visible is null
                or c.id::text in (select jsonb_array_elements_text(v_visible)))), '[]'::jsonb),
    'cues', coalesce(
      (select jsonb_agg(to_jsonb(cu) order by cu.position)
         from public.cues cu
         where cu.rundown_id = v_rundown_id
           and cu.deleted_at is null), '[]'::jsonb),
    'cells', coalesce(
      (select jsonb_agg(to_jsonb(ce))
         from public.cells ce
         where ce.cue_id in (
           select id from public.cues
           where rundown_id = v_rundown_id
             and deleted_at is null
         )
           and (v_visible is null
                or ce.column_id::text in (select jsonb_array_elements_text(v_visible)))), '[]'::jsonb),
    'variables', coalesce(
      (select jsonb_agg(to_jsonb(v))
         from public.variables v where v.rundown_id = v_rundown_id), '[]'::jsonb),
    'mentions', coalesce(
      (select jsonb_agg(to_jsonb(m))
         from public.mentions m where m.rundown_id = v_rundown_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_shared_rundown(text) to anon, authenticated;
