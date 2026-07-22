'use client'

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MentionsVariablesPanel } from '@/components/rundown/MentionsVariablesPanel'
import {
  collabAddMention,
  collabUpdateMention,
  collabDeleteMention,
  collabAddVariable,
  collabUpdateVariable,
  collabDeleteVariable,
} from '@/app/actions/collab'
import type { Mention, Variable } from '@/lib/supabase/types'

interface CollabMentionsVariablesDialogProps {
  token: string
  open: boolean
  onOpenChange: (open: boolean) => void
  mentions: Mention[]
  variables: Variable[]
  setMentions: Dispatch<SetStateAction<Mention[]>>
  setVariables: Dispatch<SetStateAction<Variable[]>>
}

export function CollabMentionsVariablesDialog({
  token,
  open,
  onOpenChange,
  mentions,
  variables,
  setMentions,
  setVariables,
}: CollabMentionsVariablesDialogProps) {
  const [tab, setTab] = useState<'mentions' | 'variables'>('mentions')

  useEffect(() => {
    if (open) setTab('mentions')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-lg p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle>Mentions &amp; Variables</DialogTitle>
        </DialogHeader>

        <MentionsVariablesPanel
          mentions={mentions}
          variables={variables}
          setMentions={setMentions}
          setVariables={setVariables}
          tab={tab}
          onTabChange={setTab}
          addMention={(name, description) => collabAddMention(token, name, description)}
          updateMention={(id, updates) => collabUpdateMention(token, id, updates)}
          deleteMention={(id) => collabDeleteMention(token, id)}
          addVariable={(key, value) => collabAddVariable(token, key, value)}
          updateVariable={(id, updates) => collabUpdateVariable(token, id, updates)}
          deleteVariable={(id) => collabDeleteVariable(token, id)}
        />
      </DialogContent>
    </Dialog>
  )
}
