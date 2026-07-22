-- ============================================================
-- PHASE 24 — Fix collaborator file uploads.
-- The schema_phase23.sql storage policy's EXISTS subquery read
-- `public.collaboration_links` directly. That table's RLS only grants
-- SELECT to team members, so under the `anon` role the subquery always saw
-- zero rows and every collaborator upload was rejected with 403 regardless
-- of link validity. Fix: check link validity through a security-definer
-- function (bypasses RLS), same pattern as every other collab_* function.
-- Run in the Supabase SQL editor for project uzdclslxchlzwzklfikx
-- ============================================================

drop policy if exists "collab links can upload cell attachments" on storage.objects;

create or replace function public.rundown_has_active_collab_link(p_rundown_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.collaboration_links cl
    where cl.active and cl.rundown_id = p_rundown_id
  );
$$;

grant execute on function public.rundown_has_active_collab_link(uuid) to anon, authenticated;

create policy "collab links can upload cell attachments"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'cell-attachments'
    and public.rundown_has_active_collab_link(((storage.foldername(name))[1])::uuid)
  );
