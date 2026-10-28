import { POSTURAL_THRESHOLDS } from '@/config/posturalThresholds'
import type { PlacedLandmark, StructuredLandmarkCollection } from '@/types'
import type { StructuredPosturalFinding } from '@/types/landmarks'
import type { ResolvedCalibration } from '@/utils/calibration'
import { isLandmarkInClinicalBucket } from '@/utils/landmarkCollection'
import {
  getEffectiveConfidence,
  isReportEligibleLandmark,
  resolveValidationState,
} from '@/utils/landmarkValidation'

export type PreliminaryReason =
  | 'landmark_non_confermato'
  | 'confidence_insufficiente'
  | 'scala_non_calibrata'

export const PRELIMINARY_REASON_LABELS: Record<PreliminaryReason, string> = {
  landmark_non_confermato: 'Landmark automatico non confermato',
  confidence_insufficiente: 'Confidence sotto soglia referto',
  scala_non_calibrata: 'Scala non calibrata (shift in cm non disponibile)',
}

export function computePreliminaryReasons(
  landmarkIds: string[],
  landmarks: PlacedLandmark[],
  options: {
    operator?: StructuredPosturalFinding['operator']
    unit?: StructuredPosturalFinding['unit']
    calibration?: ResolvedCalibration
    collection?: StructuredLandmarkCollection
  } = {},
): PreliminaryReason[] {
  const reasons = new Set<PreliminaryReason>()
  const byId = new Map(landmarks.map((l) => [l.landmarkId, l]))

  for (const id of landmarkIds) {
    if (options.collection && !isLandmarkInClinicalBucket(id, options.collection)) {
      reasons.add('landmark_non_confermato')
      continue
    }
    const lm = byId.get(id)
    if (!lm || resolveValidationState(lm) === 'automatico_stimato') {
      reasons.add('landmark_non_confermato')
      continue
    }
    if (getEffectiveConfidence(lm) < POSTURAL_THRESHOLDS.minClinicalReportConfidence) {
      reasons.add('confidence_insufficiente')
    }
  }

  if (options.operator === 'shift') {
    if (options.unit === 'px') {
      reasons.add('scala_non_calibrata')
    } else if (
      options.unit === 'cm' &&
      options.calibration &&
      !options.calibration.shiftAvailable
    ) {
      reasons.add('scala_non_calibrata')
    }
  }

  return [...reasons]
}

export function isFindingReportEligible(
  landmarkIds: string[],
  landmarks: PlacedLandmark[],
  options: {
    operator?: StructuredPosturalFinding['operator']
    unit?: StructuredPosturalFinding['unit']
    calibration?: ResolvedCalibration
    collection?: StructuredLandmarkCollection
  } = {},
): boolean {
  return computePreliminaryReasons(landmarkIds, landmarks, options).length === 0
}

export function formatPreliminaryReasons(reasons: PreliminaryReason[]): string[] {
  return reasons.map((r) => PRELIMINARY_REASON_LABELS[r])
}

/** Verifica singolo landmark per referto (alias esportato per test). */
export { isReportEligibleLandmark }
