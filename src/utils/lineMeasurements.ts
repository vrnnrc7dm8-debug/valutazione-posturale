import type { Point2D } from '@/types'
import { distanceNormalized } from '@/utils/geometry'

export type LineMeasurementReference = 'horizontal' | 'gravity_vertical'

export const LINE_REFERENCE_LABELS: Record<LineMeasurementReference, string> = {
  horizontal: 'Orizzontale',
  gravity_vertical: 'Verticale gravitazionale',
}

export const LINE_REFERENCE_SHORT: Record<LineMeasurementReference, string> = {
  horizontal: 'orizz.',
  gravity_vertical: 'grav.',
}

/** Lunghezza normalizzata come percentuale del lato immagine (0–100). */
export function lineLengthPercent(a: Point2D, b: Point2D): number {
  return distanceNormalized(a, b) * 100
}

/** Pendenza in gradi rispetto al riferimento scelto (valore assoluto). */
export function lineSlopeDegrees(
  a: Point2D,
  b: Point2D,
  reference: LineMeasurementReference = 'horizontal',
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.hypot(dx, dy) < 1e-6) return 0
  const radians =
    reference === 'horizontal'
      ? Math.atan2(dy, dx)
      : Math.atan2(dx, dy)
  return Math.abs((radians * 180) / Math.PI)
}

export function formatLineMeasurementLabel(
  a: Point2D,
  b: Point2D,
  reference: LineMeasurementReference = 'horizontal',
): string {
  const length = lineLengthPercent(a, b)
  const slope = lineSlopeDegrees(a, b, reference)
  const ref = LINE_REFERENCE_SHORT[reference]
  return `${length.toFixed(1)}% · ${slope.toFixed(1)}° ${ref}`
}

export function resolveLineReference(
  reference?: LineMeasurementReference,
): LineMeasurementReference {
  return reference === 'gravity_vertical' ? 'gravity_vertical' : 'horizontal'
}
