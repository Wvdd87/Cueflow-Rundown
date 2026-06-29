'use client'

import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingSize: {
      setHeadingSize: (level: 1 | 2 | 3) => ReturnType
      toggleHeadingSize: (level: 1 | 2 | 3) => ReturnType
      unsetHeadingSize: () => ReturnType
    }
  }
}

// Visual styling carried inline on the span (like the Color/Highlight marks),
// so it renders reliably without depending on an external stylesheet rule —
// Tailwind v4 was tree-shaking the `.tiptap-cell span[data-hs]` CSS, which left
// the mark in the DOM but visually inert. Colour is intentionally omitted so the
// separate text-colour mark stays in control of colour.
const LEVEL_STYLE: Record<number, string> = {
  1: 'font-size:1.25rem;font-weight:700;line-height:1.3',
  2: 'font-size:1.05rem;font-weight:700;line-height:1.3',
  3: 'font-size:0.9rem;font-weight:700;line-height:1.3;text-transform:uppercase;letter-spacing:0.06em',
}

// Inline mark alternative to block-level headings — only affects the selected
// characters, not the entire paragraph/block that contains the selection.
export const HeadingSize = Mark.create({
  name: 'headingSize',

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (el) => parseInt(el.getAttribute('data-hs') ?? '1', 10),
        renderHTML: (attrs) => {
          const level = (attrs.level as number) || 1
          return { 'data-hs': level, style: LEVEL_STYLE[level] ?? LEVEL_STYLE[1] }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-hs]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setHeadingSize: (level) => ({ commands }) => commands.setMark(this.name, { level }),
      toggleHeadingSize: (level) => ({ commands }) => commands.toggleMark(this.name, { level }),
      unsetHeadingSize: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})
