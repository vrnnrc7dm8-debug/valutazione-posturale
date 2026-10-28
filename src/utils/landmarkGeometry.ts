import {
  classifyDegreeSeverity,
  classifyShiftSeverityCm,
  POSTURAL_THRESHOLDS,
  type PosturalSeverityBand,
} from '@/config/posturalThresholds'
import type { PhotoCalibration, Point2D } from '@/types'
import { normalizeLineTiltDegrees, segmentTiltDegrees } from '@/utils/angleCalculations'
import type { ResolvedCalibration } from '@/utils/calibration'
import { normalizedDistanceToCm, resolveCalibration } from '@/utils/calibration'

export interface SegmentLine {
  from: Point2D
  to: Point2D
  label?: string
}

export interface CalibrationConversion {
  value: number
  unit: 'cm' | 'px'
  status: PhotoCalibration['status']
  warning?: string
}

export interface TiltResult {
  degrees: number
  signedDegrees: number
  severity: PosturalSeverityBand
}

export interface ShiftResult {
  normalizedDistance: number
  cm?: number
  severity: PosturalSeverityBand
  calibrationStatus: PhotoCalibration['status']
  warning?: string
}

/** Angolo in gradi tra tre punti (a–b–c) al vertice b. */
export function angleBetweenPoints(a: Point2D, b: Point2D, c: Point2D): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const mag1 = Math.hypot(v1x, v1y)
  const mag2 = Math.hypot(v2x, v2y)
  if (mag1 < 1e-8 || mag2 < 1e-8) return 0
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Inclinazione angolare di un segmento rispetto all'orizzontale fotografica. */
export function horizontalTilt(a: Point2D, b: Point2D): TiltResult {
  const signed = segmentTiltDegrees(a, b)
  const degrees = Math.abs(signed)
  return {
    degrees,
    signedDegrees: signed,
    severity: classifyDegreeSeverity(degrees, POSTURAL_THRESHOLDS.tiltDegrees),
  }
}

/** Deviazione angolare da orizzontale (0–90°), indipendente dal verso del segmento. */
export function clinicalHorizontalTilt(a: Point2D, b: Point2D): TiltResult & {
  elevatedEndpoint: 'a' | 'b' | 'level'
} {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const degrees = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI)
  let elevatedEndpoint: 'a' | 'b' | 'level' = 'level'
  if (Math.abs(dy) > 0.0005) {
    elevatedEndpoint = dy < 0 ? 'a' : 'b'
  }
  return {
    degrees,
    signedDegrees: dy < 0 ? degrees : -degrees,
    severity: classifyDegreeSeverity(degrees, POSTURAL_THRESHOLDS.tiltDegrees),
    elevatedEndpoint,
  }
}

/** Tilt assoluto tra due landmark omologhi (linea dx–sx). */
export function computeAbsoluteTilt(pointA: Point2D, pointB: Point2D): TiltResult {
  return clinicalHorizontalTilt(pointA, pointB)
}

/** Differenza angolare in gradi tra due segmenti. */
export function computeRelativeTilt(segmentA: SegmentLine, segmentB: SegmentLine): TiltResult {
  const tiltA = segmentTiltDegrees(segmentA.from, segmentA.to)
  const tiltB = segmentTiltDegrees(segmentB.from, segmentB.to)
  const diff = normalizeLineTiltDegrees(tiltA - tiltB)
  const degrees = Math.abs(diff)
  return {
    degrees,
    signedDegrees: diff,
    severity: classifyDegreeSeverity(degrees, POSTURAL_THRESHOLDS.tiltDegrees),
  }
}

