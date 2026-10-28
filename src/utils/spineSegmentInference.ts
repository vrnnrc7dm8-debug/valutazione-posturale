import {
  CLINICAL_THRESHOLDS,
  percentQuantitative,
} from '@/data/clinicalThresholds'
import type { ClinicalDirection, Descriptor, PlacedLandmark, QuantitativeValue, Severity } from '@/types'
import {
  passesDetectionThreshold,
  severityFromDetectionThreshold,
} from '@/utils/severityFromMeasurement'

export type SpineSegmentId =
  | 'cervicale'
  | 'toracica'
  | 'lombare'
  | 'lombosacrale'
  | 'sacrale'

export interface SpineSegmentDeviation {
  segment: SpineSegmentId
  alterationId: string
  label: string
  magnitude: number
  direction: ClinicalDirection
  severity: Severity
  quantitative: QuantitativeValue
  reason: string
  descriptor: Descriptor
}

export interface SagittalSpineSegmentMetric {
  segmentLabel: string
  alterationId?: string
  magnitude: number
  severity: Severity
  quantitative: QuantitativeValue
  reason: string
  planeLabel: string
}

const POSTERIOR_SEGMENT_DEFS: Array<{
  segment: SpineSegmentId
  alterationId: string
  label: string
  landmarkIds: string[]
}> = [
  {
    segment: 'cervicale',
    alterationId: 'deviazione_rachidea_cervicale',
    label: 'Deviazione rachidea cervicale',
    landmarkIds: [
      'cervicale_c1',
      'cervicale_c2',
      'cervicale_c3',
      'cervicale_c4',
      'cervicale_c5',
      'cervicale_c6',
      'cervicale_c7',
    ],
  },
  {
    segment: 'toracica',
    alterationId: 'deviazione_rachidea_toracica',
    label: 'Deviazione rachidea toracica',
    landmarkIds: Array.from({ length: 12 }, (_, i) => `toracico_t${i + 1}`),
  },
  {
    segment: 'lombare',
    alterationId: 'deviazione_rachidea_lombare',
    label: 'Deviazione rachidea lombare',
    landmarkIds: ['lombare_l1', 'lombare_l2', 'lombare_l3', 'lombare_l4', 'lombare_l5'],
  },
  {
    segment: 'lombosacrale',
    alterationId: 'deviazione_rachidea_lombosacrale',
    label: 'Deviazione rachidea lombo-sacrale',
    landmarkIds: ['lombare_l5', 'sacro_superiore', 'base_sacrale'],
  },
  {
    segment: 'sacrale',
    alterationId: 'deviazione_sacrale',
    label: 'Deviazione sacrale',
    landmarkIds: ['sacro_superiore', 'base_sacrale', 'sacro_medio', 'apice_sacrale'],
  },
]

function findLm(
  landmarks: PlacedLandmark[],
  id: string,
): PlacedLandmark | undefined {
  return landmarks.find(
    (l) => l.landmarkId === id || (l as { type?: string }).type === id,
  )
}

function posteriorReferenceX(landmarks: PlacedLandmark[]): number | undefined {
  const psisD = findLm(landmarks, 'psis_dx')
  const psisS = findLm(landmarks, 'psis_sx')
  if (psisD && psisS) {
    return (psisD.position.x + psisS.position.x) / 2
  }
  const sacral = [
    findLm(landmarks, 'sacro_superiore'),
    findLm(landmarks, 'base_sacrale'),
    findLm(landmarks, 'sacro_medio'),
    findLm(landmarks, 'apice_sacrale'),
  ].filter(Boolean) as PlacedLandmark[]
  if (sacral.length > 0) {
    return sacral.reduce((sum, lm) => sum + lm.position.x, 0) / sacral.length
  }
  const c7 = findLm(landmarks, 'cervicale_c7')
  return c7?.position.x
}

function lateralDirection(deltaX: number): ClinicalDirection {
  return deltaX >= 0 ? 'dx' : 'sx'
}

