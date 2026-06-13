-- ============================================================
-- PHASE 10 — Sharing (read-only public links)
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

-- A shareable token per rundown. mode kept for future "edit" links.
create table if not exists public.rundown_shares (
  id          uuid primary key default uuid_generate_v4(),
  rundown_id  uuid not null references public.rundowns(id) on delete cascade,
  token       text not null unique,
  mode        text not null default 'view' check (mode in ('view', 'edit')),
  created_at  timestamptz not null default now()
);

alter table public.rundown_shares enable row level security;

create policy "team members manage shares"
  on public.rundown_shares for all
  using (
    rundown_id in (
      select r.id from public.rundowns r
      join public.profiles p on p.team_id = r.team_id
      where p.id = auth.uid()
    )
  );

create index if not exists rundown_shares_rundown on public.rundown_shares(rundown_id);

-- ------------------------------------------------------------
-- Public reader: returns the whole rundown payload for a valid token,
-- bypassing RLS (security definer). Returns null for an unknown token.
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
  result jsonb;
begin
  select rundown_id into v_rundown_id
    from public.rundown_shares
    where token = p_token;

  if v_rundown_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'rundown', (select to_jsonb(r) from public.rundowns r where r.id = v_rundown_id),
    'columns', coalesce(
      (select jsonb_agg(to_jsonb(c) order by c.position)
         from public.columns c where c.rundown_id = v_rundown_id), '[]'::jsonb),
    'cues', coalesce(
      (select jsonb_agg(to_jsonb(cu) order by cu.position)
         from public.cues cu where cu.rundown_id = v_rundown_id), '[]'::jsonb),
    'cells', coalesce(
      (select jsonb_agg(to_jsonb(ce))
         from public.cells ce
         where ce.cue_id in (select id from public.cues where rundown_id = v_rundown_id)), '[]'::jsonb),
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