/** Offset angolare stimato del ginocchio rispetto all'asse anca–caviglia (rotazione grossolana). */
export function computeLimbRotationOffset(
  hip: Point2D,
  knee: Point2D,
  ankle: Point2D,
): TiltResult & { direction: 'medial' | 'lateral' | 'neutro' } {
  const dx = ankle.x - hip.x
  const dy = ankle.y - hip.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-8) {
    return { degrees: 0, signedDegrees: 0, severity: 'normal', direction: 'neutro' }
  }
  const t = ((knee.x - hip.x) * dx + (knee.y - hip.y) * dy) / lenSq
  const projX = hip.x + t * dx
  const lateralOffset = knee.x - projX
  const axisLen = Math.sqrt(lenSq)
  const degrees = Math.atan2(Math.abs(lateralOffset), axisLen) * (180 / Math.PI)
  return {
    degrees,
    signedDegrees: lateralOffset > 0 ? degrees : -degrees,
    severity: classifyDegreeSeverity(degrees, POSTURAL_THRESHOLDS.rotationDegrees),
    direction:
      Math.abs(lateralOffset) < 0.002
        ? 'neutro'
        : lateralOffset > 0
          ? 'lateral'
          : 'medial',
  }
}

/** Shift orizzontale in unità normalizzate (positivo = verso destra immagine). */
export function computeHorizontalShiftNorm(point: Point2D, referenceX: number): number {
  return point.x - referenceX
}

/** Shift verticale in unità normalizzate (positivo = verso il basso immagine). */
export function computeVerticalShiftNorm(point: Point2D, referenceY: number): number {
  return point.y - referenceY
}

/** Traslazione orizzontale tra due punti. */
export function segmentTranslation(a: Point2D, b: Point2D): number {
  return b.x - a.x
}