export function computePosteriorSpineSegmentDeviations(
  landmarks: PlacedLandmark[],
): SpineSegmentDeviation[] {
  const refX = posteriorReferenceX(landmarks)
  if (refX === undefined) return []

  const threshold = CLINICAL_THRESHOLDS.deviazione_spinous_posterior
  const results: SpineSegmentDeviation[] = []

  for (const def of POSTERIOR_SEGMENT_DEFS) {
    const placed = def.landmarkIds
      .map((id) => findLm(landmarks, id))
      .filter(Boolean) as PlacedLandmark[]
    if (placed.length === 0) continue

    let maxMag = 0
    let maxDelta = 0
    let maxLabel = placed[0].shortLabel

    for (const lm of placed) {
      const delta = lm.position.x - refX
      const mag = Math.abs(delta)
      if (mag > maxMag) {
        maxMag = mag
        maxDelta = delta
        maxLabel = lm.shortLabel
      }
    }

    if (!passesDetectionThreshold(maxMag, threshold)) continue

    const direction = lateralDirection(maxDelta)
    const quantitative = percentQuantitative(maxMag)
    results.push({
      segment: def.segment,
      alterationId: def.alterationId,
      label: def.label,
      magnitude: maxMag,
      direction,
      severity: severityFromDetectionThreshold(maxMag, threshold),
      quantitative,
      descriptor: 'shift',
      reason: `Massima deviazione laterale ${quantitative.value}% (${maxLabel}) rispetto alla linea sacrale/bacino.`,
    })
  }

  return results
}

function sagittalId(plane: 'sagittale_destro' | 'sagittale_sinistro', base: string) {
  return `${base}_${plane}`
}

function sagittalShift(
  upper: PlacedLandmark,
  lower: PlacedLandmark,
): { shift: number; label: string } {
  return {
    shift: upper.position.x - lower.position.x,
    label: `${upper.shortLabel}–${lower.shortLabel}`,
  }
}

/** Metriche sagittali inter-segmento lungo la catena C7→S2. */
export function computeSagittalSpineSegmentMetrics(
  plane: 'sagittale_destro' | 'sagittale_sinistro',
  landmarks: PlacedLandmark[],
): SagittalSpineSegmentMetric[] {
  const chain = ['c7', 't10', 't11', 't12', 'l1', 'l2', 'l3', 'l4', 'l5', 's1', 's2']
  const placed = chain
    .map((base) => findLm(landmarks, sagittalId(plane, base)))
    .filter(Boolean) as PlacedLandmark[]

  if (placed.length < 2) return []

  const threshold = CLINICAL_THRESHOLDS.sagittal_segment_shift
  const metrics: SagittalSpineSegmentMetric[] = []

  for (let i = 0; i < placed.length - 1; i++) {
    const upper = placed[i]
    const lower = placed[i + 1]
    const { shift, label } = sagittalShift(upper, lower)
    const mag = Math.abs(shift)
    if (!passesDetectionThreshold(mag, threshold)) continue

    const quantitative = percentQuantitative(mag)
    const direction = shift >= 0 ? 'anteriore' : 'posteriore'
    metrics.push({
      segmentLabel: label,
      magnitude: mag,
      severity: severityFromDetectionThreshold(mag, threshold),
      quantitative,
      planeLabel: plane === 'sagittale_destro' ? 'Sagittale DX' : 'Sagittale SX',
      reason: `Shift ${direction} ${quantitative.value}% tra ${label}.`,
    })
  }

  return metrics
}

export const SAGITTAL_SPINE_CHAIN = [
  'c7',
  't10',
  't11',
  't12',
  'l1',
  'l2',
  'l3',
  'l4',
  'l5',
  's1',
  's2',
] as const

export function findSagittalSpineLandmark(
  plane: 'sagittale_destro' | 'sagittale_sinistro',
  landmarks: PlacedLandmark[],
  base: string,
): PlacedLandmark | undefined {
  return findLm(landmarks, sagittalId(plane, base))
}
