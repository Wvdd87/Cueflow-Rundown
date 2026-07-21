'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { HeadingSize } from './HeadingSize'
import { BubbleTipTapToolbar } from './RichTextCell'
import { formatDuration } from '@/lib/timing'
import { wordCount, autoDurationMs, scriptPreview, type ScriptBlock } from '@/lib/scripts'

const LABEL = 'font-cond text-[9px] font-bold uppercase tracking-[0.16em] text-[#5a5c66]'

interface ScriptDrawerProps {
  scripts: ScriptBlock[]
  focusScriptId?: string | null
  indent: number
  onChange: (scripts: ScriptBlock[]) => void
  onDelete: (scriptId: string) => void
  onToggleCollapsed: (scriptId: string) => void
}

/** Full-width drawer of script/talent-text blocks, rendered below a cue's main row. */
export function ScriptDrawer({
  scripts,
  focusScriptId,
  indent,
  onChange,
  onDelete,
  onToggleCollapsed,
}: ScriptDrawerProps) {
  if (scripts.length === 0) return null
  return (
    <div
      className="flex flex-col gap-1.5"
      style={{ paddingLeft: indent, paddingRight: 14, marginTop: -2, marginBottom: 6 }}
    >
      {scripts.map((block) =>
        block.collapsed ? (
          <CollapsedScript
            key={block.id}
            block={block}
            onExpand={() => onToggleCollapsed(block.id)}
            onDelete={() => onDelete(block.id)}
          />
        ) : (
          <ExpandedScript
            key={block.id}
            block={block}
            autoFocus={block.id === focusScriptId}
            onSave={(content) => onChange(scripts.map((s) => (s.id === block.id ? { ...s, content } : s)))}
            onCollapse={() => onToggleCollapsed(block.id)}
            onDelete={() => onDelete(block.id)}
          />
        )
      )}
    </div>
  )
}

function CollapsedScript({
  block,
  onExpand,
  onDelete,
}: {
  block: ScriptBlock
  onExpand: () => void
  onDelete: () => void
}) {
  const preview = scriptPreview(block.content)
  return (
    <div className="flex items-center gap-2.5 bg-[#111116] border border-[#1d1d24] px-3 py-2">
      <button onClick={onExpand} title="Expand script" className="shrink-0 text-[#7c7e8a] hover:text-[#eef0f3] transition-colors">
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <span className={LABEL + ' shrink-0'}>Script</span>
      <p className="flex-1 min-w-0 truncate text-[12px]" style={{ color: 'rgba(238,240,243,0.55)' }}>
        {preview || <span className="italic opacity-70">Empty script</span>}
      </p>
      <button onClick={onDelete} title="Delete script" className="shrink-0 text-[#7c7e8a] hover:text-[#ff5a73] transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function ExpandedScript({
  block,
  autoFocus,
  onSave,
  onCollapse,
  onDelete,
}: {
  block: ScriptBlock
  autoFocus?: boolean
  onSave: (content: string) => void
  onCollapse: () => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(!!autoFocus)
  const [liveWords, setLiveWords] = useState<number | null>(null)

  const words = liveWords ?? wordCount(block.content)
  const isEmpty = !block.content || block.content === '<p></p>'

  function handleSave(html: string) {
    setEditing(false)
    setLiveWords(null)
    if (html !== block.content) onSave(html)
  }

  return (
    <div className="bg-[#111116] border border-[#1d1d24]">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className={LABEL}>Script</span>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] text-[#454750]">
            {words} word{words === 1 ? '' : 's'} · {formatDuration(autoDurationMs(words))}
          </span>
          <button onClick={onCollapse} title="Collapse script" className="text-[#7c7e8a] hover:text-[#eef0f3] transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} title="Delete script" className="text-[#7c7e8a] hover:text-[#ff5a73] transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <ScriptTipTap
          initialContent={block.content}
          onLiveChange={(html) => setLiveWords(wordCount(html))}
          onSave={handleSave}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="block w-full text-left px-3 pb-2.5 text-[12px] leading-[1.6] [overflow-wrap:anywhere]"
          style={{ color: isEmpty ? '#5a5c66' : 'rgba(238,240,243,0.6)' }}
        >
          {isEmpty ? (
            <span className="italic">Click to write the script…</span>
          ) : (
            <span className="tiptap-cell" dangerouslySetInnerHTML={{ __html: block.content }} />
          )}
        </button>
      )}
    </div>
  )
}

/** Mounted only while a script block is being edited. */
function ScriptTipTap({
  initialContent,
  onLiveChange,
  onSave,
}: {
  initialContent: string
  onLiveChange: (html: string) => void
  onSave: (html: string) => void
}) {
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
        class: 'tiptap-cell focus:outline-none w-full text-[12px] leading-[1.6] text-[#eef0f3]',
      },
    },
    onUpdate: ({ editor }) => onLiveChange(editor.getHTML()),
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
      const path = e.composedPath()
      const inSkipZone = path.some(
        (n) => n instanceof HTMLElement && (n === wrapperRef.current || n.hasAttribute('data-bubble-toolbar'))
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
      className="px-3 pb-2.5"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          save()
        }
      }}
    >
      <BubbleTipTapToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
