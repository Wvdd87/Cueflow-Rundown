'use client'

import * as adminCues from '@/app/actions/cues'
import * as adminColumns from '@/app/actions/columns'
import { upsertPrivateNote } from '@/app/actions/privateNotes'
import * as collab from '@/app/actions/collab'
import type { Cue, Cell, Column, CellAttachment } from '@/lib/supabase/types'

type CueUpdates = Partial<Pick<Cue, 'title' | 'subtitle' | 'cue_number' | 'cue_type' | 'duration_ms' | 'duration_mode' | 'scripts' | 'not_final' | 'start_type' | 'start_time_override' | 'auto_start' | 'background_color' | 'locked' | 'group_id'>>

/** Every mutation the rundown editor performs, with rundownId/token already
 *  bound — so CueRow, ColumnHeaders, RundownEditor etc. can call the same
 *  methods regardless of whether the viewer is the authenticated owner or a
 *  collaboration link. The one behavioral difference lives entirely in which
 *  factory built the object: collabRundownActions checks editable_columns
 *  server-side and can't do project-management ops (those aren't exposed
 *  here at all — see RundownEditor's `collab` prop). */
export interface RundownActions {
  addCue: (afterPosition: number, groupId?: string) => Promise<{ cue?: Cue; error?: string }>
  addHeading: (afterPosition: number) => Promise<{ cue?: Cue; error?: string }>
  updateCue: (id: string, updates: CueUpdates) => Promise<{ error?: string }>
  deleteCue: (id: string) => Promise<{ error?: string }>
  restoreCue: (id: string) => Promise<{ error?: string }>
  deleteCues: (ids: string[]) => Promise<{ error?: string }>
  reorderCues: (orderedIds: string[]) => Promise<{ error?: string }>
  setCuesBackground: (ids: string[], color: string | null) => Promise<{ error?: string }>
  duplicateCues: (ids: string[]) => Promise<{ error?: string }>
  getRundownCues: () => Promise<{ cues: Cue[]; cells: Cell[] }>
  upsertCell: (
    cueId: string,
    columnId: string,
    content: string,
    attachments?: CellAttachment[]
  ) => Promise<{ error?: string }>
  addColumn: (
    name: string,
    afterPosition: number,
    colType: 'richtext' | 'dropdown',
    options: string[] | null,
    optionColors: Record<string, string> | null
  ) => Promise<{ column?: Column; error?: string }>
  renameColumn: (id: string, name: string) => Promise<{ error?: string }>
  deleteColumn: (id: string) => Promise<{ error?: string }>
  updateColumnOptions: (
    id: string,
    options: string[],
    optionColors: Record<string, string> | null
  ) => Promise<{ error?: string }>
  updateColumnWidth: (id: string, width: number) => Promise<{ error?: string }>
  reorderColumns: (orderedIds: string[]) => Promise<{ error?: string }>
  groupCues: (ids: string[]) => Promise<{ groupId?: string; error?: string }>
  ungroupCues: (ids: string[]) => Promise<{ error?: string }>
  /** Private notes are per-viewer: the admin's own (auth-scoped) or a single
   *  collaboration link's own (token-scoped) — never shared between the two. */
  upsertPrivateNote: (cueId: string, content: string) => Promise<{ error?: string }>
}

export function createAdminActions(rundownId: string): RundownActions {
  return {
    addCue: (afterPosition, groupId) => adminCues.addCue(rundownId, afterPosition, groupId),
    addHeading: (afterPosition) => adminCues.addHeading(rundownId, afterPosition),
    updateCue: (id, updates) => adminCues.updateCue(id, rundownId, updates),
    deleteCue: (id) => adminCues.deleteCue(id, rundownId),
    restoreCue: (id) => adminCues.restoreCue(id, rundownId),
    deleteCues: (ids) => adminCues.deleteCues(rundownId, ids),
    reorderCues: (orderedIds) => adminCues.reorderCues(rundownId, orderedIds),
    setCuesBackground: (ids, color) => adminCues.setCuesBackground(rundownId, ids, color),
    duplicateCues: (ids) => adminCues.duplicateCues(rundownId, ids),
    getRundownCues: () => adminCues.getRundownCues(rundownId),
    upsertCell: (cueId, columnId, content, attachments) =>
      adminCues.upsertCell(cueId, columnId, content, rundownId, attachments),
    addColumn: (name, afterPosition, colType, options, optionColors) =>
      adminColumns.addColumn(rundownId, name, afterPosition, colType, options, optionColors),
    renameColumn: (id, name) => adminColumns.renameColumn(id, name, rundownId),
    deleteColumn: (id) => adminColumns.deleteColumn(id, rundownId),
    updateColumnOptions: (id, options, optionColors) =>
      adminColumns.updateColumnOptions(id, options, rundownId, optionColors),
    updateColumnWidth: (id, width) => adminColumns.updateColumnWidth(id, width, rundownId),
    reorderColumns: (orderedIds) => adminColumns.reorderColumns(rundownId, orderedIds),
    groupCues: (ids) => adminCues.groupCues(rundownId, ids),
    ungroupCues: (ids) => adminCues.ungroupCues(rundownId, ids),
    upsertPrivateNote: (cueId, content) => upsertPrivateNote(cueId, rundownId, content),
  }
}

export function createCollabActions(token: string): RundownActions {
  return {
    addCue: (afterPosition, groupId) => collab.collabAddCue(token, afterPosition, groupId),
    addHeading: (afterPosition) => collab.collabAddHeading(token, afterPosition),
    updateCue: (id, updates) => collab.collabUpdateCue(token, id, updates),
    deleteCue: (id) => collab.collabDeleteCue(token, id),
    restoreCue: (id) => collab.collabRestoreCue(token, id),
    deleteCues: (ids) => collab.collabDeleteCues(token, ids),
    reorderCues: (orderedIds) => collab.collabReorderCues(token, orderedIds),
    setCuesBackground: (ids, color) => collab.collabSetCuesBackground(token, ids, color),
    duplicateCues: (ids) => collab.collabDuplicateCues(token, ids),
    getRundownCues: () => collab.collabGetRundownCues(token),
    upsertCell: (cueId, columnId, content, attachments) =>
      collab.collabUpsertCell(token, cueId, columnId, content, attachments),
    // afterPosition is ignored — collab_add_column always appends at the end,
    // matching the only way the admin UI actually calls addColumn today.
    addColumn: (name, _afterPosition, colType, options, optionColors) =>
      collab.collabAddColumn(token, name, colType, options, optionColors),
    renameColumn: (id, name) => collab.collabRenameColumn(token, id, name),
    deleteColumn: (id) => collab.collabDeleteColumn(token, id),
    updateColumnOptions: (id, options, optionColors) =>
      collab.collabUpdateColumnOptions(token, id, options, optionColors),
    updateColumnWidth: (id, width) => collab.collabUpdateColumnWidth(token, id, width),
    reorderColumns: (orderedIds) => collab.collabReorderColumns(token, orderedIds),
    groupCues: (ids) => collab.collabGroupCues(token, ids),
    ungroupCues: (ids) => collab.collabUngroupCues(token, ids),
    upsertPrivateNote: (cueId, content) => collab.collabUpsertPrivateNote(token, cueId, content),
  }
}
