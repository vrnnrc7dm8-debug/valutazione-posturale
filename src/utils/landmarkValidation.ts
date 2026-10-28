import type {
  LandmarkDetectionSource,
  PlacedLandmark,
  Point2D,
  StructuredLandmarkCollection,
} from '@/types'
import { POSTURAL_THRESHOLDS } from '@/config/posturalThresholds'
import { isLandmarkInClinicalBucket } from '@/utils/landmarkCollection'

/** Stato clinico del landmark per referto e UI. */
export type LandmarkValidationState =
  | 'automatico_stimato'
  | 'manuale_confermato'
  | 'manuale_corretto'

export const VALIDATION_STATE_LABELS: Record<LandmarkValidationState, string> = {
  automatico_stimato: 'Automatico stimato',
  manuale_confermato: 'Manuale confermato',
  manuale_corretto: 'Manuale corretto',
}

const CORRECTION_THRESHOLD_NORM = 0.008

export function resolveValidationState(lm: PlacedLandmark): LandmarkValidationState {
  if (lm.validationState) return lm.validationState

  if (lm.detectionSource === 'automatic' || lm.needsConfirmation) {
    return 'automatico_stimato'
  }
  if (lm.detectionSource === 'confirmed_auto') {
    return 'manuale_confermato'
  }
  if (lm.detectionSource === 'manual' && lm.autoPosition) {
    const dx = lm.position.x - lm.autoPosition.x
    const dy = lm.position.y - lm.autoPosition.y
    if (Math.hypot(dx, dy) > CORRECTION_THRESHOLD_NORM) {
      return 'manuale_corretto'
    }
    return 'manuale_confermato'
  }
  return 'manuale_confermato'
}

export function isClinicallyValidated(lm: PlacedLandmark): boolean {
  return resolveValidationState(lm) !== 'automatico_stimato'
}

export function isReportEligibleLandmark(lm: PlacedLandmark): boolean {
  const state = resolveValidationState(lm)
  if (state === 'automatico_stimato') return false
  return getEffectiveConfidence(lm) >= POSTURAL_THRESHOLDS.minClinicalReportConfidence
}

/** Confidence effettiva mostrata in UI e usata per inferenza. */
export function getEffectiveConfidence(lm: PlacedLandmark): number {
  const state = resolveValidationState(lm)
  const raw = lm.confidence ?? 1

  if (state === 'automatico_stimato') {
    return Math.min(raw, POSTURAL_THRESHOLDS.maxHeuristicLandmarkConfidence)
  }
  if (state === 'manuale_corretto') {
    return Math.max(raw, POSTURAL_THRESHOLDS.manualCorrectedConfidence)
  }
  return Math.max(raw, POSTURAL_THRESHOLDS.manualConfirmedConfidence)
}

export function withValidationState(lm: PlacedLandmark): PlacedLandmark {
  const validationState = resolveValidationState(lm)
  return {
    ...lm,
    validationState,
    confidence: getEffectiveConfidence({ ...lm, validationState }),
    needsConfirmation: validationState === 'automatico_stimato',
  }
}

export function createManualConfirmedLandmark(
  lm: PlacedLandmark,
  position?: Point2D,
): PlacedLandmark {
  return withValidationState({
    ...lm,
    position: position ?? lm.position,
    validationState: 'manuale_confermato',
    detectionSource: 'manual',
    needsConfirmation: false,
    confidence: POSTURAL_THRESHOLDS.manualConfirmedConfidence,
  })
}

export function confirmEstimatedLandmark(lm: PlacedLandmark): PlacedLandmark {
  return withValidationState({
    ...lm,
    validationState: 'manuale_confermato',
    detectionSource: 'confirmed_auto',
    needsConfirmation: false,
    autoPosition: lm.autoPosition ?? lm.position,
    confidence: POSTURAL_THRESHOLDS.manualConfirmedConfidence,
  })
}

export function markLandmarkManualCorrection(
  lm: PlacedLandmark,
  newPosition: Point2D,
): PlacedLandmark {
  return withValidationState({
    ...lm,
    autoPosition: lm.autoPosition ?? lm.position,
    position: newPosition,
    validationState: 'manuale_corretto',
    detectionSource: 'manual',
    needsConfirmation: false,
    confidence: POSTURAL_THRESHOLDS.manualCorrectedConfidence,
  })
}

export function countEstimatedLandmarks(landmarks: PlacedLandmark[]): number {
  return landmarks.filter(
    (lm) => resolveValidationState(lm) === 'automatico_stimato',
  ).length
}

export function allLandmarksReportEligible(
  ids: string[],
  landmarks: PlacedLandmark[],
  collection?: StructuredLandmarkCollection,
): boolean {
  const byId = new Map(landmarks.map((l) => [l.landmarkId, l]))
  for (const id of ids) {
    if (collection && !isLandmarkInClinicalBucket(id, collection)) {
      return false
    }
    const lm = byId.get(id)
    if (!lm || !isReportEligibleLandmark(lm)) return false
  }
  return true
}

export function migrateLegacyLandmarkFields(lm: PlacedLandmark): PlacedLandmark {
  return withValidationState(lm)
}

export function migrateLegacyLandmarks(landmarks: PlacedLandmark[]): PlacedLandmark[] {
  return landmarks.map(migrateLegacyLandmarkFields)
}

/** @deprecated compat — usa resolveValidationState */
export function landmarkSourceLabel(lm: PlacedLandmark): string {
  return VALIDATION_STATE_LABELS[resolveValidationState(lm)]
}

export type LegacyDetectionSource = LandmarkDetectionSource
