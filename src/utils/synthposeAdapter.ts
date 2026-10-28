import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import { SYNTHPOSE_KEYPOINT_NAMES, SYNTHPOSE_LANDMARK_MAPPING, SYNTHPOSE_MODEL } from '@/data/synthposeLandmarkMapping'
import type { AnatomicalPlane, PlacedLandmark, StructuredLandmarkCollection } from '@/types'
import { confirmProposalById, dedupeLandmarkCollection, isLandmarkInClinicalBucket, getDisplayLandmarks, type LandmarkEditorDisplayMode } from './landmarkCollection'

export interface SynthposeKeypoint {
  index: number
  name: string
  xPx: number
  yPx: number
  xNormalized: number
  yNormalized: number
  confidence: number
}
export interface SynthposeResult {
  model: typeof SYNTHPOSE_MODEL
  modelVersion: string
  plane: AnatomicalPlane
  imageWidth: number
  imageHeight: number
  device: 'mps' | 'cpu'
  thresholds: { minimum: number; high: number }
  keypoints: SynthposeKeypoint[]
}
export type SynthposeBoundingBox = [xPx: number, yPx: number, widthPx: number, heightPx: number]

export function parseSynthposeResult(raw: unknown, plane: AnatomicalPlane): SynthposeResult {
  const r = raw as SynthposeResult
  if (!r || r.model !== SYNTHPOSE_MODEL || r.plane !== plane || typeof r.modelVersion !== 'string' || !['mps', 'cpu'].includes(r.device) ||
    !Number.isFinite(r.imageWidth) || !Number.isFinite(r.imageHeight) || r.imageWidth <= 0 || r.imageHeight <= 0 ||
    !r.thresholds || !Number.isFinite(r.thresholds.minimum) || !Number.isFinite(r.thresholds.high) ||
    r.thresholds.minimum < 0 || r.thresholds.high > 1 || r.thresholds.minimum > r.thresholds.high ||
    !Array.isArray(r.keypoints) || r.keypoints.length !== 52) throw new Error('Risposta SynthPose incompatibile.')
  const ids = new Set<number>()
  for (const k of r.keypoints) {
    if (!k || !Number.isInteger(k.index) || k.index < 0 || k.index >= 52 || k.name !== SYNTHPOSE_KEYPOINT_NAMES[k.index] || ids.has(k.index) ||
      ![k.xPx, k.yPx, k.xNormalized, k.yNormalized, k.confidence].every(Number.isFinite) || k.confidence < 0 || k.confidence > 1 ||
      Math.abs(k.xNormalized - k.xPx / r.imageWidth) > 1e-5 || Math.abs(k.yNormalized - k.yPx / r.imageHeight) > 1e-5) throw new Error('Keypoint SynthPose non validi.')
    ids.add(k.index)
  }
  return r
}

export function synthposeToAutoProposals(result: SynthposeResult, plane: AnatomicalPlane): PlacedLandmark[] {
  const checked = parseSynthposeResult(result, plane)
  const catalog = getLandmarksForPlane(plane)
  return SYNTHPOSE_LANDMARK_MAPPING.filter(m => m.plane === plane && m.mappingType !== 'manual_only').flatMap(m => {
    const point = checked.keypoints.find(k => k.name === m.synthposeKeypoint)!
    const target = catalog.find(l => l.id === m.clinicalLandmarkId)
    if (!target || point.confidence < checked.thresholds.minimum || point.xNormalized < 0 || point.xNormalized > 1 || point.yNormalized < 0 || point.yNormalized > 1) return []
    // Mapping minima define reliability, not whether a medium-confidence candidate can be reviewed.
    const high = Math.max(m.minimumConfidence, checked.thresholds.high)
    return [{
      ...target, id: crypto.randomUUID(), landmarkId: target.id, position: { x: point.xNormalized, y: point.yNormalized },
      confidence: point.confidence, autoPosition: { x: point.xNormalized, y: point.yNormalized },
      detectionSource: 'automatic', validationState: 'automatico_stimato', needsConfirmation: true,
      notes: m.notes,
      aiProposal: { model: checked.model, modelVersion: checked.modelVersion, keypoint: point.name,
        mappingType: m.mappingType, rawConfidence: point.confidence, minimumConfidence: high,
        reportEligibleByDefault: m.reportEligibleByDefault,
        bulkEligible: m.mappingType === 'direct' && point.confidence >= high },
    } satisfies PlacedLandmark]
  })
}

/** Merge against the latest editor state, preserving existing clinical points and other proposal engines. */
export function mergeSynthposeProposals(collection: StructuredLandmarkCollection, incoming: PlacedLandmark[]): StructuredLandmarkCollection {
  const protectedProposals = new Set(collection.autoProposals.filter(p => p.aiProposal?.model !== SYNTHPOSE_MODEL).map(p => p.landmarkId))
  return dedupeLandmarkCollection({ ...collection, autoProposals: [
    ...collection.autoProposals.filter(p => p.aiProposal?.model !== SYNTHPOSE_MODEL),
    ...incoming.filter(p => p.aiProposal?.model === SYNTHPOSE_MODEL && !isLandmarkInClinicalBucket(p.landmarkId, collection) && !protectedProposals.has(p.landmarkId)),
  ] })
}

export function acceptSynthposeProposal(collection: StructuredLandmarkCollection, id: string): StructuredLandmarkCollection {
  const proposal = collection.autoProposals.find(p => p.id === id && p.aiProposal)
  if (!proposal || isLandmarkInClinicalBucket(proposal.landmarkId, collection)) return collection
  return confirmProposalById(collection, id)
}

export function acceptReliableSynthposeProposals(collection: StructuredLandmarkCollection): StructuredLandmarkCollection {
  return collection.autoProposals.filter(p => p.aiProposal?.mappingType === 'direct' && p.aiProposal.bulkEligible && p.aiProposal.rawConfidence >= p.aiProposal.minimumConfidence)
    .reduce((state, p) => acceptSynthposeProposal(state, p.id), collection)
}


export function getSynthposeDisplayLandmarks(collection: StructuredLandmarkCollection, mode: LandmarkEditorDisplayMode, showAi: boolean): PlacedLandmark[] {
  const items = [
    ...getDisplayLandmarks(collection, mode).filter(l => !l.aiProposal),
    ...collection.confirmed.filter(l => l.aiProposal),
    ...collection.manual.filter(l => l.aiProposal),
    ...(showAi ? collection.autoProposals.filter(l => l.aiProposal) : []),
  ]
  return [...new Map(items.map(l => [l.id, l])).values()]
}
