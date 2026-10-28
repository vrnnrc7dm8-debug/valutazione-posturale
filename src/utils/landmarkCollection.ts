import type { AnatomicalPlane, PlacedLandmark, StructuredLandmarkCollection } from '@/types'
import { normalizeLandmarks } from '@/utils/landmarkMigration'
import {
  confirmEstimatedLandmark,
  createManualConfirmedLandmark,
  markLandmarkManualCorrection,
  resolveValidationState,
  withValidationState,
} from '@/utils/landmarkValidation'

export type LandmarkEditorDisplayMode = 'manual' | 'semi_automatic' | 'automatic'

export function createEmptyLandmarkCollection(): StructuredLandmarkCollection {
  return { confirmed: [], manual: [], autoProposals: [] }
}

export function isStructuredLandmarkCollection(
  value: unknown,
): value is StructuredLandmarkCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as StructuredLandmarkCollection
  return (
    Array.isArray(v.confirmed) &&
    Array.isArray(v.manual) &&
    Array.isArray(v.autoProposals)
  )
}

/** Migra array flat legacy → struttura separata. */
export function migrateFlatLandmarksToCollection(
  flat: PlacedLandmark[],
): StructuredLandmarkCollection {
  const collection = createEmptyLandmarkCollection()

  for (const lm of flat) {
    const state = resolveValidationState(lm)
    const normalized = withValidationState(lm)

    if (state === 'automatico_stimato') {
      collection.autoProposals.push(normalized)
      continue
    }

    const isPureManual =
      normalized.detectionSource === 'manual' &&
      !normalized.autoPosition &&
      state === 'manuale_confermato'

    if (isPureManual) {
      collection.manual.push(normalized)
    } else {
      collection.confirmed.push(normalized)
    }
  }

  return dedupeLandmarkCollection(collection)
}

export function normalizeLandmarkCollection(
  raw: unknown,
  plane: AnatomicalPlane,
): StructuredLandmarkCollection {
  if (isStructuredLandmarkCollection(raw)) {
    return dedupeLandmarkCollection({
      confirmed: normalizeLandmarks(raw.confirmed, plane),
      manual: normalizeLandmarks(raw.manual, plane),
      autoProposals: normalizeLandmarks(raw.autoProposals, plane),
    })
  }

  if (Array.isArray(raw)) {
    return migrateFlatLandmarksToCollection(normalizeLandmarks(raw, plane))
  }

  return createEmptyLandmarkCollection()
}

function dedupeByLandmarkId(items: PlacedLandmark[]): PlacedLandmark[] {
  const byId = new Map<string, PlacedLandmark>()
  for (const lm of items) {
    byId.set(lm.landmarkId, lm)
  }
  return [...byId.values()]
}

export function dedupeLandmarkCollection(
  collection: StructuredLandmarkCollection,
): StructuredLandmarkCollection {
  const clinicalIds = new Set([
    ...collection.confirmed.map((l) => l.landmarkId),
    ...collection.manual.map((l) => l.landmarkId),
  ])

  return {
    confirmed: dedupeByLandmarkId(collection.confirmed),
    manual: dedupeByLandmarkId(collection.manual),
    autoProposals: dedupeByLandmarkId(
      collection.autoProposals.filter((l) => !clinicalIds.has(l.landmarkId)),
    ),
  }
}

/** Landmark clinici per referto definitivo. */
export function getClinicalLandmarks(
  collection: StructuredLandmarkCollection,
): PlacedLandmark[] {
  return [...collection.confirmed, ...collection.manual]
}

export function getAutoProposals(
  collection: StructuredLandmarkCollection,
): PlacedLandmark[] {
  return collection.autoProposals
}

export function getAllLandmarks(
  collection: StructuredLandmarkCollection,
): PlacedLandmark[] {
  return [
    ...collection.confirmed,
    ...collection.manual,
    ...collection.autoProposals,
  ]
}

export function countLandmarks(collection: StructuredLandmarkCollection): number {
  return getAllLandmarks(collection).length
}

export function isLandmarkInClinicalBucket(
  landmarkId: string,
  collection: StructuredLandmarkCollection,
): boolean {
  return (
    collection.confirmed.some((l) => l.landmarkId === landmarkId) ||
    collection.manual.some((l) => l.landmarkId === landmarkId)
  )
}

/** Landmark visibili in base alla modalità editor. */
export function getDisplayLandmarks(
  collection: StructuredLandmarkCollection,
  mode: LandmarkEditorDisplayMode,
): PlacedLandmark[] {
  const clinical = getClinicalLandmarks(collection)

  switch (mode) {
    case 'manual':
      return clinical
    case 'semi_automatic':
      return [...clinical, ...collection.autoProposals]
    case 'automatic':
      return collection.autoProposals.length > 0 ? collection.autoProposals : clinical
    default:
      return clinical
  }
}

