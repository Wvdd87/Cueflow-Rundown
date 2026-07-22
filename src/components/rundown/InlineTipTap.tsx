'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { HeadingSize } from './HeadingSize'
import { BubbleTipTapToolbar } from './RichTextCell'

interface InlineTipTapProps {
  initialContent: string
  placeholder?: string
  className?: string
  onSave: (html: string) => void
  editorClassName?: string
}

export function InlineTipTap({
  initialContent,
  placeholder,
  className,
  onSave,
  editorClassName,
}: InlineTipTapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)

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
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: editorClassName ?? 'tiptap-cell focus:outline-none w-full',
      },
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
      className={className}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); save() } }}
    >
      <BubbleTipTapToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
