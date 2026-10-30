import { computePlanePriority } from './planePriority'
import type { PatternRecognitionResult } from '@/types/patternRecognition'
import type { AnatomicalPlane, PlaneAssessment } from '@/types'
import { getPlaneConfig } from '@/data/planes'
import type { AutoMeasurement } from '@/utils/biomechanicsEngine'

export interface PlaneClinicalScore {
  plane: AnatomicalPlane
  alterationCount: number
  severityScore: number
  priority: 'bassa' | 'media' | 'alta'
  dominantPattern: string
}

export function scorePlaneAssessment(
  assessment: PlaneAssessment,
  autoMeasurements: AutoMeasurement[] = [],
  recognition?: PatternRecognitionResult,
): PlaneClinicalScore {
  const config = getPlaneConfig(assessment.plane)
  const computed = computePlanePriority(assessment, autoMeasurements, recognition)
  const severityScore = computed.score
  const priority = computed.priority

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
  if (max >= 10) return 'alta'
  if (max >= 5) return 'media'
  return 'bassa'
}
