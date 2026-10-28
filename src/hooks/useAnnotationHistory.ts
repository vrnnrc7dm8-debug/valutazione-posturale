import { useCallback, useState } from 'react'
import type { PhotoAnnotations } from '@/types'

const MAX_HISTORY = 40

export type AnnotationSnapshot = Pick<
  PhotoAnnotations,
  'landmarks' | 'lines' | 'angles'
>

function takeSnapshot(annotations: PhotoAnnotations): AnnotationSnapshot {
  return {
    landmarks: structuredClone(annotations.landmarks),
    lines: structuredClone(annotations.lines),
    angles: structuredClone(annotations.angles),
  }
}

export function useAnnotationHistory() {
  const [past, setPast] = useState<AnnotationSnapshot[]>([])
  const [future, setFuture] = useState<AnnotationSnapshot[]>([])

  const recordBeforeChange = useCallback((current: PhotoAnnotations) => {
    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), takeSnapshot(current)])
    setFuture([])
  }, [])

  const undo = useCallback(
    (current: PhotoAnnotations): PhotoAnnotations | null => {
      if (past.length === 0) return null
      const previous = past[past.length - 1]
      setPast((p) => p.slice(0, -1))
      setFuture((f) => [takeSnapshot(current), ...f])
      return { ...current, ...previous }
    },
    [past],
  )

  const redo = useCallback(
    (current: PhotoAnnotations): PhotoAnnotations | null => {
      if (future.length === 0) return null
      const next = future[0]
      setFuture((f) => f.slice(1))
      setPast((p) => [...p, takeSnapshot(current)])
      return { ...current, ...next }
    },
    [future],
  )

  const clearHistory = useCallback(() => {
    setPast([])
    setFuture([])
  }, [])

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    recordBeforeChange,
    undo,
    redo,
    clearHistory,
  }
}
