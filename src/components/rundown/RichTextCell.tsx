'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { HeadingSize } from './HeadingSize'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ChevronDown,
  Highlighter,
  RemoveFormatting,
} from 'lucide-react'
import { resolveMentionsHtml } from '@/lib/cellHtml'
import { useRundownData } from './RundownDataContext'
import { buildMentionExtension } from './cellExtensions'
import { FileAttachment } from './fileAttachment'
import { ImageLightbox } from './ImageLightbox'
import { uploadCellFile, isImageFile } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Mention, Variable } from '@/lib/supabase/types'
import type { Suggestion } from './useFieldSuggestions'
import { CellSuggestions } from './CellSuggestions'

// 6 × 4 = 24 preset colors
const SWATCH_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7',
  '#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#d8b4fe',
  '#991b1b', '#9a3412', '#713f12', '#14532d', '#1e3a8a', '#581c87',
  '#ffffff', '#d1d5db', '#9ca3af', '#4b5563', '#1f2937', '#000000',
]

interface RichTextCellProps {
  cueId: string
  columnId: string
  rundownId: string
  initialContent: string
  onContentChange: (cueId: string, columnId: string, content: string) => void
  /** Field-value autocomplete provider for this column (#71.1). */
  getSuggestions?: (query: string) => Suggestion[]
}

export function RichTextCell({
  cueId,
  columnId,
  rundownId,
  initialContent,
  onContentChange,
  getSuggestions,
}: RichTextCellProps) {
  const { mentions, variables, trackSave, actions, collab } = useRundownData()
  const locked = !!collab && !collab.editableColumns.includes(columnId)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(initialContent)

  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  const variableMap = useMemo(
    () => Object.fromEntries(variables.map((v) => [v.key, v.value])),
    [variables]
  )
  const mentionMap = useMemo(
    () => Object.fromEntries(mentions.map((m) => [m.id, m])),
    [mentions]
  )

  const handleSave = useCallback(
    async (html: string) => {
      setEditing(false)
      if (html === content) return
      setContent(html)
      onContentChange(cueId, columnId, html)
      await trackSave(actions.upsertCell(cueId, columnId, html))
    },
    [content, cueId, columnId, onContentChange, trackSave, actions]
  )

  if (editing && !locked) {
    return (
      <CellTipTap
        initialContent={content}
        rundownId={rundownId}
        mentions={mentions}
        variables={variables}
        onSave={handleSave}
        getSuggestions={getSuggestions}
      />
    )
  }

  const isEmpty = !content || content === '<p></p>'
  const startEditing = locked ? undefined : () => setEditing(true)

  if (isEmpty) {
    return (
      <div
        data-testid="richtext-cell"
        data-cell-trigger={locked ? undefined : true}
        onClick={startEditing}
        className={cn(
          'tiptap-cell w-full min-h-[28px] px-2 py-1 text-sm text-[#c8c9d0] break-words',
          locked ? 'opacity-70' : 'cursor-text hover:bg-[#1d1d24]/40'
        )}
      >
        <span className="text-[#5a5c66] italic">—</span>
      </div>
    )
  }

  return (
    <CellDisplay
      html={content}
      variableMap={variableMap}
      mentionMap={mentionMap}
      onClick={startEditing}
      locked={locked}
    />
  )
}

/** Resolve $-variable spans to their current value directly in the HTML string. */
function resolveVariables(html: string, variableMap: Record<string, string>): string {
  return html.replace(
    /<span([^>]*?)data-mention-suggestion-char="\$"([^>]*?)>([\s\S]*?)<\/span>/g,
    (_full, pre: string, post: string, _inner: string) => {
      const attrs = pre + post
      const idMatch = attrs.match(/data-id="([^"]*)"/)
      const key = idMatch ? idMatch[1] : ''
      const val = variableMap[key]
      const unset = val == null || val === ''
      const text = unset ? `$${key}` : val
      const safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const unsetAttr = unset ? ' data-unset="1"' : ''
      return `<span${pre}data-mention-suggestion-char="$"${post}${unsetAttr}>${safe}</span>`
    }
  )
}

