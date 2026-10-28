import { getLandmarkCatalogEntry } from '@/data/anatomicalLandmarks'
import { POSTURAL_THRESHOLDS } from '@/config/posturalThresholds'
import type { AnatomicalPlane, PlacedLandmark, Point2D } from '@/types'
import {
  isClinicallyValidated,
  resolveValidationState,
  type LandmarkValidationState,
} from '@/utils/landmarkValidation'
import { normalizePlacedLandmark } from '@/utils/landmarkMigration'

/** Landmark prioritari tier-1 (frontale anteriore). */
export const FRONT_ANTERIOR_TIER1 = [
  'vertex',
  'acromion_dx',
  'acromion_sx',
  'sias_dx',
  'sias_sx',
  'rotula_dx',
  'rotula_sx',
  'malleolo_laterale_dx',
  'malleolo_laterale_sx',
] as const

/** Landmark clinici tier-2 (torace/testa). */
export const FRONT_ANTERIOR_TIER2 = [
  'trago_dx',
  'trago_sx',
  'linea_sternale',
  'manubrio',
  'arco_costale_dx',
  'arco_costale_sx',
  'ombelico',
] as const

export const FRONT_ANTERIOR_SEMI_AUTO_PRIORITY = [
  ...FRONT_ANTERIOR_TIER1,
  ...FRONT_ANTERIOR_TIER2,
] as const

interface TemplateLandmark {
  id: string
  position: Point2D
  /** Confidence base euristica (0–1). */
  baseConfidence: number
  tier: 1 | 2
}

/** Template antropometrico normalizzato (vista frontale standard). */
const ANTHROPOMETRIC_TEMPLATE: TemplateLandmark[] = [
  { id: 'vertex', position: { x: 0.5, y: 0.06 }, baseConfidence: 0.42, tier: 1 },
  { id: 'trago_dx', position: { x: 0.46, y: 0.11 }, baseConfidence: 0.38, tier: 2 },
  { id: 'trago_sx', position: { x: 0.54, y: 0.11 }, baseConfidence: 0.38, tier: 2 },
  { id: 'linea_sternale', position: { x: 0.5, y: 0.3 }, baseConfidence: 0.4, tier: 2 },
  { id: 'manubrio', position: { x: 0.5, y: 0.26 }, baseConfidence: 0.45, tier: 2 },
  { id: 'arco_costale_dx', position: { x: 0.4, y: 0.32 }, baseConfidence: 0.36, tier: 2 },
  { id: 'arco_costale_sx', position: { x: 0.6, y: 0.32 }, baseConfidence: 0.36, tier: 2 },
  { id: 'ombelico', position: { x: 0.5, y: 0.42 }, baseConfidence: 0.44, tier: 2 },
  { id: 'acromion_dx', position: { x: 0.38, y: 0.22 }, baseConfidence: 0.48, tier: 1 },
  { id: 'acromion_sx', position: { x: 0.62, y: 0.22 }, baseConfidence: 0.48, tier: 1 },
  { id: 'gomito_dx', position: { x: 0.36, y: 0.38 }, baseConfidence: 0.4, tier: 2 },
  { id: 'gomito_sx', position: { x: 0.64, y: 0.38 }, baseConfidence: 0.4, tier: 2 },
  { id: 'stiloide_radiale_dx', position: { x: 0.34, y: 0.52 }, baseConfidence: 0.38, tier: 2 },
  { id: 'stiloide_radiale_sx', position: { x: 0.66, y: 0.52 }, baseConfidence: 0.38, tier: 2 },
  { id: 'dorso_mano_dx', position: { x: 0.33, y: 0.56 }, baseConfidence: 0.36, tier: 2 },
  { id: 'dorso_mano_sx', position: { x: 0.67, y: 0.56 }, baseConfidence: 0.36, tier: 2 },
  { id: 'sias_dx', position: { x: 0.44, y: 0.48 }, baseConfidence: 0.5, tier: 1 },
  { id: 'sias_sx', position: { x: 0.56, y: 0.48 }, baseConfidence: 0.5, tier: 1 },
  { id: 'rotula_dx', position: { x: 0.44, y: 0.68 }, baseConfidence: 0.46, tier: 1 },
  { id: 'rotula_sx', position: { x: 0.56, y: 0.68 }, baseConfidence: 0.46, tier: 1 },
  { id: 'malleolo_laterale_dx', position: { x: 0.43, y: 0.88 }, baseConfidence: 0.44, tier: 1 },
  { id: 'malleolo_laterale_sx', position: { x: 0.57, y: 0.88 }, baseConfidence: 0.44, tier: 1 },
]

