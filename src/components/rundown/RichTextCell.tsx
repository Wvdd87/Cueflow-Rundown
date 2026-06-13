'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  Highlighter,
  Image as ImageIcon,
  Paperclip,
} from 'lucide-react'
import { upsertCell } from '@/app/actions/cues'
import { useRundownData } from './RundownDataContext'
import { buildMentionExtension } from './cellExtensions'
import { FileAttachment } from './fileAttachment'
import { uploadCellFile, isImageFile } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Mention, Variable } from '@/lib/supabase/types'

const TEXT_COLORS = [
  { label: 'Default', value: null },
  { label: 'Red', value: '#f87171' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'Green', value: '#34d399' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Pink', value: '#f472b6' },
]

interface RichTextCellProps {
  cueId: string
  columnId: string
  rundownId: string
  initialContent: string
  onContentChange: (cueId: string, columnId: string, content: string) => void
}

export function RichTextCell({
  cueId,
  columnId,
  rundownId,
  initialContent,
  onContentChange,
}: RichTextCellProps) {
  const { mentions, variables } = useRundownData()
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
      await upsertCell(cueId, columnId, html, rundownId)
    },
    [content, cueId, columnId, rundownId, onContentChange]
  )

  if (editing) {
    return (
      <CellTipTap
        initialContent={content}
        rundownId={rundownId}
        mentions={mentions}
        variables={variables}
        onSave={handleSave}
      />
    )
  }

  const isEmpty = !content || content === '<p></p>'

  if (isEmpty) {
    return (
      <div
        data-testid="richtext-cell"
        onClick={() => setEditing(true)}
        className="tiptap-cell w-full min-h-[28px] px-2 py-1 text-sm text-zinc-300 cursor-text hover:bg-zinc-800/50 rounded break-words"
      >
        <span className="text-zinc-700 italic">—</span>
      </div>
    )
  }

  return (
    <CellDisplay
      html={content}
      variableMap={variableMap}
      mentionMap={mentionMap}
      onClick={() => setEditing(true)}
    />
  )
}

/** Resolve $-variable spans to their current value directly in the HTML string
 *  (SSR-safe, deterministic) so re-renders never revert the displayed value. */
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

/** Read-only render: variables resolved in-HTML, @-mentions get hover popovers
 *  via event delegation on the stable container. */
