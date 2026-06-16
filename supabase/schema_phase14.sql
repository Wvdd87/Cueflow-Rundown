-- ============================================================
-- PHASE 14 — Share private notes (per-token, cross-browser)
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

create table if not exists public.share_private_notes (
  id          uuid primary key default uuid_generate_v4(),
  share_token text not null,
  cue_id      uuid not null references public.cues(id) on delete cascade,
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  unique(share_token, cue_id)
);

-- Access only through security-definer functions below
alter table public.share_private_notes enable row level security;

create index if not exists spn_token_idx on public.share_private_notes(share_token);

-- ------------------------------------------------------------
-- Read all notes for a token
-- ------------------------------------------------------------
create or replace function public.get_share_private_notes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.rundown_shares where token = p_token) then
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

-- ------------------------------------------------------------
-- Upsert a single note
-- ------------------------------------------------------------
create or replace function public.upsert_share_private_note(
  p_token   text,
  p_cue_id  uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rundown_shares where token = p_token) then
    raise exception 'Invalid share token';
  end if;

  insert into public.share_private_notes (share_token, cue_id, content, updated_at)
  values (p_token, p_cue_id, p_content, now())
  on conflict (share_token, cue_id)
  do update set content = excluded.content, updated_at = now();
end;
$$;

grant execute on function public.get_share_private_notes(text)           to anon, authenticated;
grant execute on function public.upsert_share_private_note(text, uuid, text) to anon, authenticated;
