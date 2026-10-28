/** Soglie configurabili per classificazione quantitativa posturale. */

export type PosturalSeverityBand = 'normal' | 'lieve' | 'moderata' | 'marcata'

export interface DegreeThresholds {
  normalMax: number
  lieveMax: number
  moderataMax: number
}

export interface ShiftThresholdsCm {
  normalMax: number
  lieveMax: number
  moderataMax: number
}

export interface PosturalThresholdConfig {
  version: string
  tiltDegrees: DegreeThresholds
  rotationDegrees: DegreeThresholds
  bendDegrees: DegreeThresholds
  shiftCm: ShiftThresholdsCm
  /** Soglia minima oltre la quale una misura viene considerata clinicamente rilevante. */
  detectionMinDegrees: number
  detectionMinShiftCm: number
  /** Confidenza minima landmark per anteprima inferenza (include stime). */
  minLandmarkConfidence: number
  /** Confidenza minima per referto definitivo (landmark validati). */
  minClinicalReportConfidence: number
  /** Tetto massimo confidence euristica (automatico stimato). */
  maxHeuristicLandmarkConfidence: number
  /** Confidence assegnata a landmark manuale confermato. */
  manualConfirmedConfidence: number
  /** Confidence assegnata a landmark manuale corretto da proposta auto. */
  manualCorrectedConfidence: number
}

export const POSTURAL_THRESHOLDS: PosturalThresholdConfig = {
  version: 'postural_thresholds_v1',
  tiltDegrees: {
    normalMax: 2,
    lieveMax: 5,
    moderataMax: 10,
  },
  rotationDegrees: {
    normalMax: 2,
    lieveMax: 5,
    moderataMax: 10,
  },
  bendDegrees: {
    normalMax: 2,
    lieveMax: 5,
    moderataMax: 10,
  },
  shiftCm: {
    normalMax: 0.5,
    lieveMax: 1.5,
    moderataMax: 3,
  },
  detectionMinDegrees: 1,
  detectionMinShiftCm: 0.3,
  minLandmarkConfidence: 0.35,
  minClinicalReportConfidence: 0.75,
  maxHeuristicLandmarkConfidence: 0.62,
  manualConfirmedConfidence: 1,
  manualCorrectedConfidence: 0.95,
}

export function classifyDegreeSeverity(
  absDegrees: number,
  thresholds: DegreeThresholds = POSTURAL_THRESHOLDS.tiltDegrees,
): PosturalSeverityBand {
  if (absDegrees <= thresholds.normalMax) return 'normal'
  if (absDegrees <= thresholds.lieveMax) return 'lieve'
  if (absDegrees <= thresholds.moderataMax) return 'moderata'
  return 'marcata'
}

export function classifyShiftSeverityCm(
  absCm: number,
  thresholds: ShiftThresholdsCm = POSTURAL_THRESHOLDS.shiftCm,
): PosturalSeverityBand {
  if (absCm <= thresholds.normalMax) return 'normal'
  if (absCm <= thresholds.lieveMax) return 'lieve'
  if (absCm <= thresholds.moderataMax) return 'moderata'
  return 'marcata'
}
