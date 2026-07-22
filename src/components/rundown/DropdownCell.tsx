'use client'

import { useRef, useState } from 'react'
import { Plus, ChevronDown, X, Paperclip } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { upsertCell } from '@/app/actions/cues'
import { uploadCellFile } from '@/lib/upload'
import { ImageLightbox } from './ImageLightbox'
import { useRundownData } from './RundownDataContext'
import { parseDropdownCellValues as parseValues, serializeDropdownCellValues as serializeValues } from '@/lib/dropdownValues'
import { toast } from 'sonner'
import type { CellAttachment } from '@/lib/supabase/types'

interface DropdownCellProps {
  cueId: string
  columnId: string
  rundownId: string
  options: string[]
  optionColors: Record<string, string> | null
  value: string
  attachments: CellAttachment[]
  onContentChange: (cueId: string, columnId: string, content: string) => void
  onAttachmentsChange: (cueId: string, columnId: string, attachments: CellAttachment[]) => void
}

const OPTION_ITEM =
  'grid grid-cols-[auto_1fr] gap-2.5 items-center px-3 py-2.5 text-[12.5px] text-[#c8c9d0] focus:bg-[#16161c] focus:text-[#eef0f3] cursor-pointer'

export function DropdownCell({
  cueId,
  columnId,
  rundownId,
  options,
  optionColors,
  value,
  attachments,
  onContentChange,
  onAttachmentsChange,
}: DropdownCellProps) {
  const { trackSave } = useRundownData()
  const values = parseValues(value)
  const remaining = options.filter((o) => !values.includes(o))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  async function addValue(v: string) {
    const next = serializeValues([...values, v])
    onContentChange(cueId, columnId, next)
    await trackSave(upsertCell(cueId, columnId, next, rundownId))
  }

  async function removeValue(v: string) {
    const next = serializeValues(values.filter((x) => x !== v))
    onContentChange(cueId, columnId, next)
    await trackSave(upsertCell(cueId, columnId, next, rundownId))
  }

  /** Swap one selected value for another, in place — the fix for "can't change a
   *  selection once it's picked": clicking a badge reopens the picker and replaces it. */
  async function replaceValue(oldV: string, newV: string) {
    const next = serializeValues(values.map((x) => (x === oldV ? newV : x)))
    onContentChange(cueId, columnId, next)
    await trackSave(upsertCell(cueId, columnId, next, rundownId))
  }

  async function addAttachments(files: File[]) {
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map((f) => uploadCellFile(rundownId, f)))
      const next = [...attachments, ...uploaded]
      onAttachmentsChange(cueId, columnId, next)
      await trackSave(upsertCell(cueId, columnId, value, rundownId, next))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function removeAttachment(url: string) {
    const next = attachments.filter((a) => a.url !== url)
    onAttachmentsChange(cueId, columnId, next)
    await trackSave(upsertCell(cueId, columnId, value, rundownId, next))
  }

  function optionList(list: string[], onSelect: (v: string) => void) {
    return (
      <DropdownMenuContent
        align="start"
        className="bg-[#111116] border-[#3a3a48] text-[#c8c9d0] min-w-[170px] max-h-60 overflow-y-auto p-0"
      >
        {list.length === 0 ? (
          <div className="px-3 py-2.5 text-[12px] text-[#5a5c66] italic">No options — edit the column</div>
        ) : (
          list.map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onSelect(opt)} className={OPTION_ITEM}>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#3a3a48]"
                style={{ backgroundColor: optionColors?.[opt] ?? 'transparent' }}
              />
              <span className="truncate">{opt}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    )
  }

  return (
    <div data-testid="dropdown-cell" className="group/ddc w-full flex flex-col gap-1.5 py-0.5">
      {values.length === 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                data-testid="dropdown-trigger"
                data-cell-trigger
                className="w-full flex items-center justify-between gap-1 px-1.5 py-1 hover:bg-[#1d1d24]/50 transition-colors"
              />
            }
          >
            <span className="text-[13px] text-[#5a5c66] italic">—</span>
            <ChevronDown className="w-3 h-3 text-[#5a5c66] shrink-0" />
          </DropdownMenuTrigger>
          {optionList(options, addValue)}
        </DropdownMenu>
      ) : (
        <>
          {values.map((v, i) => (
            <div key={v} className="flex items-center gap-1 w-full group/badge">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      data-testid="dropdown-badge"
                      data-cell-trigger={i === 0 ? true : undefined}
                      title="Click to change selection"
                      className="flex-1 min-w-0 text-left text-[12.5px] px-2.5 py-[5px] text-white font-semibold break-words [overflow-wrap:anywhere] hover:brightness-110 transition-[filter] cursor-pointer"
                      style={{ backgroundColor: optionColors?.[v] ?? 'rgba(63,63,70,0.85)' }}
                    />
                  }
                >
                  {v}
                </DropdownMenuTrigger>
                {optionList(remaining, (newV) => replaceValue(v, newV))}
              </DropdownMenu>
              <button
                onClick={() => removeValue(v)}
                title={`Remove ${v}`}
                className="opacity-0 group-hover/badge:opacity-100 shrink-0 text-[#5a5c66] hover:text-[#c8c9d0] transition-opacity"
              >
                <X className="w-[11px] h-[11px]" />
              </button>
            </div>
          ))}

          {remaining.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    data-testid="dropdown-add"
                    title="Add selection"
                    className="self-start inline-flex items-center gap-1.5 mt-px font-cond text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#7c7e8a] hover:text-[#c8c9d0] transition-colors"
                  />
                }
              >
                <Plus className="w-2.5 h-2.5" /> Add
              </DropdownMenuTrigger>
              {optionList(remaining, addValue)}
            </DropdownMenu>
          )}
        </>
      )}

      {/* File/image attachments — independent of the selected dropdown value(s) */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {attachments.map((a) => (
            <div key={a.url} className="relative group/att shrink-0">
              {a.type.startsWith('image/') ? (
                <button
                  type="button"
                  onClick={() => setLightboxSrc(a.url)}
                  title={a.name}
                  className="block w-7 h-7 overflow-hidden border border-[#3a3a48] hover:border-[#5a5c66] transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                </button>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={a.name}
                  className="flex items-center gap-1 px-1.5 py-1 border border-[#3a3a48] hover:border-[#5a5c66] text-[#9ba0ab] hover:text-[#c8c9d0] transition-colors"
                >
                  <Paperclip className="w-3 h-3 shrink-0" />
                  <span className="max-w-[70px] truncate text-[10px]">{a.name}</span>
                </a>
              )}
              <button
                onClick={() => removeAttachment(a.url)}
                title={`Remove ${a.name}`}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 flex items-center justify-center bg-[#111116] border border-[#3a3a48] text-[#7c7e8a] hover:text-[#ff5a73] opacity-0 group-hover/att:opacity-100 transition-opacity"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        title="Attach an image or file"
        className="self-start inline-flex items-center gap-1.5 mt-px font-cond text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#5a5c66] opacity-0 group-hover/ddc:opacity-100 hover:text-[#c8c9d0] transition-opacity disabled:opacity-60"
      >
        <Paperclip className="w-2.5 h-2.5" /> {uploading ? 'Uploading…' : 'Attach'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) addAttachments(files)
          e.target.value = ''
        }}
      />

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}
