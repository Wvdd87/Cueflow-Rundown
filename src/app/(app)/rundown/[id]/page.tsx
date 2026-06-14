import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RundownEditor } from '@/components/rundown/RundownEditor'
import type {
  Rundown,
  Cue,
  Column,
  Cell,
  Mention,
  Variable,
} from '@/lib/supabase/types'

export default async function RundownPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rundownData, error: rundownError } = await supabase
    .from('rundowns')
    .select('*')
    .eq('id', id)
    .single()

  if (rundownError || !rundownData) notFound()
  const rundown = rundownData as Rundown

  const [
    { data: cuesData },
    { data: columnsData },
    { data: mentionsData },
    { data: variablesData },
  ] = await Promise.all([
    supabase
      .from('cues')
      .select('*')
      .eq('rundown_id', id)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
    supabase
      .from('columns')
      .select('*')
      .eq('rundown_id', id)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
    // mentions/variables tables may not exist until schema_phase4.sql is run;
    // a missing-table error simply yields null data here (handled gracefully)
    supabase
      .from('mentions')
      .select('*')
      .eq('rundown_id', id)
      .order('name', { ascending: true }),
    supabase
      .from('variables')
      .select('*')
      .eq('rundown_id', id)
      .order('key', { ascending: true }),
  ])

  const cues = (cuesData ?? []) as Cue[]
  const columns = (columnsData ?? []) as Column[]
  const mentions = (mentionsData ?? []) as Mention[]
  const variables = (variablesData ?? []) as Variable[]

  let cells: Cell[] = []
  let privateNotes: Record<string, string> = {}
  if (cues.length > 0) {
    const cueIds = cues.map((c) => c.id)
    const [{ data: cellsData }, { data: pnData }] = await Promise.all([
      supabase.from('cells').select('*').in('cue_id', cueIds),
      // RLS returns only the current user's notes; table may not exist pre-migration
      supabase.from('private_notes').select('cue_id, content').in('cue_id', cueIds),
    ])
    cells = (cellsData ?? []) as Cell[]
    privateNotes = Object.fromEntries(
      ((pnData ?? []) as { cue_id: string; content: string | null }[]).map((r) => [
        r.cue_id,
        r.content ?? '',
      ])
    )
  }

  return (
    <RundownEditor
      rundown={rundown}
      initialCues={cues}
      initialColumns={columns}
      initialCells={cells}
      initialMentions={mentions}
      initialVariables={variables}
      initialPrivateNotes={privateNotes}
    />
  )
}
