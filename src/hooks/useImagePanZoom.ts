import { useCallback, useRef } from 'react'
import type { ImageViewState } from '@/types'
import type { ImageDisplayMetrics } from '@/utils/geometry'
import {
  centerImageInContainer,
  fitImageToFrame,
  zoomImageAtPoint,
} from '@/utils/geometry'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 5

export function useImagePanZoom(
  view: ImageViewState,
  onViewChange: (view: ImageViewState) => void,
  onViewPreview?: (view: ImageViewState) => void,
) {
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0, zoom: 1 })
  const lastPanView = useRef(view)
  lastPanView.current = view

  const setZoom = useCallback(
    (zoom: number, base?: ImageDisplayMetrics, cursor?: { x: number; y: number }) => {
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      if (base && cursor) {
        onViewChange(zoomImageAtPoint(view, base, cursor.x, cursor.y, z))
      } else {
        onViewChange({ ...view, zoom: z })
      }
    },
    [view, onViewChange],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent, rect: DOMRect, base: ImageDisplayMetrics) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.92 : 1.08
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, view.zoom * delta),
      )
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      onViewChange(zoomImageAtPoint(view, base, cx, cy, nextZoom))
    },
    [view, onViewChange],
  )

  const startPan = useCallback(
    (e: React.PointerEvent) => {
      isPanning.current = true
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: view.panX,
        panY: view.panY,
        zoom: view.zoom,
      }
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    },
    [view.panX, view.panY],
  )

  const movePan = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return
      const next = {
        panX: panStart.current.panX + (e.clientX - panStart.current.x),
        panY: panStart.current.panY + (e.clientY - panStart.current.y),
        zoom: panStart.current.zoom,
      }
      lastPanView.current = next
      ;(onViewPreview ?? onViewChange)(next)
    },
    [onViewChange, onViewPreview],
  )

  const endPan = useCallback(() => {
    if (!isPanning.current) return
    isPanning.current = false
    if (onViewPreview) {
      onViewChange(lastPanView.current)
    }
  }, [onViewChange, onViewPreview])

  const fitToFrame = useCallback(() => {
    onViewChange(fitImageToFrame())
  }, [onViewChange])

  const centerImage = useCallback(
    (base: ImageDisplayMetrics) => {
      onViewChange(centerImageInContainer(base, view))
    },
    [view, onViewChange],
  )

  return {
    MIN_ZOOM,
    MAX_ZOOM,
    setZoom,
    handleWheel,
    startPan,
    movePan,
    endPan,
    fitToFrame,
    centerImage,
  }
}
