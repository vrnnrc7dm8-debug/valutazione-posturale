import type { AlterationSelection, Assessment, PlaneAssessment } from '@/types'
import {
  CURRENT_ASSESSMENT_SCHEMA_VERSION,
  LEGACY_ASSESSMENT_SCHEMA_VERSION,
  type AssessmentSchemaVersion,
} from '@/types/clinical'
import { resolveAlterationId } from '@/data/alterationAliases'

type StoredAlterationSelection = Omit<AlterationSelection, 'instanceId'> & {
  instanceId?: string
}

type StoredPlaneAssessment = Omit<PlaneAssessment, 'alterations'> & {
  alterations: StoredAlterationSelection[]
}

type StoredAssessment = Omit<Assessment, 'schemaVersion' | 'planeAssessments'> & {
  schemaVersion?: AssessmentSchemaVersion
  planeAssessments?: StoredPlaneAssessment[]
}

export function detectSchemaVersion(
  assessment: Partial<StoredAssessment>,
): AssessmentSchemaVersion {
  if (assessment.schemaVersion === CURRENT_ASSESSMENT_SCHEMA_VERSION) {
    return CURRENT_ASSESSMENT_SCHEMA_VERSION
  }
  if (assessment.schemaVersion === LEGACY_ASSESSMENT_SCHEMA_VERSION) {
    return LEGACY_ASSESSMENT_SCHEMA_VERSION
  }
  return LEGACY_ASSESSMENT_SCHEMA_VERSION
}

function ensureInstanceId(
  alteration: StoredAlterationSelection,
): AlterationSelection {
  if (alteration.instanceId) {
    return alteration as AlterationSelection
  }
  return {
    ...alteration,
    instanceId: crypto.randomUUID(),
  }
}

function migrateAlterationTaxonomy(
  planeAssessment: StoredPlaneAssessment,
): PlaneAssessment {
  return {
    plane: planeAssessment.plane,
    alterations: (planeAssessment.alterations ?? []).map((alteration) => {
      const withId = ensureInstanceId(alteration)
      const resolvedId = resolveAlterationId(withId.alterationId)
      if (resolvedId === withId.alterationId) {
        return withId
      }
      return { ...withId, alterationId: resolvedId }
    }),
  }
}

function ensurePlaneAssessmentInstanceIds(
  planeAssessment: StoredPlaneAssessment,
): PlaneAssessment {
  return migrateAlterationTaxonomy(planeAssessment)
}

/** Garantisce schema v2 e instanceId su ogni alterazione (idempotente). */
export function ensureV2Integrity(assessment: Assessment): Assessment {
  return {
    ...assessment,
    schemaVersion: CURRENT_ASSESSMENT_SCHEMA_VERSION,
    planeAssessments: assessment.planeAssessments.map((pa) =>
      ensurePlaneAssessmentInstanceIds(pa),
    ),
  }
}

export function migrateV1ToV2(assessment: Assessment): Assessment {
  return ensureV2Integrity(assessment)
}

export function migrateAssessment(assessment: Assessment): Assessment {
  const version = detectSchemaVersion(assessment)
  if (version === LEGACY_ASSESSMENT_SCHEMA_VERSION) {
    return migrateV1ToV2(assessment)
  }
  return ensureV2Integrity(assessment)
}
