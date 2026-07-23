'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { HeadingSize } from './HeadingSize'
import { BubbleTipTapToolbar } from './RichTextCell'
import { CellSuggestions } from './CellSuggestions'
import type { Suggestion } from './useFieldSuggestions'
import { cn } from '@/lib/utils'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface InlineTipTapProps {
  initialContent: string
  placeholder?: string
  className?: string
  onSave: (html: string) => void
  editorClassName?: string
  /** Select all existing content on focus (used when duplicating a cue so the
   *  pre-filled title can be typed over or extended — see #71.2). */
  selectAllOnFocus?: boolean
  /** Field-value autocomplete provider (#71.1). Returns suggestions for the
   *  current plaintext query; omit to disable autocomplete for this editor. */
  getSuggestions?: (query: string) => Suggestion[]
}

export function InlineTipTap({
  initialContent,
  placeholder,
  className,
  onSave,
  editorClassName,
  selectAllOnFocus = false,
  getSuggestions,
}: InlineTipTapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const suggestionsRef = useRef(suggestions)
  suggestionsRef.current = suggestions
  const highlightedRef = useRef(highlighted)
  highlightedRef.current = highlighted
  const getSuggestionsRef = useRef(getSuggestions)
  getSuggestionsRef.current = getSuggestions
  const acceptRef = useRef<() => void>(() => {})

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        hardBreak: false,
      }),
      HeadingSize,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent || '',
    autofocus: selectAllOnFocus ? 'all' : 'end',
    onUpdate({ editor }) {
      const fn = getSuggestionsRef.current
      setSuggestions(fn ? fn(editor.getText()) : [])
      setHighlighted(0)
    },
    editorProps: {
      attributes: {
        class: editorClassName ?? 'tiptap-cell focus:outline-none w-full',
      },
      handleKeyDown(_view, event) {
        const sugg = suggestionsRef.current
        if (sugg.length > 0) {
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
          // Enter/Tab accept, then fall through to the grid's own confirm+move
          // (don't stopPropagation) so focus advances as normal.
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
    },
  })

  acceptRef.current = () => {
    if (!editor) return
    const v = suggestionsRef.current[highlightedRef.current]?.value
    if (v == null) return
    // v3 setContent defaults to emitUpdate:false, so this won't re-trigger the
    // suggestion popover for the just-accepted value.
    editor.commands.setContent(`<p>${escapeHtml(v)}</p>`)
    editor.commands.focus('end')
    setSuggestions([])
  }

  const save = useCallback(() => {
    if (!editor || savedRef.current) return
    savedRef.current = true
    let html = editor.getHTML()
    // Collapse empty paragraph to empty string
    if (html === '<p></p>') html = ''
    onSave(html)
  }, [editor, onSave])

  // Save when clicking outside the wrapper.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      // Check the composed path, not the live target: clicking a bubble-toolbar
      // submenu item (e.g. Heading 1) calls setOpenMenu(null), which React 18
      // flushes synchronously and detaches the clicked button before this runs —
      // so target.closest() would wrongly read it as an outside click and close
      // the editor. The path is snapshotted at dispatch and keeps the ancestors.
      const path = e.composedPath()
      const inSkipZone = path.some(
        (n) =>
          n instanceof HTMLElement &&
          (n === wrapperRef.current || n.hasAttribute('data-bubble-toolbar'))
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
      className={cn('relative', className)}
      onKeyDown={(e) => {
        // Escape closes the suggestion popover first (keeping the typed value);
        // only a second Escape (or Escape with no popover) confirms the cell.
        if (e.key === 'Escape' && suggestionsRef.current.length === 0) { e.preventDefault(); save() }
      }}
    >
      <BubbleTipTapToolbar editor={editor} />
      <EditorContent editor={editor} />
      <CellSuggestions
        suggestions={suggestions}
        highlighted={highlighted}
        onHover={setHighlighted}
        onPick={(value) => {
          editor.commands.setContent(`<p>${escapeHtml(value)}</p>`)
          editor.commands.focus('end')
          setSuggestions([])
        }}
      />
    </div>
  )
}
