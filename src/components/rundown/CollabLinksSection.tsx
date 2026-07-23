'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Copy, Check, Trash2, Plus, Power, ChevronUp, Pencil, Loader2 } from 'lucide-react'
import { FIELD, BTN_PRIMARY, BTN_SECONDARY, ROW_TILE } from './dialogStyles'
import {
  listCollabLinks,
  createCollabLink,
  updateCollabLink,
  setCollabLinkActive,
  deleteCollabLink,
  type CollabLinkPermissions,
} from '@/app/actions/collabLinks'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Column, CollaborationLink } from '@/lib/supabase/types'

interface CollabLinksSectionProps {
  rundownId: string
  columns: Column[]
  open: boolean
}

const emptyPermissions: CollabLinkPermissions = {
  editableColumns: [],
  canAddDeleteCues: false,
  canAddDeleteColumns: false,
  canRunShow: false,
}

function linkPermissions(link: CollaborationLink): CollabLinkPermissions {
  return {
    editableColumns: link.editable_columns,
    canAddDeleteCues: link.can_add_delete_cues,
    canAddDeleteColumns: link.can_add_delete_columns,
    canRunShow: link.can_run_show,
  }
}

function permissionSummary(link: CollaborationLink): string {
  const parts: string[] = []
  parts.push(
    link.editable_columns.length > 0
      ? `Edit ${link.editable_columns.length} column${link.editable_columns.length > 1 ? 's' : ''}`
      : 'View only'
  )
  if (link.can_add_delete_cues) parts.push('Add/delete cues')
  if (link.can_add_delete_columns) parts.push('Manage columns')
  if (link.can_run_show) parts.push('Show control')
  return parts.join(' · ')
}

const TOGGLE = (on: boolean) =>
  cn(
    'flex items-center justify-between w-full gap-2 px-3 py-2 border text-left transition-colors cursor-pointer',
    on
      ? 'border-[#f0a838]/50 bg-[rgba(240,168,56,0.10)] text-[#eef0f3]'
      : 'border-[#2e2e38] bg-[#16161c] text-[#9ba0ab] hover:border-[#3a3a48]'
  )

