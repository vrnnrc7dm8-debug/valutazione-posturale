import { getLandmarkCatalogEntry } from '@/data/anatomicalLandmarks'
import type { AnatomicalPlane, PlacedLandmark } from '@/types'
import { migrateLegacyLandmarkFields } from '@/utils/landmarkValidation'

const LEGACY_MAP: Record<string, string> = {
  acromion: 'acromion_dx',
  asis: 'sias_dx',
  psis: 'psis_dx',
  trocantere: 'trocantere_dx',
  ginocchio: 'rotula_dx',
  malleolo: 'malleolo_mediale_dx',
  processo_mastoideo: 'occipite',
}

export function normalizePlacedLandmark(
  raw: Partial<PlacedLandmark> & { type?: string; position: { x: number; y: number } },
  defaultPlane: AnatomicalPlane,
): PlacedLandmark {
  const catalogId =
    raw.landmarkId ??
    (raw.type ? LEGACY_MAP[raw.type] ?? raw.type : 'vertex')
  const entry = getLandmarkCatalogEntry(catalogId)
  const plane = raw.plane ?? entry?.plane ?? defaultPlane

  return migrateLegacyLandmarkFields({
    id: raw.id ?? crypto.randomUUID(),
    landmarkId: catalogId,
    label: raw.label ?? entry?.label ?? catalogId,
    shortLabel: raw.shortLabel ?? entry?.shortLabel ?? catalogId.slice(0, 3),
    position: raw.position,
    plane,
    side: raw.side ?? entry?.side ?? 'linea_mediana',
    category: raw.category ?? entry?.category ?? 'midline',
    confidence: raw.confidence ?? entry?.defaultConfidence ?? 1,
    notes: raw.notes,
    autoPosition: raw.autoPosition,
    detectionSource: raw.detectionSource,
    needsConfirmation: raw.needsConfirmation,
    validationState: raw.validationState,
  })
}

export function normalizeLandmarks(
  landmarks: Array<Partial<PlacedLandmark> & { type?: string }>,
  plane: AnatomicalPlane,
): PlacedLandmark[] {
  return landmarks
    .filter((l) => l.position)
    .map((l) =>
      normalizePlacedLandmark(
        l as PlacedLandmark & { position: { x: number; y: number } },
        plane,
      ),
    )
}
