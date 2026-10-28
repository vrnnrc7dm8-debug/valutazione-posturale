import { useCallback, useEffect, useRef } from 'react'

export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const debounced = useCallback(
    (...args: Args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => fnRef.current(...args), delay)
    },
    [delay],
  )

  const flush = useCallback((...args: Args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    fnRef.current(...args)
  }, [])

  const cancel = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  return { debounced, flush, cancel }
}