const BILATERAL_PAIRS: Array<[string, string]> = [
  ['trago_dx', 'trago_sx'],
  ['acromion_dx', 'acromion_sx'],
  ['gomito_dx', 'gomito_sx'],
  ['stiloide_radiale_dx', 'stiloide_radiale_sx'],
  ['dorso_mano_dx', 'dorso_mano_sx'],
  ['arco_costale_dx', 'arco_costale_sx'],
  ['sias_dx', 'sias_sx'],
  ['rotula_dx', 'rotula_sx'],
  ['malleolo_laterale_dx', 'malleolo_laterale_sx'],
]

export interface DetectionAnchor {
  midlineX: number
  shoulderHalfWidth: number
  pelvisHalfWidth: number
  bodyTopY: number
  bodyBottomY: number
  anchorCount: number
}

export interface ProposedLandmark {
  landmarkId: string
  position: Point2D
  confidence: number
  validationState: LandmarkValidationState
  reason: string
}

function posById(landmarks: PlacedLandmark[], id: string): Point2D | undefined {
  return landmarks.find((l) => l.landmarkId === id && isClinicallyValidated(l))?.position
}

/** Costruisce ancoraggi da landmark già validati clinicamente. */
export function buildDetectionAnchors(landmarks: PlacedLandmark[]): DetectionAnchor {
  const midlineCandidates = [
    posById(landmarks, 'vertex'),
    posById(landmarks, 'linea_sternale'),
    posById(landmarks, 'manubrio'),
    posById(landmarks, 'ombelico'),
  ].filter(Boolean) as Point2D[]

  const midlineX =
    midlineCandidates.length > 0
      ? midlineCandidates.reduce((s, p) => s + p.x, 0) / midlineCandidates.length
      : 0.5

  const acrD = posById(landmarks, 'acromion_dx')
  const acrS = posById(landmarks, 'acromion_sx')
  const shoulderHalfWidth =
    acrD && acrS ? Math.abs(acrS.x - acrD.x) / 2 : 0.12

  const siasD = posById(landmarks, 'sias_dx')
  const siasS = posById(landmarks, 'sias_sx')
  const pelvisHalfWidth =
    siasD && siasS ? Math.abs(siasS.x - siasD.x) / 2 : 0.08

  const topCandidates = [
    posById(landmarks, 'vertex'),
    posById(landmarks, 'trago_dx'),
    posById(landmarks, 'trago_sx'),
  ].filter(Boolean) as Point2D[]
  const bottomCandidates = [
    posById(landmarks, 'malleolo_laterale_dx'),
    posById(landmarks, 'malleolo_laterale_sx'),
  ].filter(Boolean) as Point2D[]

  const bodyTopY =
    topCandidates.length > 0
      ? Math.min(...topCandidates.map((p) => p.y))
      : 0.06
  const bodyBottomY =
    bottomCandidates.length > 0
      ? Math.max(...bottomCandidates.map((p) => p.y))
      : 0.88

  return {
    midlineX,
    shoulderHalfWidth,
    pelvisHalfWidth,
    bodyTopY,
    bodyBottomY,
    anchorCount: landmarks.filter(isClinicallyValidated).length,
  }
}

function adjustToAnchors(
  template: TemplateLandmark,
  anchors: DetectionAnchor,
): Point2D {
  const { position, id } = template
  let { x, y } = position

  const isMidline =
    id === 'vertex' ||
    id === 'linea_sternale' ||
    id === 'manubrio' ||
    id === 'ombelico'

  if (isMidline) {
    x = anchors.midlineX
  } else if (id.endsWith('_dx')) {
    x = anchors.midlineX - (0.5 - position.x)
    if (id.includes('acromion')) x = anchors.midlineX - anchors.shoulderHalfWidth
    if (id.includes('sias') || id.includes('rotula') || id.includes('malleolo')) {
      const hw = id.includes('acromion') ? anchors.shoulderHalfWidth : anchors.pelvisHalfWidth
      x = anchors.midlineX - (id.includes('malleolo') ? hw * 0.95 : hw)
    }
    if (id.includes('trago')) x = anchors.midlineX - 0.04
    if (id.includes('arco_costale')) x = anchors.midlineX - anchors.shoulderHalfWidth * 0.85
  } else if (id.endsWith('_sx')) {
    x = anchors.midlineX + (position.x - 0.5)
    if (id.includes('acromion')) x = anchors.midlineX + anchors.shoulderHalfWidth
    if (id.includes('sias') || id.includes('rotula') || id.includes('malleolo')) {
      const hw = id.includes('acromion') ? anchors.shoulderHalfWidth : anchors.pelvisHalfWidth
      x = anchors.midlineX + (id.includes('malleolo') ? hw * 0.95 : hw)
    }
    if (id.includes('trago')) x = anchors.midlineX + 0.04
    if (id.includes('arco_costale')) x = anchors.midlineX + anchors.shoulderHalfWidth * 0.85
  }

  const span = anchors.bodyBottomY - anchors.bodyTopY
  if (span > 0.3) {
    const relY = (position.y - 0.06) / (0.88 - 0.06)
    y = anchors.bodyTopY + relY * span
  }

  return {
    x: Math.max(0.02, Math.min(0.98, x)),
    y: Math.max(0.02, Math.min(0.98, y)),
  }
}

