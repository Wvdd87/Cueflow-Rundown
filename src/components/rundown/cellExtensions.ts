'use client'

import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import { SuggestionList } from './SuggestionList'
import type { SuggestionItem, SuggestionListRef } from './SuggestionList'

type GetItems = () => SuggestionItem[]

function repositionPopup(popup: HTMLElement | null, clientRect?: (() => DOMRect | null) | null) {
  if (!popup || !clientRect) return
  const rect = clientRect()
  if (!rect) return
  popup.style.left = `${rect.left + window.scrollX}px`
  popup.style.top = `${rect.bottom + window.scrollY + 4}px`
}

function buildSuggestion(char: string, pluginKeyName: string, getItems: GetItems) {
  return {
    char,
    pluginKey: new PluginKey(pluginKeyName),
    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase()
      return getItems()
        .filter((i) => i.label.toLowerCase().includes(q))
        .slice(0, 8)
    },
    render: () => {
      let component: ReactRenderer<SuggestionListRef> | null = null
      let popup: HTMLDivElement | null = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const propsFor = (props: any) => ({
        items: props.items as SuggestionItem[],
        char,
        command: (item: SuggestionItem) =>
          props.command({ id: item.id, label: item.label }),
      })

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStart: (props: any) => {
          component = new ReactRenderer(SuggestionList, {
            props: propsFor(props),
            editor: props.editor,
          })
          popup = document.createElement('div')
          popup.setAttribute('data-suggestion-popup', '')
          popup.style.position = 'absolute'
          popup.style.zIndex = '60'
          popup.appendChild(component.element)
          document.body.appendChild(popup)
          repositionPopup(popup, props.clientRect)
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onUpdate: (props: any) => {
          component?.updateProps(propsFor(props))
          repositionPopup(popup, props.clientRect)
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') return true
          return component?.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          popup?.remove()
          popup = null
          component?.destroy()
          component = null
        },
      }
    },
  }
}

/**
 * A single Mention node with two triggers:
 *   @  → mentions   (id = mention.id,  label = name)
 *   $  → variables  (id = variable.key, label = key)
 * The trigger char is stored on each node as `data-mention-suggestion-char`,
 * which display/styling uses to tell the two apart.
 */
export function buildMentionExtension(
  getMentions: GetItems,
  getVariables: GetItems
) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    suggestions: [
      buildSuggestion('@', 'mentionSuggestion', getMentions),
      buildSuggestion('$', 'variableSuggestion', getVariables),
    ],
  })
}
