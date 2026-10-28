import { PLANE_CLINICAL_CONFIGS } from '@/data/planes'
import {
  LEGACY_ALTERATION_LABELS,
  resolveAlterationId,
} from '@/data/alterationAliases'
import type { AnatomicalPlane, PosturalAlteration } from '@/types'

/** Alterazioni per piano — derivate da planes.ts */
export const POSTURAL_ALTERATIONS: PosturalAlteration[] = Object.values(
  PLANE_CLINICAL_CONFIGS,
).flatMap((config) =>
  config.alterations.map((a) => ({
    id: a.id,
    label: a.label,
    plane: config.plane,
    suggestedDescriptors: a.suggestedDescriptors,
    autoHint: a.autoHint,
    district: a.district,
    parentType: a.parentType,
    allowedDirections: a.allowedDirections,
  })),
)

export function getAlterationsForPlane(plane: AnatomicalPlane): PosturalAlteration[] {
  return POSTURAL_ALTERATIONS.filter((a) => a.plane === plane)
}

export function getAlterationLabel(id: string): string {
  const resolved = resolveAlterationId(id)
  const found = POSTURAL_ALTERATIONS.find((a) => a.id === resolved)
  if (found) return found.label
  return LEGACY_ALTERATION_LABELS[id] ?? id
}

export const SAGITTAL_ALTERATION_IDS = POSTURAL_ALTERATIONS.filter(
  (a) => a.plane === 'sagittale_destro',
).map((a) => a.id)

/** Alterazioni raggruppate per parentType (es. deviazione_rachidea). */
export function getAlterationsByParentType(
  plane: AnatomicalPlane,
  parentType: string,
): PosturalAlteration[] {
  return getAlterationsForPlane(plane).filter((a) => a.parentType === parentType)
}