/** Al cambio modalità le proposte non confermate vengono rimosse. */
export function clearAutoProposalsOnModeChange(
  collection: StructuredLandmarkCollection,
): StructuredLandmarkCollection {
  if (collection.autoProposals.length === 0) return collection
  return { ...collection, autoProposals: [] }
}

export function clearAutoProposals(
  collection: StructuredLandmarkCollection,
): StructuredLandmarkCollection {
  return { ...collection, autoProposals: [] }
}

export function resetClinicalLandmarks(
  _collection: StructuredLandmarkCollection,
): StructuredLandmarkCollection {
  return { confirmed: [], manual: [], autoProposals: [] }
}

export function resetLandmarkCollection(
  collection: StructuredLandmarkCollection,
  scope: 'proposals_only' | 'all',
): StructuredLandmarkCollection {
  if (scope === 'proposals_only') {
    return clearAutoProposals(collection)
  }
  return resetClinicalLandmarks(collection)
}

export function addManualLandmark(
  collection: StructuredLandmarkCollection,
  landmark: PlacedLandmark,
): StructuredLandmarkCollection {
  const manual = createManualConfirmedLandmark(landmark)
  return dedupeLandmarkCollection({
    confirmed: collection.confirmed.filter((l) => l.landmarkId !== manual.landmarkId),
    manual: [
      ...collection.manual.filter((l) => l.landmarkId !== manual.landmarkId),
      manual,
    ],
    autoProposals: collection.autoProposals.filter(
      (l) => l.landmarkId !== manual.landmarkId,
    ),
  })
}

export function applyAutoProposals(
  collection: StructuredLandmarkCollection,
  proposals: PlacedLandmark[],
): StructuredLandmarkCollection {
  const clinicalIds = new Set(getClinicalLandmarks(collection).map((l) => l.landmarkId))
  const nextProposals = proposals
    .filter((p) => !clinicalIds.has(p.landmarkId))
    .map((p) =>
      withValidationState({
        ...p,
        validationState: 'automatico_stimato',
        detectionSource: 'automatic',
        needsConfirmation: true,
      }),
    )

  return dedupeLandmarkCollection({
    ...collection,
    autoProposals: dedupeByLandmarkId(nextProposals),
  })
}

export function confirmProposalById(
  collection: StructuredLandmarkCollection,
  id: string,
): StructuredLandmarkCollection {
  const proposal = collection.autoProposals.find((l) => l.id === id)
  if (!proposal) return collection
  if (proposal.aiProposal && isLandmarkInClinicalBucket(proposal.landmarkId, collection)) return collection

  const confirmed = confirmEstimatedLandmark(proposal)
  return dedupeLandmarkCollection({
    confirmed: [
      ...collection.confirmed.filter((l) => l.landmarkId !== confirmed.landmarkId),
      confirmed,
    ],
    manual: collection.manual.filter((l) => l.landmarkId !== confirmed.landmarkId),
    autoProposals: collection.autoProposals.filter((l) => l.id !== id),
  })
}

export function confirmAllProposals(
  collection: StructuredLandmarkCollection,
): StructuredLandmarkCollection {
  let next = collection
  for (const proposal of [...collection.autoProposals]) {
    if (proposal.aiProposal && (proposal.aiProposal.mappingType !== 'direct' || !proposal.aiProposal.bulkEligible || proposal.aiProposal.rawConfidence < proposal.aiProposal.minimumConfidence)) continue
    next = confirmProposalById(next, proposal.id)
  }
  return next
}

export function updateLandmarkPosition(
  collection: StructuredLandmarkCollection,
  id: string,
  position: PlacedLandmark['position'],
): StructuredLandmarkCollection {
  const updateList = (list: PlacedLandmark[]) =>
    list.map((l) => (l.id === id ? markLandmarkManualCorrection(l, position) : l))

  if (collection.autoProposals.some((l) => l.id === id)) {
    return { ...collection, autoProposals: updateList(collection.autoProposals) }
  }
  if (collection.confirmed.some((l) => l.id === id)) {
    return { ...collection, confirmed: updateList(collection.confirmed) }
  }
  if (collection.manual.some((l) => l.id === id)) {
    return { ...collection, manual: updateList(collection.manual) }
  }
  return collection
}

export function removeLandmarkById(
  collection: StructuredLandmarkCollection,
  id: string,
): StructuredLandmarkCollection {
  return {
    confirmed: collection.confirmed.filter((l) => l.id !== id),
    manual: collection.manual.filter((l) => l.id !== id),
    autoProposals: collection.autoProposals.filter((l) => l.id !== id),
  }
}

export function findLandmarkById(
  collection: StructuredLandmarkCollection,
  id: string,
): PlacedLandmark | undefined {
  return getAllLandmarks(collection).find((l) => l.id === id)
}

export function countAutoProposals(collection: StructuredLandmarkCollection): number {
  return collection.autoProposals.length
}
