'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MentionsVariablesPanel } from './MentionsVariablesPanel'
import { useRundownData } from './RundownDataContext'
import { addMention, updateMention, deleteMention } from '@/app/actions/mentions'
import {
  addVariable,
  updateVariable,
  deleteVariable,
} from '@/app/actions/variables'
import {
  collabAddMention,
  collabUpdateMention,
  collabDeleteMention,
  collabAddVariable,
  collabUpdateVariable,
  collabDeleteVariable,
} from '@/app/actions/collab'

interface MentionsVariablesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: 'mentions' | 'variables'
}

export function MentionsVariablesDialog({
  open,
  onOpenChange,
  initialTab = 'mentions',
}: MentionsVariablesDialogProps) {
  const { rundownId, mentions, variables, setMentions, setVariables, collab } =
    useRundownData()
  const [tab, setTab] = useState<'mentions' | 'variables'>(initialTab)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2e2e38] text-white sm:max-w-lg p-0 gap-0 border-t-2 border-t-[#f0a838]">
        <DialogHeader className="px-5 py-4 border-b border-[#1d1d24]">
          <DialogTitle>Mentions &amp; Variables</DialogTitle>
        </DialogHeader>

        {collab ? (
          <MentionsVariablesPanel
            mentions={mentions}
            variables={variables}
            setMentions={setMentions}
            setVariables={setVariables}
            tab={tab}
            onTabChange={setTab}
            addMention={(name, description) => collabAddMention(collab.token, name, description)}
            updateMention={(id, updates) => collabUpdateMention(collab.token, id, updates)}
            deleteMention={(id) => collabDeleteMention(collab.token, id)}
            addVariable={(key, value) => collabAddVariable(collab.token, key, value)}
            updateVariable={(id, updates) => collabUpdateVariable(collab.token, id, updates)}
            deleteVariable={(id) => collabDeleteVariable(collab.token, id)}
          />
        ) : (
          <MentionsVariablesPanel
            mentions={mentions}
            variables={variables}
            setMentions={setMentions}
            setVariables={setVariables}
            tab={tab}
            onTabChange={setTab}
            addMention={(name, description) => addMention(rundownId, name, description)}
            updateMention={(id, updates) => updateMention(id, rundownId, updates)}
            deleteMention={(id) => deleteMention(id, rundownId)}
            addVariable={(key, value) => addVariable(rundownId, key, value)}
            updateVariable={(id, updates) => updateVariable(id, rundownId, updates)}
            deleteVariable={(id) => deleteVariable(id, rundownId)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
