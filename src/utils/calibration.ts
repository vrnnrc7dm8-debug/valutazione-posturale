import type { PhotoCalibration, PlacedLandmark, Point2D } from '@/types'
import { createDefaultCalibration } from '@/types'

/** Landmark usati per stimare l'estensione corporea verticale (frontale anteriore). */
const BODY_SPAN_LANDMARK_IDS = [
  'vertex',
  'glabella',
  'malleolo_laterale_dx',
  'malleolo_laterale_sx',
  'malleolo_mediale_dx',
  'malleolo_mediale_sx',
  'alluce_dx',
  'alluce_sx',
  'secondo_dito_dx',
  'secondo_dito_sx',
  'rotula_dx',
  'rotula_sx',
] as const

export interface ResolvedCalibration extends PhotoCalibration {
  cmPerNormalizedUnit?: number
  bodySpanNormalized?: number
  label: string
  shiftAvailable: boolean
}

function landmarkPositions(
  landmarks: PlacedLandmark[],
): Map<string, Point2D> {
  const map = new Map<string, Point2D>()
  for (const lm of landmarks) {
    const id = lm.landmarkId ?? (lm as { type?: string }).type
    if (id && lm.position) map.set(id, lm.position)
  }
  return map
}

/** Estima l'altezza corporea normalizzata (vertex → base appoggio). */
export function computeBodySpanNormalized(landmarks: PlacedLandmark[]): number | undefined {
  const positions = landmarkPositions(landmarks)
  let topY: number | undefined
  let bottomY: number | undefined

  for (const id of ['vertex', 'glabella'] as const) {
    const p = positions.get(id)
    if (p) topY = topY === undefined ? p.y : Math.min(topY, p.y)
  }

  for (const id of BODY_SPAN_LANDMARK_IDS) {
    if (id === 'vertex' || id === 'glabella') continue
    const p = positions.get(id)
    if (p) bottomY = bottomY === undefined ? p.y : Math.max(bottomY, p.y)
  }

  if (topY === undefined || bottomY === undefined) return undefined
  const span = bottomY - topY
  return span > 0.15 ? span : undefined
}

function distanceNorm(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Calibrazione da distanza nota tra due landmark (marker). */
export function calibrationFromMarkerDistance(
  landmarks: PlacedLandmark[],
  markerLandmarkA: string,
  markerLandmarkB: string,
  markerDistanceCm: number,
): PhotoCalibration | undefined {
  const positions = landmarkPositions(landmarks)
  const a = positions.get(markerLandmarkA)
  const b = positions.get(markerLandmarkB)
  if (!a || !b || markerDistanceCm <= 0) return undefined

  const span = distanceNorm(a, b)
  if (span < 0.01) return undefined

  return {
    mode: 'marker_distance',
    markerLandmarkA,
    markerLandmarkB,
    markerDistanceCm,
    cmPerNormalizedUnit: markerDistanceCm / span,
    status: 'calibrated',
  }
}

export function resolveCalibration(
  calibration: PhotoCalibration | undefined,
  landmarks: PlacedLandmark[],
  subjectHeightCm?: number,
): ResolvedCalibration {
  const base = calibration ?? createDefaultCalibration()
  const bodySpan = computeBodySpanNormalized(landmarks)

  if (
    base.mode === 'marker_distance' &&
    base.markerLandmarkA &&
    base.markerLandmarkB &&
    base.markerDistanceCm
  ) {
    const fromMarker = calibrationFromMarkerDistance(
      landmarks,
      base.markerLandmarkA,
      base.markerLandmarkB,
      base.markerDistanceCm,
    )
    if (fromMarker?.cmPerNormalizedUnit) {
      return {
        ...fromMarker,
        bodySpanNormalized: bodySpan,
        label: `Marker ${base.markerLandmarkA}–${base.markerLandmarkB} (${base.markerDistanceCm} cm)`,
        shiftAvailable: true,
      }
    }
  }

  if (base.mode === 'manual_scale' && base.cmPerNormalizedUnit && base.cmPerNormalizedUnit > 0) {
    return {
      ...base,
      status: 'calibrated',
      bodySpanNormalized: bodySpan,
      label: `Scala manuale (${base.cmPerNormalizedUnit.toFixed(1)} cm/unità)`,
      shiftAvailable: true,
    }
  }

  const height = base.subjectHeightCm ?? subjectHeightCm
  if (height && height > 0) {
    const cmPerUnit = bodySpan ? height / bodySpan : height
    return {
      ...base,
      mode: base.mode === 'none' ? 'subject_height' : base.mode,
      subjectHeightCm: height,
      cmPerNormalizedUnit: cmPerUnit,
      bodySpanNormalized: bodySpan,
      status: bodySpan ? 'estimated' : 'estimated',
      label: bodySpan
        ? `Altezza ${height} cm / span corporeo ${(bodySpan * 100).toFixed(0)}% immagine`
        : `Altezza ${height} cm (span corporeo non rilevato — stima grezza)`,
      shiftAvailable: true,
    }
  }

  return {
    ...base,
    bodySpanNormalized: bodySpan,
    label: 'Non calibrata',
    shiftAvailable: false,
  }
}

export function normalizedDistanceToCm(
  normalizedDistance: number,
  resolved: ResolvedCalibration,
): { cm?: number; warning?: string } {
  if (!resolved.shiftAvailable || !resolved.cmPerNormalizedUnit) {
    return {
      warning:
        'Shift non convertibile in cm: inserire altezza soggetto o calibrare con marker noto.',
    }
  }
  return { cm: Math.abs(normalizedDistance) * resolved.cmPerNormalizedUnit }
}

export function formatCalibrationBadge(resolved: ResolvedCalibration): string {
  if (resolved.status === 'calibrated') return 'Calibrata'
  if (resolved.status === 'estimated') return 'Stimata'
  return 'Non disponibile'
}