function CellDisplay({
  html,
  variableMap,
  mentionMap,
  onClick,
}: {
  html: string
  variableMap: Record<string, string>
  mentionMap: Record<string, Mention>
  onClick: () => void
}) {
  const [hover, setHover] = useState<{ mention: Mention; x: number; y: number } | null>(
    null
  )

  const resolvedHtml = useMemo(
    () => resolveVariables(html, variableMap),
    [html, variableMap]
  )

  function handleMouseOver(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest?.(
      '[data-mention-suggestion-char="@"]'
    )
    if (!el) return
    const mention = mentionMap[el.getAttribute('data-id') || '']
    if (!mention) return
    const r = el.getBoundingClientRect()
    setHover({ mention, x: r.left, y: r.bottom })
  }

  function handleMouseOut(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest?.('[data-mention-suggestion-char="@"]')) {
      setHover(null)
    }
  }

  return (
    <>
      <div
        data-testid="richtext-cell"
        onClick={onClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        className="tiptap-cell w-full min-h-[28px] px-2 py-1 text-sm text-zinc-300 cursor-text hover:bg-zinc-800/50 rounded break-words"
        dangerouslySetInnerHTML={{ __html: resolvedHtml }}
      />
      {hover &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', left: hover.x, top: hover.y + 6, zIndex: 70 }}
            className="max-w-xs rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-xl pointer-events-none"
          >
            <p className="text-sm font-medium text-white mb-1">{hover.mention.name}</p>
            {hover.mention.description ? (
              <div
                className="tiptap-cell text-xs text-zinc-300"
                dangerouslySetInnerHTML={{ __html: hover.mention.description }}
              />
            ) : (
              <p className="text-xs text-zinc-500 italic">No description</p>
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
}: {
  initialContent: string
  rundownId: string
  mentions: Mention[]
  variables: Variable[]
  onSave: (html: string) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)

  // refs so the suggestion getters always read the latest lists
  const mentionsRef = useRef(mentions)
  mentionsRef.current = mentions
  const variablesRef = useRef(variables)
  variablesRef.current = variables
  const rundownIdRef = useRef(rundownId)
  rundownIdRef.current = rundownId

  // Upload dropped/pasted/picked files and insert image or attachment nodes
  async function handleFiles(files: File[], insertPos?: number) {
    const editor = editorRef.current
    if (!editor) return
    if (insertPos != null) editor.commands.setTextSelection(insertPos)
    for (const file of files) {
      const toastId = toast.loading(`Uploading ${file.name}…`)
      try {
        const uploaded = await uploadCellFile(rundownIdRef.current, file)
        // collapse any node-selection to a cursor so consecutive inserts
        // append instead of replacing the previously-inserted node
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
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
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
    editorProps: {
      attributes: {
        class:
          'tiptap-cell prose-invert focus:outline-none min-h-[28px] px-2 py-1 text-sm text-white',
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

  const save = useCallback(() => {
    if (!editor || savedRef.current) return
    savedRef.current = true
    let html = editor.getHTML()
    if (html === '<p></p>') html = ''
    onSave(html)
  }, [editor, onSave])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node
      // ignore clicks inside the cell or inside a suggestion popup (appended to body)
      if (wrapperRef.current && wrapperRef.current.contains(target)) return
      const el = target as HTMLElement
      if (el?.closest?.('[data-suggestion-popup], .tippy-box')) return
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
        if (e.key === 'Escape') {
          e.preventDefault()
          save()
        }
      }}
    >
      <Toolbar editor={editor} onFiles={handleFiles} />
      <div className="rounded border border-zinc-600 bg-zinc-800 focus-within:ring-1 focus-within:ring-zinc-500">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function Toolbar({
  editor,
  onFiles,
}: {
  editor: Editor
  onFiles: (files: File[]) => void
}) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const btn = (active: boolean) =>
    cn(
      'p-1 rounded transition-colors',
      active
        ? 'bg-zinc-600 text-white'
        : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
    )

  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      ref.current?.click()
    }
  }

  return (
    <div className="absolute top-full mt-1 left-0 z-30 flex items-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-900 px-1 py-0.5 shadow-lg">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBold().run()
        }}
        className={btn(editor.isActive('bold'))}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleItalic().run()
        }}
        className={btn(editor.isActive('italic'))}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleUnderline().run()
        }}
        className={btn(editor.isActive('underline'))}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleBulletList().run()
        }}
        className={btn(editor.isActive('bulletList'))}
        title="Bullet list"
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().toggleHighlight().run()
        }}
        className={btn(editor.isActive('highlight'))}
        title="Highlight"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-4 bg-zinc-700 mx-0.5" />

      {TEXT_COLORS.map((c) => (
        <button
          key={c.label}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            if (c.value === null) editor.chain().focus().unsetColor().run()
            else editor.chain().focus().setColor(c.value).run()
          }}
          title={c.label}
          className="w-4 h-4 rounded-full border border-zinc-600 hover:scale-110 transition-transform"
          style={{
            backgroundColor: c.value ?? 'transparent',
            backgroundImage:
              c.value === null
                ? 'linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)'
                : undefined,
          }}
        />
      ))}

      <span className="w-px h-4 bg-zinc-700 mx-0.5" />

      {/* Image upload */}
      <button
        type="button"
        data-testid="cell-image-btn"
        onMouseDown={pick(imageInputRef)}
        className={btn(false)}
        title="Insert image"
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />

      {/* File attachment */}
      <button
        type="button"
        data-testid="cell-file-btn"
        onMouseDown={pick(fileInputRef)}
        className={btn(false)}
        title="Attach file (PDF, DOCX, CSV, video, audio)"
      >
        <Paperclip className="w-3.5 h-3.5" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
