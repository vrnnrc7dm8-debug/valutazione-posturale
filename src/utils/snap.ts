import type {
  AnnotationOverlaySettings,
  PlacedLandmark,
  Point2D,
} from '@/types'
import type { TransformedImageRect } from '@/utils/geometry'
import {
  containerToImageNorm,
  containerToImageNormClamped,
} from '@/utils/geometry'

export const DEFAULT_SNAP_THRESHOLD = 0.025
export const GRID_SNAP_STEP = 0.05
const FRAME_SNAP_PX = 14

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Snap in coordinate immagine da click nel contenitore. */
export function snapImagePointFromContainer(
  containerX: number,
  containerY: number,
  rect: TransformedImageRect,
  overlay: AnnotationOverlaySettings,
  landmarks: PlacedLandmark[],
  excludeLandmarkId?: string,
): Point2D | null {
  const { base } = rect
  let sx = containerX
  let sy = containerY

  if (overlay.snapEnabled) {
    if (overlay.showGravityLine) {
      const gx = overlay.gravityLineX * base.containerWidth
      if (Math.abs(sx - gx) < FRAME_SNAP_PX) sx = gx
    }
    if (overlay.showHorizontalRef) {
      const gy = overlay.horizontalRefY * base.containerHeight
      if (Math.abs(sy - gy) < FRAME_SNAP_PX) sy = gy
    }
  }

  const norm =
    containerToImageNorm(sx, sy, rect) ??
    containerToImageNormClamped(sx, sy, rect)

  if (!overlay.snapEnabled) {
    return { x: clamp01(norm.x), y: clamp01(norm.y) }
  }

  let { x, y } = norm
  const step = GRID_SNAP_STEP
  x = Math.round(x / step) * step
  y = Math.round(y / step) * step

  for (const lm of landmarks) {
    if (lm.id === excludeLandmarkId) continue
    const dx = lm.position.x - x
    const dy = lm.position.y - y
    if (Math.hypot(dx, dy) < DEFAULT_SNAP_THRESHOLD) {
      return { x: lm.position.x, y: lm.position.y }
    }
  }

  return { x: clamp01(x), y: clamp01(y) }
}

/** @deprecated */
export function snapNormalizedPoint(
  point: Point2D,
  overlay: AnnotationOverlaySettings,
  landmarks: PlacedLandmark[],
  excludeLandmarkId?: string,
  threshold = DEFAULT_SNAP_THRESHOLD,
): Point2D {
  if (!overlay.snapEnabled) {
    return { x: clamp01(point.x), y: clamp01(point.y) }
  }
  let { x, y } = point
  const step = GRID_SNAP_STEP
  x = Math.round(x / step) * step
  y = Math.round(y / step) * step
  for (const lm of landmarks) {
    if (lm.id === excludeLandmarkId) continue
    if (Math.hypot(lm.position.x - x, lm.position.y - y) < threshold) {
      return { x: lm.position.x, y: lm.position.y }
    }
  }
  return { x: clamp01(x), y: clamp01(y) }
}
