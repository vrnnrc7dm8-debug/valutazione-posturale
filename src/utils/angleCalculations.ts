import type { Point2D } from '@/types'

/** Angolo in gradi al vertice. */
export function angleAtVertexDegrees(
  a: Point2D,
  vertex: Point2D,
  c: Point2D,
): number {
  const v1x = a.x - vertex.x
  const v1y = a.y - vertex.y
  const v2x = c.x - vertex.x
  const v2y = c.y - vertex.y
  const mag1 = Math.hypot(v1x, v1y)
  const mag2 = Math.hypot(v2x, v2y)
  if (mag1 < 1e-8 || mag2 < 1e-8) return 0
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Angolo di inclinazione di un segmento rispetto all'orizzontale (gradi). */
export function segmentTiltDegrees(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

/** Deviazione dalla verticale (gradi). */
export function deviationFromVerticalDegrees(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.hypot(dx, dy) < 1e-8) return 0
  const angleFromVertical = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI)
  return angleFromVertical
}
