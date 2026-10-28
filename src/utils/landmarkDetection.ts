import type { AnatomicalPlane, PlacedLandmark } from '@/types'
import type { LandmarkDetectionResult } from '@/types/landmarks'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import {
  applyAutoProposals,
  getClinicalLandmarks,
  type LandmarkEditorDisplayMode,
} from '@/utils/landmarkCollection'
import type { StructuredLandmarkCollection } from '@/types'
import {
  proposeFrontAnteriorLandmarks,
  FRONT_ANTERIOR_SEMI_AUTO_PRIORITY,
} from '@/utils/frontAnteriorLandmarkEngine'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'
import {
  confirmEstimatedLandmark,
  createManualConfirmedLandmark,
  markLandmarkManualCorrection,
} from '@/utils/landmarkValidation'

export type LandmarkDetectionMode = 'automatic' | 'semi_automatic' | 'manual'

/** @deprecated usa FRONT_ANTERIOR_SEMI_AUTO_PRIORITY */
export const AUTO_LANDMARK_PRIORITY: Record<AnatomicalPlane, string[]> = {
  frontale_anteriore: [...FRONT_ANTERIOR_SEMI_AUTO_PRIORITY],
  frontale_posteriore: [],
  sagittale_destro: [],
  sagittale_sinistro: [],
  trasverso: [],
}

export interface AutomaticDetectionResult {
  collection: StructuredLandmarkCollection
  detections: LandmarkDetectionResult[]
  warnings: string[]
}

export interface DetectLandmarksOptions {
  mode?: LandmarkEditorDisplayMode
}

/**
 * Genera proposte euristiche nel bucket autoProposals.
 * Non modifica confirmed/manual.
 */
export function detectLandmarksAutomatic(
  plane: AnatomicalPlane,
  collection: StructuredLandmarkCollection,
  options: DetectLandmarksOptions = {},
): AutomaticDetectionResult {
  const mode = options.mode ?? 'semi_automatic'
  const clinical = getClinicalLandmarks(collection)

  if (plane !== 'frontale_anteriore') {
    return {
      collection,
      detections: [],
      warnings: [
        'Stima euristica disponibile solo per frontale anteriore. Posteriori/sagittali in sospeso.',
      ],
    }
  }

  const { proposals, warnings } = proposeFrontAnteriorLandmarks(clinical, {
    mode: mode === 'automatic' ? 'automatic' : 'semi_automatic',
  })

  const placedProposals: PlacedLandmark[] = proposals.map((p) =>
    normalizePlacedLandmark(
      {
        id: crypto.randomUUID(),
        landmarkId: p.landmarkId,
        position: p.position,
        confidence: p.confidence,
        autoPosition: { ...p.position },
        validationState: 'automatico_stimato',
        detectionSource: 'automatic',
        needsConfirmation: true,
      },
      plane,
    ),
  )

  const nextCollection = applyAutoProposals(collection, placedProposals)
  const detections: LandmarkDetectionResult[] = placedProposals.map((p) => ({
    landmarkId: p.landmarkId,
    position: p.position,
    confidence: p.confidence,
    needsConfirmation: true,
    plane,
  }))

  if (detections.length === 0) {
    warnings.push('Nessuna nuova proposta: landmark clinici già presenti o piano non supportato.')
  }

  return { collection: nextCollection, detections, warnings }
}

export function confirmAutomaticLandmark(lm: PlacedLandmark): PlacedLandmark {
  return confirmEstimatedLandmark(lm)
}

export { markLandmarkManualCorrection, createManualConfirmedLandmark }

export function getLandmarkCatalogForPlane(plane: AnatomicalPlane) {
  return getLandmarksForPlane(plane)
}

export function countPendingConfirmations(collection: StructuredLandmarkCollection): number {
  return collection.autoProposals.length
}
