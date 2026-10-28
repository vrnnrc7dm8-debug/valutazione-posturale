import type { Point2D } from '@/types'

export interface LevelDifference {
  label: string
  deltaY: number
  deltaX: number
  /** Percentuale altezza immagine normalizzata */
  magnitude: number
  sideHigher?: 'destro' | 'sinistro' | 'superiore' | 'inferiore'
}

export function verticalDifference(
  label: string,
  a: Point2D,
  b: Point2D,
): LevelDifference {
  const deltaY = b.y - a.y
  const deltaX = b.x - a.x
  return {
    label,
    deltaY,
    deltaX,
    magnitude: Math.abs(deltaY),
    sideHigher:
      Math.abs(deltaY) < 0.005
        ? undefined
        : deltaY < 0
          ? 'destro'
          : 'sinistro',
  }
}

export function horizontalShift(
  label: string,
  point: Point2D,
  referenceX: number,
): { label: string; shift: number; direction: 'destro' | 'sinistro' | 'centrato' } {
  const shift = point.x - referenceX
  return {
    label,
    shift,
    direction:
      Math.abs(shift) < 0.01
        ? 'centrato'
        : shift > 0
          ? 'destro'
          : 'sinistro',
  }
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
