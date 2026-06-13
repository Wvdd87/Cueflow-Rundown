import { Node, mergeAttributes } from '@tiptap/core'

export interface FileAttachmentAttrs {
  src: string
  name: string
  ftype?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attrs: FileAttachmentAttrs) => ReturnType
    }
  }
}

/** Inline atom node that renders an uploaded non-image file as a chip link. */
export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: { default: 'file' },
      ftype: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-file-attachment]' }]
  },

  renderHTML({ node }) {
    return [
      'a',
      mergeAttributes({
        'data-file-attachment': '',
        class: 'file-attachment',
        href: node.attrs.src,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-name': node.attrs.name,
        'data-ftype': node.attrs.ftype,
      }),
      `📎 ${node.attrs.name}`,
    ]
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs: FileAttachmentAttrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})