function PermissionsFields({
  columns,
  permissions,
  onChange,
  testPrefix,
}: {
  columns: Column[]
  permissions: CollabLinkPermissions
  onChange: (next: CollabLinkPermissions) => void
  testPrefix: string
}) {
  function toggleColumn(colId: string) {
    onChange({
      ...permissions,
      editableColumns: permissions.editableColumns.includes(colId)
        ? permissions.editableColumns.filter((id) => id !== colId)
        : [...permissions.editableColumns, colId],
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-1.5">
        <button
          data-testid={`${testPrefix}-toggle-run-show`}
          onClick={() => onChange({ ...permissions, canRunShow: !permissions.canRunShow })}
          className={TOGGLE(permissions.canRunShow)}
        >
          <span className="text-[12.5px]">Can take show control</span>
          <span className="font-cond text-[9px] font-bold uppercase tracking-[0.1em]">
            {permissions.canRunShow ? 'On' : 'Off'}
          </span>
        </button>
        <button
          data-testid={`${testPrefix}-toggle-add-delete-cues`}
          onClick={() => onChange({ ...permissions, canAddDeleteCues: !permissions.canAddDeleteCues })}
          className={TOGGLE(permissions.canAddDeleteCues)}
        >
          <span className="text-[12.5px]">Can add / delete cues</span>
          <span className="font-cond text-[9px] font-bold uppercase tracking-[0.1em]">
            {permissions.canAddDeleteCues ? 'On' : 'Off'}
          </span>
        </button>
        <button
          data-testid={`${testPrefix}-toggle-add-delete-columns`}
          onClick={() => onChange({ ...permissions, canAddDeleteColumns: !permissions.canAddDeleteColumns })}
          className={TOGGLE(permissions.canAddDeleteColumns)}
        >
          <span className="text-[12.5px]">Can add / delete columns</span>
          <span className="font-cond text-[9px] font-bold uppercase tracking-[0.1em]">
            {permissions.canAddDeleteColumns ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      {columns.length > 0 && (
        <div>
          <p className="font-cond text-[9px] font-bold uppercase tracking-[0.12em] text-[#7c7e8a] mb-1.5">
            Editable columns
          </p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((col) => (
              <button
                key={col.id}
                data-testid={`${testPrefix}-col-${col.id}`}
                onClick={() => toggleColumn(col.id)}
                className={cn(
                  'text-xs px-2 py-0.5 border transition-colors',
                  permissions.editableColumns.includes(col.id)
                    ? 'bg-[#1d1d24] border-[#f0a838]/50 text-[#eef0f3]'
                    : 'border-[#2e2e38] text-[#5a5c66]'
                )}
              >
                {col.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export function CollabLinksSection({ rundownId, columns, open }: CollabLinksSectionProps) {
  const [links, setLinks] = useState<CollaborationLink[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [permissions, setPermissions] = useState<CollabLinkPermissions>(emptyPermissions)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPermissions, setEditPermissions] = useState<CollabLinkPermissions>(emptyPermissions)
  const [savingEdit, setSavingEdit] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listCollabLinks(rundownId)
      .then((r) => setLinks(r.links))
      .finally(() => setLoading(false))
  }, [open, rundownId])

  async function handleCreate() {
    if (!label.trim()) return toast.error('Give this link a label')
    setCreating(true)
    try {
      const r = await createCollabLink(rundownId, label, permissions)
      if (r.error) return toast.error(r.error)
      if (r.link) {
        setLinks((prev) => [...prev, r.link!])
        setLabel('')
        setPermissions(emptyPermissions)
        setFormOpen(false)
        toast.success('Collaboration link created')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(link: CollaborationLink) {
    const next = !link.active
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, active: next } : l)))
    const r = await setCollabLinkActive(link.id, next)
    if (r.error) toast.error(r.error)
  }

  async function handleDelete(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id))
    const r = await deleteCollabLink(id)
    if (r.error) toast.error(r.error)
  }

  async function handleCopy(link: CollaborationLink) {
    await navigator.clipboard.writeText(`${origin}/share/collab/${link.id}`)
    setCopiedId(link.id)
    toast.success('Link copied')
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleRename(link: CollaborationLink, next: string) {
    if (next === link.label) return
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, label: next } : l)))
    await updateCollabLink(link.id, { label: next })
  }

  const startEdit = useCallback((link: CollaborationLink) => {
    setEditingId(link.id)
    setEditPermissions(linkPermissions(link))
  }, [])

  async function handleSaveEdit(id: string) {
    setSavingEdit(true)
    try {
      const r = await updateCollabLink(id, editPermissions)
      if (r.error) return toast.error(r.error)
      setLinks((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                editable_columns: editPermissions.editableColumns,
                can_add_delete_cues: editPermissions.canAddDeleteCues,
                can_add_delete_columns: editPermissions.canAddDeleteColumns,
                can_run_show: editPermissions.canRunShow,
              }
            : l
        )
      )
      setEditingId(null)
      toast.success('Permissions updated')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-[#1d1d24] pt-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-[#9ba0ab]" />
        <h3 className="text-sm font-medium text-[#eef0f3]">Collaboration links</h3>
      </div>
      <p className="text-sm text-[#9ba0ab]">
        Give someone editable access to specific columns, without a login. Each link is
        identified by its label and can be revoked at any time.
      </p>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[#7c7e8a]">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading collaboration links…
          </div>
        )}
        {links.length === 0 && !loading && (
          <p className="text-sm text-[#5a5c66] italic">No collaboration links yet.</p>
        )}
        {links.map((link) => (
          <div
            key={link.id}
            data-testid="collab-link-row"
            className={cn(ROW_TILE, 'space-y-2', !link.active && 'opacity-50')}
          >
            <div className="flex items-center gap-2">
              <input
                defaultValue={link.label}
                onBlur={(e) => handleRename(link, e.target.value)}
                className={cn(FIELD, 'h-7 py-1')}
              />
              <button
                data-testid="copy-collab-link"
                onClick={() => handleCopy(link)}
                className="shrink-0 flex items-center justify-center h-7 w-7 bg-[#f0a838] text-[#06060a] hover:bg-[#ffba50] transition-colors"
                title="Copy link"
              >
                {copiedId === link.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                data-testid="edit-collab-permissions"
                onClick={() => (editingId === link.id ? setEditingId(null) : startEdit(link))}
                title="Edit permissions"
                className={cn(
                  'shrink-0 flex items-center justify-center h-7 w-7 border transition-colors',
                  editingId === link.id
                    ? 'border-[#f0a838]/50 text-[#f0a838] bg-[rgba(240,168,56,0.1)]'
                    : 'border-[#2e2e38] text-[#9ba0ab] hover:text-[#eef0f3] hover:border-[#3a3a48]'
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                data-testid="toggle-collab-active"
                onClick={() => handleToggleActive(link)}
                title={link.active ? 'Revoke link' : 'Reactivate link'}
                className={cn(
                  'shrink-0 flex items-center justify-center h-7 w-7 border transition-colors',
                  link.active
                    ? 'border-[#2e2e38] text-[#9ba0ab] hover:text-[#f0a838] hover:border-[#f0a838]/50'
                    : 'border-[#18d986]/40 text-[#18d986] hover:bg-[rgba(24,217,134,0.1)]'
                )}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(link.id)}
                title="Delete link"
                className="shrink-0 text-[#5a5c66] hover:text-[#ff5a73] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p data-testid="collab-link-url" className="font-mono text-[10.5px] text-[#7c7e8a] truncate">
              {origin}/share/collab/{link.id}
            </p>
            <p className="font-cond text-[10px] font-bold uppercase tracking-[0.1em] text-[#888b96]">
              {link.active ? permissionSummary(link) : 'Revoked'}
            </p>

            {editingId === link.id && (
              <div className="space-y-3 border-t border-[#2e2e38] pt-3 mt-1">
                <PermissionsFields
                  columns={columns}
                  permissions={editPermissions}
                  onChange={setEditPermissions}
                  testPrefix="edit-collab"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className={cn(BTN_SECONDARY, 'px-3 py-1.5')}>
                    Cancel
                  </button>
                  <button
                    data-testid="save-collab-permissions"
                    onClick={() => handleSaveEdit(link.id)}
                    disabled={savingEdit}
                    className={cn(BTN_PRIMARY, 'px-3 py-1.5', savingEdit && 'opacity-70 pointer-events-none')}
                  >
                    {savingEdit ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!formOpen ? (
        <button
          data-testid="new-collab-link-btn"
          onClick={() => setFormOpen(true)}
          className={cn(BTN_SECONDARY, 'w-full justify-center')}
        >
          <Plus className="w-4 h-4" /> New collaboration link
        </button>
      ) : (
        <div className="space-y-3 border border-[#2e2e38] bg-[#16161c] p-3">
          <div className="flex items-center justify-between">
            <p className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c7e8a]">
              New collaboration link
            </p>
            <button onClick={() => setFormOpen(false)} className="text-[#7c7e8a] hover:text-[#c8c9d0]">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          <input
            data-testid="collab-link-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Stage Manager)"
            className={FIELD}
          />

          <PermissionsFields columns={columns} permissions={permissions} onChange={setPermissions} testPrefix="collab" />

          <button
            data-testid="create-collab-link"
            onClick={handleCreate}
            disabled={creating}
            className={cn(BTN_PRIMARY, 'w-full justify-center', creating && 'opacity-70 pointer-events-none')}
          >
            {creating ? 'Creating…' : 'Create link'}
          </button>
        </div>
      )}
    </div>
  )
}