/** Distanza verticale normalizzata (shift verticale relativo). */
export function verticalShift(a: Point2D, b: Point2D): number {
  return b.y - a.y
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function resolveCmPerNormalizedUnit(
  calibration?: PhotoCalibration,
  subjectHeightCm?: number,
): PhotoCalibration {
  if (calibration?.cmPerNormalizedUnit && calibration.status === 'calibrated') {
    return calibration
  }
  if (calibration?.mode === 'manual_scale' && calibration.cmPerNormalizedUnit) {
    return { ...calibration, status: 'calibrated' }
  }
  const height = calibration?.subjectHeightCm ?? subjectHeightCm
  if (height && height > 0) {
    return {
      ...calibration,
      mode: calibration?.mode ?? 'subject_height',
      subjectHeightCm: height,
      cmPerNormalizedUnit: height,
      status: 'estimated',
    }
  }
  return {
    ...(calibration ?? { mode: 'none' }),
    status: 'unavailable',
  }
}

/** Converte distanza normalizzata in cm se calibrazione disponibile. */
export function pixelsToCm(
  normalizedDistance: number,
  calibration?: PhotoCalibration | ResolvedCalibration,
  subjectHeightCm?: number,
  landmarks?: import('@/types').PlacedLandmark[],
): CalibrationConversion {
  const resolved: ResolvedCalibration =
    calibration && 'label' in calibration
      ? calibration
      : resolveCalibration(calibration, landmarks ?? [], subjectHeightCm)

  const converted = normalizedDistanceToCm(normalizedDistance, resolved)

  if (converted.cm !== undefined) {
    return {
      value: converted.cm,
      unit: 'cm',
      status: resolved.status,
    }
  }

  return {
    value: Math.abs(normalizedDistance),
    unit: 'px',
    status: 'unavailable',
    warning: converted.warning,
  }
}

/** Distanza da linea verticale di riferimento (x costante). */
export function computeAbsoluteShift(
  point: Point2D,
  referenceX: number,
  calibration?: PhotoCalibration,
  subjectHeightCm?: number,
): ShiftResult {
  const normalizedDistance = point.x - referenceX
  const converted = pixelsToCm(normalizedDistance, calibration, subjectHeightCm)
  const severity =
    converted.unit === 'cm'
      ? classifyShiftSeverityCm(converted.value)
      : classifyShiftSeverityCm(converted.value * 100)
  return {
    normalizedDistance,
    cm: converted.unit === 'cm' ? converted.value : undefined,
    severity,
    calibrationStatus: converted.status,
    warning: converted.warning,
  }
}

/** Traslazione laterale tra centri segmentari (frontale). */
export function computeRelativeShift(
  segmentCenterA: Point2D,
  segmentCenterB: Point2D,
  calibration?: PhotoCalibration | ResolvedCalibration,
  subjectHeightCm?: number,
): ShiftResult {
  const dx = segmentCenterA.x - segmentCenterB.x
  const converted = pixelsToCm(dx, calibration, subjectHeightCm)
  const severity =
    converted.unit === 'cm'
      ? classifyShiftSeverityCm(converted.value)
      : classifyShiftSeverityCm(converted.value * 100)
  return {
    normalizedDistance: dx,
    cm: converted.unit === 'cm' ? converted.value : undefined,
    severity,
    calibrationStatus: converted.status,
    warning: converted.warning,
  }
}

/** Anteriorizzazione/posteriorizzazione sagittale (shift lungo x). */
export function computeSagittalForwardShift(
  point: Point2D,
  verticalReference: Point2D,
  calibration?: PhotoCalibration,
  subjectHeightCm?: number,
): ShiftResult {
  return computeAbsoluteShift(point, verticalReference.x, calibration, subjectHeightCm)
}

/** Rotazione stimata da coppie bilaterali (frontale): differenza angolare tra segmenti omologhi. */
export function computeSegmentRotation(
  bilateralPairA: SegmentLine,
  bilateralPairB: SegmentLine,
): TiltResult {
  return computeRelativeTilt(bilateralPairA, bilateralPairB)
}

/** Rotazione da asimmetria frontale tra due coppie di punti. */
export function rotationFromBilateralPoints(
  leftA: Point2D,
  leftB: Point2D,
  rightA: Point2D,
  rightB: Point2D,
): TiltResult {
  const leftSeg: SegmentLine = { from: leftA, to: leftB }
  const rightSeg: SegmentLine = { from: rightA, to: rightB }
  return computeSegmentRotation(leftSeg, rightSeg)
}

/** Angolo tra due segmenti consecutivi (bend). */
export function computeInterSegmentAngle(
  segmentA: SegmentLine,
  segmentB: SegmentLine,
): TiltResult {
  const sharedVertex = segmentA.to
  const degrees = angleBetweenPoints(segmentA.from, sharedVertex, segmentB.to)
  return {
    degrees,
    signedDegrees: degrees,
    severity: classifyDegreeSeverity(degrees, POSTURAL_THRESHOLDS.bendDegrees),
  }
}

/** Allineamento sagittale: deviazione da verticale in gradi. */
export function sagittalAlignment(from: Point2D, to: Point2D): TiltResult {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.hypot(dx, dy) < 1e-8) {
    return { degrees: 0, signedDegrees: 0, severity: 'normal' }
  }
  const degrees = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI)
  return {
    degrees,
    signedDegrees: dx > 0 ? degrees : -degrees,
    severity: classifyDegreeSeverity(degrees, POSTURAL_THRESHOLDS.tiltDegrees),
  }
}

export function classifySeverity(
  value: number,
  unit: 'deg' | 'cm',
): PosturalSeverityBand {
  if (unit === 'cm') {
    return classifyShiftSeverityCm(Math.abs(value))
  }
  return classifyDegreeSeverity(Math.abs(value))
}

export function averageConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0
  return confidences.reduce((a, b) => a + b, 0) / confidences.length
}

export function passesConfidenceThreshold(confidence: number): boolean {
  return confidence >= POSTURAL_THRESHOLDS.minLandmarkConfidence
}

export function passesDegreeDetection(value: number): boolean {
  return Math.abs(value) >= POSTURAL_THRESHOLDS.detectionMinDegrees
}

export function passesShiftDetection(value: number, unit: 'cm' | 'px'): boolean {
  if (unit === 'cm') {
    return Math.abs(value) >= POSTURAL_THRESHOLDS.detectionMinShiftCm
  }
  return Math.abs(value) >= POSTURAL_THRESHOLDS.detectionMinShiftCm / 100
}
