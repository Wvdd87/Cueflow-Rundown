'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const channelName = (id: string) => `rundown-live-${id}`

export interface LiveSyncState {
  activeCueId: string | null
  status: string
}

/** Operator side: broadcast the live show state to read-only viewers. */
export function useBroadcastLive(
  rundownId: string,
  activeCueId: string | null,
  status: string,
  isLive: boolean
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supa = createClient()
    const channel = supa.channel(channelName(rundownId))
    channel.subscribe()
    channelRef.current = channel
    return () => {
      supa.removeChannel(channel)
      channelRef.current = null
    }
  }, [rundownId])

  // send on change
  useEffect(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'live',
      payload: { activeCueId, status },
    })
  }, [activeCueId, status])

  // re-broadcast periodically while live so late-joining guests catch up
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'live',
        payload: { activeCueId, status },
      })
    }, 2000)
    return () => clearInterval(id)
  }, [isLive, activeCueId, status])
}

/** Viewer side: subscribe to the operator's live show state. */
export function useLiveSubscription(rundownId: string): LiveSyncState {
  const [state, setState] = useState<LiveSyncState>({
    activeCueId: null,
    status: 'idle',
  })

  useEffect(() => {
    const supa = createClient()
    const channel = supa.channel(channelName(rundownId))
    channel
      .on('broadcast', { event: 'live' }, ({ payload }) => {
        setState({
          activeCueId: (payload?.activeCueId as string | null) ?? null,
          status: (payload?.status as string) ?? 'idle',
        })
      })
      .subscribe()
    return () => {
      supa.removeChannel(channel)
    }
  }, [rundownId])

  return state
}