function symmetryBonus(
  landmarkId: string,
  position: Point2D,
  proposals: ProposedLandmark[],
): number {
  const pair = BILATERAL_PAIRS.find(([a, b]) => a === landmarkId || b === landmarkId)
  if (!pair) return 0

  const [idA, idB] = pair
  const otherId = landmarkId === idA ? idB : idA
  const other = proposals.find((p) => p.landmarkId === otherId)
  if (!other) return 0

  const midX = (position.x + other.position.x) / 2
  const halfWidth = Math.abs(other.position.x - position.x) / 2
  const yDiff = Math.abs(position.y - other.position.y)

  if (halfWidth < 0.02) return 0
  if (yDiff > 0.04) return -0.05
  if (Math.abs(midX - 0.5) > 0.08) return -0.03
  return 0.06
}

function computeProposalConfidence(
  template: TemplateLandmark,
  anchors: DetectionAnchor,
  symmetryAdj: number,
): number {
  let confidence = template.baseConfidence
  if (anchors.anchorCount >= 2) confidence += 0.04
  if (anchors.anchorCount >= 4) confidence += 0.04
  confidence += symmetryAdj
  if (template.tier === 1) confidence += 0.02
  return Math.min(
    POSTURAL_THRESHOLDS.maxHeuristicLandmarkConfidence,
    Math.max(0.28, Math.round(confidence * 100) / 100),
  )
}

export function proposeFrontAnteriorLandmarks(
  existingLandmarks: PlacedLandmark[] = [],
  options: { mode: 'automatic' | 'semi_automatic'; ids?: readonly string[] } = {
    mode: 'semi_automatic',
  },
): { proposals: ProposedLandmark[]; anchors: DetectionAnchor; warnings: string[] } {
  const plane: AnatomicalPlane = 'frontale_anteriore'
  const ids = options.ids ?? FRONT_ANTERIOR_SEMI_AUTO_PRIORITY
  const existingById = new Map(existingLandmarks.map((l) => [l.landmarkId, l]))
  const anchors = buildDetectionAnchors(existingLandmarks)
  const warnings: string[] = [
    'Proposta euristica: validare manualmente i landmark prima del referto definitivo.',
  ]

  const proposals: ProposedLandmark[] = []

  for (const template of ANTHROPOMETRIC_TEMPLATE) {
    if (!ids.includes(template.id as (typeof ids)[number])) continue

    const existing = existingById.get(template.id)
    if (existing && isClinicallyValidated(existing)) {
      continue
    }
    if (
      options.mode === 'semi_automatic' &&
      existing &&
      resolveValidationState(existing) === 'automatico_stimato'
    ) {
      // aggiorna proposta esistente
    } else if (existing && isClinicallyValidated(existing)) {
      continue
    }

    const entry = getLandmarkCatalogEntry(template.id)
    if (!entry || entry.plane !== plane) continue

    const position = adjustToAnchors(template, anchors)
    const symBonus = symmetryBonus(template.id, position, proposals)
    const confidence = computeProposalConfidence(template, anchors, symBonus)

    proposals.push({
      landmarkId: template.id,
      position,
      confidence,
      validationState: 'automatico_stimato',
      reason:
        anchors.anchorCount > 0
          ? `Template adattato a ${anchors.anchorCount} ancoraggio/i validato/i`
          : 'Template antropometrico standard',
    })
  }

  if (proposals.length === 0) {
    warnings.push('Nessuna nuova proposta: landmark già validati o non disponibili.')
  }

  return { proposals, anchors, warnings }
}

export function applyProposalsToLandmarks(
  existingLandmarks: PlacedLandmark[],
  proposals: ProposedLandmark[],
  plane: AnatomicalPlane = 'frontale_anteriore',
): PlacedLandmark[] {
  const byId = new Map(existingLandmarks.map((l) => [l.landmarkId, l]))
  const result = [...existingLandmarks]

  for (const proposal of proposals) {
    const current = byId.get(proposal.landmarkId)
    if (current && isClinicallyValidated(current)) continue

    const placed = normalizePlacedLandmark(
      {
        id: current?.id ?? crypto.randomUUID(),
        landmarkId: proposal.landmarkId,
        position: proposal.position,
        confidence: proposal.confidence,
        autoPosition: { ...proposal.position },
        validationState: 'automatico_stimato',
        detectionSource: 'automatic',
        needsConfirmation: true,
      },
      plane,
    )

    if (current) {
      const idx = result.findIndex((l) => l.landmarkId === proposal.landmarkId)
      if (idx >= 0) result[idx] = placed
    } else {
      result.push(placed)
    }
  }

  return result
}
