import type { ImageViewState, Point2D } from '@/types'

export interface ImageDisplayMetrics {
  offsetX: number
  offsetY: number
  displayWidth: number
  displayHeight: number
  containerWidth: number
  containerHeight: number
}

/** Rettangolo effettivo dell'immagine dopo pan/zoom nel contenitore. */
export interface TransformedImageRect {
  left: number
  top: number
  width: number
  height: number
  base: ImageDisplayMetrics
}

export function computeImageDisplayMetrics(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ImageDisplayMetrics {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      displayWidth: containerWidth,
      displayHeight: containerHeight,
      containerWidth,
      containerHeight,
    }
  }
  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
  )
  const displayWidth = imageWidth * scale
  const displayHeight = imageHeight * scale
  return {
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
    displayWidth,
    displayHeight,
    containerWidth,
    containerHeight,
  }
}

export function computeTransformedImageRect(
  base: ImageDisplayMetrics,
  view: ImageViewState,
): TransformedImageRect {
  const width = base.displayWidth * view.zoom
  const height = base.displayHeight * view.zoom
  return {
    left: base.offsetX + view.panX,
    top: base.offsetY + view.panY,
    width,
    height,
    base,
  }
}

/** Coordinate normalizzate sull'immagine (0–1) → pixel nel contenitore. */
export function imageNormToContainer(
  point: Point2D,
  rect: TransformedImageRect,
): { x: number; y: number } {
  const w = rect.width > 0 ? rect.width : 0
  const h = rect.height > 0 ? rect.height : 0
  return {
    x: rect.left + (point?.x ?? 0.5) * w,
    y: rect.top + (point?.y ?? 0.5) * h,
  }
}

function rectsEqual(
  a: TransformedImageRect,
  b: TransformedImageRect,
  epsilon = 0.5,
): boolean {
  return (
    Math.abs(a.left - b.left) < epsilon &&
    Math.abs(a.top - b.top) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  )
}

export function measureImageLayerRectIfChanged(
  containerEl: HTMLElement,
  layerEl: HTMLElement,
  base: ImageDisplayMetrics,
  previous: TransformedImageRect | null,
): TransformedImageRect | null {
  const next = measureImageLayerRect(containerEl, layerEl, base)
  if (previous && rectsEqual(previous, next)) return null
  return next
}

/** Pixel contenitore → coordinate immagine normalizzate. */
export function containerToImageNorm(
  containerX: number,
  containerY: number,
  rect: TransformedImageRect,
): Point2D | null {
  const x = (containerX - rect.left) / rect.width
  const y = (containerY - rect.top) / rect.height
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}

/** Come sopra ma sempre dentro 0–1 (utile durante drag fuori dal riquadro immagine). */
export function containerToImageNormClamped(
  containerX: number,
  containerY: number,
  rect: TransformedImageRect,
): Point2D {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0.5, y: 0.5 }
  }
  const x = (containerX - rect.left) / rect.width
  const y = (containerY - rect.top) / rect.height
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  }
}

/** @deprecated Usare imageNormToContainer */
export function normalizedToPixel(
  point: Point2D,
  metrics: ImageDisplayMetrics,
): { x: number; y: number } {
  return {
    x: metrics.offsetX + point.x * metrics.displayWidth,
    y: metrics.offsetY + point.y * metrics.displayHeight,
  }
}

export function angleAtVertex(a: Point2D, vertex: Point2D, c: Point2D): number {
  const v1x = a.x - vertex.x
  const v1y = a.y - vertex.y
  const v2x = c.x - vertex.x
  const v2y = c.y - vertex.y
  const mag1 = Math.hypot(v1x, v1y)
  const mag2 = Math.hypot(v2x, v2y)
  if (mag1 < 1e-6 || mag2 < 1e-6) return 0
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)))
  return (Math.acos(cos) * 180) / Math.PI
}

export function distanceNormalized(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function describeAngleArc(
  a: { x: number; y: number },
  vertex: { x: number; y: number },
  c: { x: number; y: number },
  radius = 28,
): string {
  const a1 = Math.atan2(a.y - vertex.y, a.x - vertex.x)
  const a2 = Math.atan2(c.y - vertex.y, c.x - vertex.x)
  let start = a1
  let end = a2
  let sweep = end - start
  if (sweep > Math.PI) sweep -= 2 * Math.PI
  if (sweep < -Math.PI) sweep += 2 * Math.PI
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0
  const sweepFlag = sweep > 0 ? 1 : 0
  const x1 = vertex.x + radius * Math.cos(start)
  const y1 = vertex.y + radius * Math.sin(start)
  const x2 = vertex.x + radius * Math.cos(end)
  const y2 = vertex.y + radius * Math.sin(end)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${x2} ${y2}`
}

export function zoomImageAtPoint(
  view: ImageViewState,
  base: ImageDisplayMetrics,
  cursorX: number,
  cursorY: number,
  newZoom: number,
): ImageViewState {
  const rect = computeTransformedImageRect(base, view)
  const u = (cursorX - rect.left) / rect.width
  const v = (cursorY - rect.top) / rect.height
  const newW = base.displayWidth * newZoom
  const newH = base.displayHeight * newZoom
  const newLeft = cursorX - u * newW
  const newTop = cursorY - v * newH
  return {
    zoom: newZoom,
    panX: newLeft - base.offsetX,
    panY: newTop - base.offsetY,
  }
}

export function centerImageInContainer(
  base: ImageDisplayMetrics,
  view: ImageViewState,
): ImageViewState {
  const w = base.displayWidth * view.zoom
  const h = base.displayHeight * view.zoom
  const left = (base.containerWidth - w) / 2
  const top = (base.containerHeight - h) / 2
  return {
    ...view,
    panX: left - base.offsetX,
    panY: top - base.offsetY,
  }
}

export function fitImageToFrame(): ImageViewState {
  return { panX: 0, panY: 0, zoom: 1 }
}

/** Rettangolo immagine misurato nel DOM (allineato al pixel con object-contain). */
export function measureImageLayerRect(
  containerEl: HTMLElement,
  layerEl: HTMLElement,
  base: ImageDisplayMetrics,
): TransformedImageRect {
  const c = containerEl.getBoundingClientRect()
  const l = layerEl.getBoundingClientRect()
  return {
    left: l.left - c.left,
    top: l.top - c.top,
    width: l.width,
    height: l.height,
    base,
  }
}
