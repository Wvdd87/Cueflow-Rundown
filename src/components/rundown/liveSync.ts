'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const channelName = (id: string) => `rundown-live-${id}`

export interface LiveSyncState {
  activeCueId: string | null
  nextCueId: string | null
  status: string
  /** elapsed ms within the active cue at the moment the snapshot was sent */
  elapsedMs: number
  /** effective duration (incl. nudge) of the active cue */
  durationMs: number
  /** operator's Date.now() when the snapshot was sent — used to extrapolate */
  sentAt: number
}

export interface LiveBroadcast {
  activeCueId: string | null
  nextCueId: string | null
  status: string
  elapsedMs: number
  durationMs: number
  isLive: boolean
}

/** Operator side: broadcast the live show state (incl. timing) to viewers.
 *  `isLeader` gates whether this client's state is actually sent — with
 *  collaboration links able to drive the show too, a non-leader's stale
 *  "idle" state must never overwrite the current leader's live broadcast. */
export function useBroadcastLive(rundownId: string, live: LiveBroadcast, isLeader: boolean = true) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscribedRef = useRef(false)
  const liveRef = useRef(live)
  liveRef.current = live
  const isLeaderRef = useRef(isLeader)
  isLeaderRef.current = isLeader

  useEffect(() => {
    const supa = createClient()
    const channel = supa.channel(channelName(rundownId))
    subscribedRef.current = false
    channel.subscribe((status) => {
      subscribedRef.current = status === 'SUBSCRIBED'
      // Flush the latest state the moment the socket joins, so a viewer that
      // was already connected at go-live gets the current cue immediately.
      if (subscribedRef.current) send()
    })
    channelRef.current = channel
    return () => {
      subscribedRef.current = false
      supa.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rundownId])

  function send() {
    // Skip until the channel has actually joined — sending earlier falls back
    // to an HTTP POST that gets aborted by the go-live re-render (ERR_ABORTED).
    if (!subscribedRef.current) return
    if (!isLeaderRef.current) return
    const l = liveRef.current
    channelRef.current?.send({
      type: 'broadcast',
      event: 'live',
      payload: {
        activeCueId: l.activeCueId,
        nextCueId: l.nextCueId,
        status: l.status,
        elapsedMs: Math.round(l.elapsedMs),
        durationMs: Math.round(l.durationMs),
        sentAt: Date.now(),
      },
    })
  }

  // Send immediately whenever the active cue, run status, or leadership changes.
  useEffect(() => {
    send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.activeCueId, live.status, isLeader])

  // Re-broadcast every second while live so countdowns stay synced and
  // late-joining guests catch up.
  useEffect(() => {
    if (!live.isLive) return
    const id = setInterval(send, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.isLive, isLeader])
}

/** Viewer side: subscribe to the operator's live show state. */
export function useLiveSubscription(rundownId: string): LiveSyncState {
  const [state, setState] = useState<LiveSyncState>({
    activeCueId: null,
    nextCueId: null,
    status: 'idle',
    elapsedMs: 0,
    durationMs: 0,
    sentAt: 0,
  })

  useEffect(() => {
    const supa = createClient()
    const channel = supa.channel(channelName(rundownId))
    channel
      .on('broadcast', { event: 'live' }, ({ payload }) => {
        setState({
          activeCueId: (payload?.activeCueId as string | null) ?? null,
          nextCueId: (payload?.nextCueId as string | null) ?? null,
          status: (payload?.status as string) ?? 'idle',
          elapsedMs: (payload?.elapsedMs as number) ?? 0,
          durationMs: (payload?.durationMs as number) ?? 0,
          sentAt: (payload?.sentAt as number) ?? 0,
        })
      })
      .subscribe()
    return () => {
      supa.removeChannel(channel)
    }
  }, [rundownId])

  return state
}

export interface LeaderState {
  /** null = the owner is driving (the default); otherwise a collaboration link id. */
  leaderToken: string | null
  leaderLabel: string
}

/** Who currently has show control. Polled (leadership changes are rare and
 *  only matter at the idle→running transition) rather than pushed over the
 *  broadcast channel, to avoid a second realtime wiring for a low-frequency
 *  value. Both the owner's editor and collaborator views use this to decide
 *  whether their own `useBroadcastLive` should actually send. */
export function useLeaderState(rundownId: string): LeaderState & { refresh: () => void } {
  const [state, setState] = useState<LeaderState>({ leaderToken: null, leaderLabel: 'Owner' })

  const refresh = useCallback(() => {
    const supa = createClient()
    ;(supa.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
      'get_rundown_leader',
      { p_rundown_id: rundownId }
    ).then(({ data }) => {
      const d = data as { leaderToken?: string | null; leaderLabel?: string } | null
      if (d) setState({ leaderToken: d.leaderToken ?? null, leaderLabel: d.leaderLabel ?? 'Owner' })
    })
  }, [rundownId])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  return { ...state, refresh }
}
