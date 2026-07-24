'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { BubbleTipTapToolbar } from './RichTextCell'

/**
 * Rich-text editor for private notes (admin + shared viewers).
 * Stores HTML. Read mode renders the HTML; click to edit with the same
 * floating bubble toolbar used by cue cells (bold/italic/lists/colors/…).
 */
interface RichNoteCellProps {
  value: string
  onSave: (html: string) => void
  /** Border/accent colour while editing (default amber). */
  accent?: string
  /** Text colour for filled notes (default muted amber). */
  textColor?: string
  placeholder?: string
  testId?: string
  /** In the admin grid this is the cell's focus state — two-stage interaction
   *  (#77): a single click edits only when the cell is already focused. Left
   *  undefined outside the grid (shared view) where a single click still edits. */
  cellFocused?: boolean
}

const isEmptyHtml = (html: string) => !html || html === '<p></p>'

export function RichNoteCell({
  value,
  onSave,
  accent = '#f0a838',
  textColor = '#e8c98a',
  placeholder = 'Private note…',
  testId,
  cellFocused,
}: RichNoteCellProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <NoteTipTap
        initialContent={value}
        accent={accent}
        placeholder={placeholder}
        // In the grid the outer cell focus ring is the border (#76); elsewhere
        // (shared view) keep the editor's own bordered box.
        bordered={cellFocused === undefined}
        onSave={(html) => {
          setEditing(false)
          if (html !== value) onSave(html)
        }}
      />
    )
  }

  const empty = isEmptyHtml(value)
  const cls = 'tiptap-cell w-full min-h-[28px] px-2 py-1 text-[13px] cursor-text break-words [overflow-wrap:anywhere] leading-[1.4]'
  const style = { color: empty ? '#5a5c66' : textColor, fontStyle: empty ? ('italic' as const) : ('normal' as const) }
  const startEditing = () => setEditing(true)
  const clickToEdit = () => { if (cellFocused === undefined || cellFocused) setEditing(true) }

  if (empty) {
    return (
      <div data-testid={testId} data-cell-trigger onClick={clickToEdit} onDoubleClick={startEditing} className={cls} style={style}>
        {placeholder}
      </div>
    )
  }
  return (
    <div
      data-testid={testId}
      data-cell-trigger
      onClick={clickToEdit}
      onDoubleClick={startEditing}
      className={cls}
      style={style}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  )
}

function NoteTipTap({
  initialContent,
  accent,
  placeholder,
  onSave,
  bordered = true,
}: {
  initialContent: string
  accent: string
  placeholder: string
  onSave: (html: string) => void
  bordered?: boolean
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent || '',
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'tiptap-cell prose-invert focus:outline-none min-h-[28px] px-2 py-1 text-[13px] text-[#eef0f3]',
      },
      // Plain Enter is reserved for grid navigation (confirm + move down a row);
      // Shift+Enter still inserts a line break via the default HardBreak binding.
      handleKeyDown(_view, event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          return true
        }
        return false
      },
    },
  })

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
      if (wrapperRef.current && wrapperRef.current.contains(target)) return
      const el = target as HTMLElement
      if (el?.closest?.('[data-bubble-toolbar], .tippy-box')) return
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
      <BubbleTipTapToolbar editor={editor as Editor} />
      {bordered ? (
        <div className="bg-[#0a0a0d] border" style={{ borderColor: accent }}>
          <EditorContent editor={editor} />
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}