function CellDisplay({
  html,
  variableMap,
  mentionMap,
  onClick,
  locked,
}: {
  html: string
  variableMap: Record<string, string>
  mentionMap: Record<string, Mention>
  onClick?: () => void
  locked?: boolean
}) {
  const [hover, setHover] = useState<{ mention: Mention; x: number; y: number } | null>(
    null
  )
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const resolvedHtml = useMemo(() => {
    const nameById = Object.fromEntries(
      Object.entries(mentionMap).map(([id, m]) => [id, m.name])
    )
    return resolveMentionsHtml(resolveVariables(html, variableMap), nameById)
  }, [html, variableMap, mentionMap])

  // Show the hovercard when the pointer is over a mention; clear it whenever
  // it's over anything else. Container onMouseLeave + scroll are the reliable
  // dismissals (a single mouseout can land on a non-mention and get stuck).
  function handleMouseMove(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest?.('[data-mention-suggestion-char="@"]')
    if (!el) return setHover((p) => (p ? null : p))
    const mention = mentionMap[el.getAttribute('data-id') || '']
    if (!mention) return setHover((p) => (p ? null : p))
    const r = el.getBoundingClientRect()
    setHover((p) => (p && p.mention.id === mention.id ? p : { mention, x: r.left, y: r.bottom }))
  }

  useEffect(() => {
    if (!hover) return
    const clear = () => setHover(null)
    window.addEventListener('scroll', clear, true)
    return () => window.removeEventListener('scroll', clear, true)
  }, [hover])

  // Clicking an inline image opens it fullscreen instead of starting cell editing —
  // works identically whether the show is live or not, since this is display-only.
  function handleClick(e: React.MouseEvent) {
    const img = (e.target as HTMLElement).closest?.('img')
    if (img instanceof HTMLImageElement) {
      e.preventDefault()
      e.stopPropagation()
      setLightboxSrc(img.src)
      return
    }
    onClick?.()
  }

  return (
    <>
      <div
        data-testid="richtext-cell"
        data-lightbox="1"
        data-cell-trigger={locked ? undefined : true}
        onClick={handleClick}
        onMouseOver={handleMouseMove}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        className={cn(
          'tiptap-cell w-full min-h-[28px] px-2 py-1 text-sm text-[#c8c9d0] break-words',
          locked ? 'opacity-70' : 'cursor-text hover:bg-[#1d1d24]/40'
        )}
        dangerouslySetInnerHTML={{ __html: resolvedHtml }}
      />
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {hover &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', left: hover.x, top: hover.y + 6, zIndex: 70 }}
            className="max-w-xs border border-[#2e2e38] bg-[#111116] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.8)] pointer-events-none"
          >
            <p className="text-sm font-medium text-[#eef0f3] mb-1">{hover.mention.name}</p>
            {hover.mention.description ? (
              <div
                className="tiptap-cell text-xs text-[#c8c9d0]"
                dangerouslySetInnerHTML={{ __html: hover.mention.description }}
              />
            ) : (
              <p className="text-xs text-[#5a5c66] italic">No description</p>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

/** Mounted only while a cell is being edited. */
function CellTipTap({
  initialContent,
  rundownId,
  mentions,
  variables,
  onSave,
  getSuggestions,
}: {
  initialContent: string
  rundownId: string
  mentions: Mention[]
  variables: Variable[]
  onSave: (html: string) => void
  getSuggestions?: (query: string) => Suggestion[]
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const suggestionsRef = useRef(suggestions)
  suggestionsRef.current = suggestions
  const highlightedRef = useRef(highlighted)
  highlightedRef.current = highlighted
  const getSuggestionsRef = useRef(getSuggestions)
  getSuggestionsRef.current = getSuggestions
  const acceptRef = useRef<() => void>(() => {})
  // While the @/$ mention popup is open, suppress value-autocomplete so the two
  // don't fight over the keyboard.
  const mentionPopupOpen = () => typeof document !== 'undefined' && !!document.querySelector('.tippy-box')

  const mentionsRef = useRef(mentions)
  mentionsRef.current = mentions
  const variablesRef = useRef(variables)
  variablesRef.current = variables
  const rundownIdRef = useRef(rundownId)
  rundownIdRef.current = rundownId

  async function handleFiles(files: File[], insertPos?: number) {
    const editor = editorRef.current
    if (!editor) return
    if (insertPos != null) editor.commands.setTextSelection(insertPos)
    for (const file of files) {
      const toastId = toast.loading(`Uploading ${file.name}…`)
      try {
        const uploaded = await uploadCellFile(rundownIdRef.current, file)
        editor.commands.setTextSelection(editor.state.selection.to)
        if (isImageFile(file)) {
          editor.chain().focus().setImage({ src: uploaded.url, alt: uploaded.name }).run()
        } else {
          editor
            .chain()
            .focus()
            .setFileAttachment({
              src: uploaded.url,
              name: uploaded.name,
              ftype: uploaded.type,
            })
            .run()
        }
        toast.success(`Added ${file.name}`, { id: toastId })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Upload failed',
          { id: toastId }
        )
      }
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      HeadingSize,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Type… (@ mention, $ variable)' }),
      Image.configure({ inline: false, allowBase64: false }),
      FileAttachment,
      buildMentionExtension(
        () => mentionsRef.current.map((m) => ({ id: m.id, label: m.name })),
        () =>
          variablesRef.current.map((v) => ({
            id: v.key,
            label: v.key,
            hint: v.value,
          }))
      ),
    ],
    content: initialContent || '',
    autofocus: 'end',
    onUpdate({ editor }) {
      const fn = getSuggestionsRef.current
      if (!fn || mentionPopupOpen()) { setSuggestions([]); return }
      setSuggestions(fn(editor.getText()))
      setHighlighted(0)
    },
    editorProps: {
      attributes: {
        class:
          'tiptap-cell prose-invert focus:outline-none min-h-[28px] px-2 py-1 text-sm text-[#eef0f3]',
      },
      // Plain Enter is reserved for grid navigation (confirm + move down a row);
      // Shift+Enter still inserts a line break via the default HardBreak binding.
      handleKeyDown(_view, event) {
        // Value-autocomplete keys — only when the @/$ mention popup isn't open.
        const sugg = suggestionsRef.current
        if (sugg.length > 0 && !mentionPopupOpen()) {
          if (event.key === 'ArrowDown') {
            event.preventDefault(); event.stopPropagation()
            setHighlighted((h) => (h + 1) % sugg.length); return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault(); event.stopPropagation()
            setHighlighted((h) => (h - 1 + sugg.length) % sugg.length); return true
          }
          if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation()
            setSuggestions([]); return true
          }
          if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
            event.preventDefault()
            acceptRef.current()
            return true
          }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          return true
        }
        return false
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (files.length === 0) return false
        event.preventDefault()
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        handleFiles(files, coords?.pos)
        return true
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (files.length === 0) return false
        event.preventDefault()
        handleFiles(files)
        return true
      },
    },
  })
  editorRef.current = editor

  acceptRef.current = () => {
    if (!editor) return
    const v = suggestionsRef.current[highlightedRef.current]?.value
    if (v == null) return
    const esc = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    editor.commands.setContent(`<p>${esc}</p>`)
    editor.commands.focus('end')
    setSuggestions([])
  }

  const save = useCallback(() => {
    if (!editor || savedRef.current) return
    savedRef.current = true
    let html = editor.getHTML()
    if (html === '<p></p>') html = ''
    onSave(html)
  }, [editor, onSave])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      // Use the event's composed path rather than the live target: clicking a
      // bubble-toolbar submenu item (e.g. Heading 1) calls setOpenMenu(null),
      // which React 18 flushes synchronously and detaches the clicked button
      // before this listener runs — so target.closest() would wrongly report an
      // "outside" click and save/close the editor. The path is snapshotted at
      // dispatch and still contains the toolbar/wrapper ancestors.
      const path = e.composedPath()
      const inSkipZone = path.some(
        (n) =>
          n instanceof HTMLElement &&
          (n === wrapperRef.current ||
            n.hasAttribute('data-suggestion-popup') ||
            n.hasAttribute('data-bubble-toolbar') ||
            n.classList.contains('tippy-box'))
      )
      if (inSkipZone) return
      save()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [save])

  if (!editor) return null

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onKeyDown={(e) => {
        // Escape closes the suggestion popover first; only otherwise confirms.
        if (e.key === 'Escape' && suggestionsRef.current.length === 0) {
          e.preventDefault()
          save()
        }
      }}
    >
      <BubbleTipTapToolbar editor={editor} />
      {/* No inner border/box or file toolbar (#76): the outer cell's focus ring
          is the only border, matching the title column. Rich-text formatting is
          still available via the selection bubble toolbar. */}
      <EditorContent editor={editor} />
      <CellSuggestions
        suggestions={suggestions}
        highlighted={highlighted}
        onHover={setHighlighted}
        onPick={(value) => {
          const esc = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          editor.commands.setContent(`<p>${esc}</p>`)
          editor.commands.focus('end')
          setSuggestions([])
        }}
      />
    </div>
  )
}


