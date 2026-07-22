'use client'

import { useCallback, useRef, useState } from 'react'

interface UseAsyncState<R> {
  loading: boolean
  error: Error | null
  execute: (...args: unknown[]) => Promise<R | undefined>
}

/** Wraps an async function with loading/error state. Guards against setting
 *  state after unmount (e.g. a dialog closes mid-request). */
export function useAsync<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>
): UseAsyncState<R> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)
  mountedRef.current = true

  const execute = useCallback(
    async (...args: Args) => {
      setLoading(true)
      setError(null)
      try {
        const result = await fn(...args)
        if (mountedRef.current) setLoading(false)
        return result
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
        throw err
      }
    },
    [fn]
  ) as UseAsyncState<R>['execute']

  return { loading, error, execute }
}
