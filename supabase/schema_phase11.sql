-- ============================================================
-- PHASE 11 — Per-link share config (label + visible columns)
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

alter table public.rundown_shares
  add column if not exists label text;

-- jsonb array of column ids to expose; null = all columns
alter table public.rundown_shares
  add column if not exists visible_columns jsonb;

-- ------------------------------------------------------------
-- Reader now filters columns + cells to the link's visible_columns
-- (so hidden columns never reach the guest), and returns the share config.
-- ------------------------------------------------------------
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
           and (v_visible is null
                or c.id::text in (select jsonb_array_elements_text(v_visible)))), '[]'::jsonb),
    'cues', coalesce(
      (select jsonb_agg(to_jsonb(cu) order by cu.position)
         from public.cues cu where cu.rundown_id = v_rundown_id), '[]'::jsonb),
    'cells', coalesce(
      (select jsonb_agg(to_jsonb(ce))
         from public.cells ce
         where ce.cue_id in (select id from public.cues where rundown_id = v_rundown_id)
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