// ─── Bubble toolbar (appears above text selection) ────────────────────────────

type OpenMenu = 'heading' | 'list' | 'textColor' | 'highlight' | null

export function BubbleTipTapToolbar({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)

  useEffect(() => {
    function onSelectionUpdate() {
      const { from, to } = editor.state.selection
      if (from === to) {
        setPos(null)
        setOpenMenu(null)
        return
      }
      // Prefer native selection rect (accurate for multi-line); fall back to
      // ProseMirror coordsAtPos when getBoundingClientRect returns zeros (headless).
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) {
          setPos({ x: rect.left + rect.width / 2, y: rect.top })
          return
        }
      }
      try {
        const s = editor.view.coordsAtPos(from)
        const e = editor.view.coordsAtPos(to)
        setPos({ x: (s.left + e.right) / 2, y: Math.min(s.top, e.top) })
      } catch {
        setPos(null)
      }
    }

    function onBlur() {
      setPos(null)
      setOpenMenu(null)
    }

    editor.on('selectionUpdate', onSelectionUpdate)
    editor.on('blur', onBlur)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
      editor.off('blur', onBlur)
    }
  }, [editor])

  if (!pos || typeof document === 'undefined') return null

  const tbBtn = (active: boolean) =>
    cn(
      'flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors',
      active
        ? 'bg-zinc-600 text-white'
        : 'text-zinc-300 hover:text-white hover:bg-zinc-700'
    )

  const activeTextColor = editor.getAttributes('textStyle').color as string | undefined
  const activeHighlight = editor.getAttributes('highlight').color as string | undefined

  return createPortal(
    <div
      data-bubble-toolbar
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, calc(-100% - 6px))',
        zIndex: 60,
      }}
      className="flex items-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-900 px-1 py-0.5 shadow-xl"
    >
      {/* H — heading / paragraph dropdown */}
      <div className="relative">
        <button
          type="button"
          className={tbBtn(editor.isActive('headingSize'))}
          title="Text size"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpenMenu(openMenu === 'heading' ? null : 'heading')
          }}
        >
          <span className="font-bold">H</span>
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {openMenu === 'heading' && (
          <div className="absolute top-full mt-1 left-0 z-10 bg-zinc-900 border border-zinc-700 rounded shadow-lg min-w-[130px]">
            {([
              { label: 'Normal', active: !editor.isActive('headingSize'), cmd: () => editor.chain().focus().unsetHeadingSize().run() },
              { label: 'Heading 1', active: editor.isActive('headingSize', { level: 1 }), cmd: () => editor.chain().focus().toggleHeadingSize(1).run() },
              { label: 'Heading 2', active: editor.isActive('headingSize', { level: 2 }), cmd: () => editor.chain().focus().toggleHeadingSize(2).run() },
              { label: 'Heading 3', active: editor.isActive('headingSize', { level: 3 }), cmd: () => editor.chain().focus().toggleHeadingSize(3).run() },
            ] as { label: string; active: boolean; cmd: () => void }[]).map(({ label, active, cmd }) => (
              <button
                key={label}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 text-zinc-200',
                  active && 'bg-zinc-700'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  cmd()
                  setOpenMenu(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="w-px h-4 bg-zinc-700 mx-0.5" />

      {/* B */}
      <button
        type="button"
        className={tbBtn(editor.isActive('bold'))}
        title="Bold"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      {/* I */}
      <button
        type="button"
        className={tbBtn(editor.isActive('italic'))}
        title="Italic"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-4 bg-zinc-700 mx-0.5" />

      {/* List dropdown */}
      <div className="relative">
        <button
          type="button"
          className={tbBtn(editor.isActive('bulletList') || editor.isActive('orderedList'))}
          title="List"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpenMenu(openMenu === 'list' ? null : 'list')
          }}
        >
          <List className="w-3.5 h-3.5" />
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {openMenu === 'list' && (
          <div className="absolute top-full mt-1 left-0 z-10 bg-zinc-900 border border-zinc-700 rounded shadow-lg min-w-[140px]">
            <button
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 text-zinc-200 flex items-center gap-2',
                editor.isActive('bulletList') && 'bg-zinc-700'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().toggleBulletList().run()
                setOpenMenu(null)
              }}
            >
              <List className="w-3 h-3" /> Bullet list
            </button>
            <button
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 text-zinc-200 flex items-center gap-2',
                editor.isActive('orderedList') && 'bg-zinc-700'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().toggleOrderedList().run()
                setOpenMenu(null)
              }}
            >
              <ListOrdered className="w-3 h-3" /> Numbered list
            </button>
          </div>
        )}
      </div>

      <span className="w-px h-4 bg-zinc-700 mx-0.5" />

      {/* A — text color */}
      <div className="relative">
        <button
          type="button"
          className={tbBtn(!!activeTextColor)}
          title="Text color"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpenMenu(openMenu === 'textColor' ? null : 'textColor')
          }}
        >
          <span
            className="text-xs font-bold"
            style={{
              borderBottom: `2px solid ${activeTextColor ?? '#9ca3af'}`,
              lineHeight: 1,
            }}
          >
            A
          </span>
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {openMenu === 'textColor' && (
          <SwatchPicker
            onSelect={(color) => {
              if (color === null) editor.chain().focus().unsetColor().run()
              else editor.chain().focus().setColor(color).run()
              setOpenMenu(null)
            }}
          />
        )}
      </div>

      {/* Highlight color */}
      <div className="relative">
        <button
          type="button"
          className={tbBtn(!!activeHighlight)}
          title="Highlight color"
          onMouseDown={(e) => {
            e.preventDefault()
            setOpenMenu(openMenu === 'highlight' ? null : 'highlight')
          }}
        >
          <span
            className="w-3.5 h-3.5 rounded-sm border border-zinc-500 block"
            style={{ backgroundColor: activeHighlight ?? 'transparent' }}
          />
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {openMenu === 'highlight' && (
          <SwatchPicker
            onSelect={(color) => {
              if (color === null) editor.chain().focus().unsetHighlight().run()
              else editor.chain().focus().setHighlight({ color }).run()
              setOpenMenu(null)
            }}
          />
        )}
      </div>

      <span className="w-px h-4 bg-zinc-700 mx-0.5" />

      {/* Clear formatting */}
      <button
        type="button"
        className={tbBtn(false)}
        title="Clear formatting"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }}
      >
        <RemoveFormatting className="w-3.5 h-3.5" />
      </button>
    </div>,
    document.body
  )
}

// ─── Color swatch picker ──────────────────────────────────────────────────────

function SwatchPicker({ onSelect }: { onSelect: (color: string | null) => void }) {
  return (
    <div
      data-bubble-toolbar
      className="absolute top-full mt-1 left-0 z-20 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl p-2"
    >
      {/* None — diagonal line through white box */}
      <button
        type="button"
        className="w-5 h-5 rounded border-2 border-zinc-300 mb-1.5 hover:scale-110 transition-transform"
        style={{
          backgroundImage:
            'linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)',
        }}
        onMouseDown={(e) => { e.preventDefault(); onSelect(null) }}
        title="Remove color"
      />
      {/* 6 × 4 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1.25rem)', gap: '2px' }}>
        {SWATCH_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="w-5 h-5 rounded hover:scale-110 transition-transform border border-zinc-700"
            style={{ backgroundColor: color }}
            onMouseDown={(e) => { e.preventDefault(); onSelect(color) }}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}
