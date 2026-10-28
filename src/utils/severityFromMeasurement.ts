import {
  CLINICAL_THRESHOLDS,
  type DetectionThreshold,
  type ThreeLevelThreshold,
} from '@/data/clinicalThresholds'
import type { QuantitativeValue, Severity } from '@/types'

export type AutoMeasurementSeverity = 'normale' | Severity

export function severityFromThreeLevelThreshold(
  magnitude: number,
  threshold: ThreeLevelThreshold,
): AutoMeasurementSeverity {
  const abs = Math.abs(magnitude)
  if (abs < threshold.normale) return 'normale'
  if (abs < threshold.moderato) return 'lieve'
  if (abs < threshold.severo) return 'moderato'
  return 'severo'
}

export function clinicalSeverityFromThreeLevelThreshold(
  magnitude: number,
  threshold: ThreeLevelThreshold,
): Severity {
  const auto = severityFromThreeLevelThreshold(magnitude, threshold)
  return auto === 'normale' ? 'lieve' : auto
}

export function severityFromNormalizedMagnitude(
  magnitude: number,
  threshold: ThreeLevelThreshold = CLINICAL_THRESHOLDS.dislivello_normalizzato,
): AutoMeasurementSeverity {
  return severityFromThreeLevelThreshold(magnitude, threshold)
}

export function severityFromDetectionThreshold(
  magnitude: number,
  threshold: DetectionThreshold,
): Severity {
  return clinicalSeverityFromThreeLevelThreshold(magnitude, threshold)
}

export function passesDetectionThreshold(
  magnitude: number,
  threshold: DetectionThreshold,
): boolean {
  return Math.abs(magnitude) >= threshold.detection
}

export function autoSeverityToClinical(severity: AutoMeasurementSeverity): Severity {
  return severity === 'normale' ? 'lieve' : severity
}

export function clinicalSeverityFromNormalizedMagnitude(magnitude: number): Severity {
  return clinicalSeverityFromThreeLevelThreshold(
    magnitude,
    CLINICAL_THRESHOLDS.dislivello_normalizzato,
  )
}

export function clinicalSeverityFromDegrees(
  degrees: number,
  threshold: ThreeLevelThreshold = CLINICAL_THRESHOLDS.plumb_line_gradi,
): Severity {
  return clinicalSeverityFromThreeLevelThreshold(Math.abs(degrees), threshold)
}

export function autoSeverityFromDegrees(
  degrees: number,
  threshold: ThreeLevelThreshold = CLINICAL_THRESHOLDS.plumb_line_gradi,
): AutoMeasurementSeverity {
  return severityFromThreeLevelThreshold(Math.abs(degrees), threshold)
}

export function mergeQuantitativePatch(
  existing?: QuantitativeValue,
  next?: QuantitativeValue,
): QuantitativeValue | undefined {
  return next ?? existing
}
