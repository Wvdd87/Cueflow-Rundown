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

// Inline mark alternative to block-level headings — only affects the selected
// characters, not the entire paragraph/block that contains the selection.
export const HeadingSize = Mark.create({
  name: 'headingSize',

  addAttributes() {
    return {
      level: {
        default: 1,
        parseHTML: (el) => parseInt(el.getAttribute('data-hs') ?? '1', 10),
        renderHTML: (attrs) => ({ 'data-hs': attrs.level }),
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
