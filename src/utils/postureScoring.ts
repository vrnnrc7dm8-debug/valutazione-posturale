import type { AnatomicalPlane, PlaneAssessment, Severity } from '@/types'
import { getPlaneConfig } from '@/data/planes'
import type { AutoMeasurement } from '@/utils/biomechanicsEngine'

export interface PlaneClinicalScore {
  plane: AnatomicalPlane
  alterationCount: number
  severityScore: number
  priority: 'bassa' | 'media' | 'alta'
  dominantPattern: string
}

const SEV_POINTS: Record<Severity, number> = {
  lieve: 1,
  moderato: 2,
  severo: 4,
}

const AUTO_SEV_POINTS: Record<AutoMeasurement['severity'], number> = {
  normale: 0,
  lieve: 1,
  moderato: 2,
  severo: 4,
}

export function scorePlaneAssessment(
  assessment: PlaneAssessment,
  autoMeasurements: AutoMeasurement[] = [],
): PlaneClinicalScore {
  const config = getPlaneConfig(assessment.plane)
  let severityScore = assessment.alterations.reduce(
    (sum, a) => sum + SEV_POINTS[a.severity],
    0,
  )
  severityScore += autoMeasurements
    .filter((m) => m.plane === assessment.plane)
    .reduce((sum, m) => sum + AUTO_SEV_POINTS[m.severity], 0)

  const priority =
    severityScore >= 10 ? 'alta' : severityScore >= 5 ? 'media' : 'bassa'

  const topAlteration = assessment.alterations[0]
  const dominantPattern = topAlteration
    ? `${config.shortLabel}: ${config.alterations.find((a) => a.id === topAlteration.alterationId)?.label ?? 'alterazione posturale'}`
    : config.dominantPatternHints[0] ?? config.label

  return {
    plane: assessment.plane,
    alterationCount: assessment.alterations.length,
    severityScore,
    priority,
    dominantPattern,
  }
}

export function globalTherapeuticPriority(
  planeScores: PlaneClinicalScore[],
): 'bassa' | 'media' | 'alta' {
  const max = Math.max(...planeScores.map((p) => p.severityScore), 0)
  if (max >= 12) return 'alta'
  if (max >= 6) return 'media'
  return 'bassa'
}
