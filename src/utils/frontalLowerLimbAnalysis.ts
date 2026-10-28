import { CLINICAL_THRESHOLDS, degreesQuantitative } from '@/data/clinicalThresholds'
import type {
  AnatomicalPlane,
  ClinicalDirection,
  PlacedLandmark,
  Point2D,
  QuantitativeUnit,
} from '@/types'
import { angleAtVertexDegrees } from '@/utils/angleCalculations'
import { autoSeverityFromDegrees, severityFromNormalizedMagnitude } from '@/utils/severityFromMeasurement'
import { midpoint } from '@/utils/vectorAnalysis'

export interface FrontalLowerLimbAutoMeasurement {
  id: string
  label: string
  value: string
  severity: 'normale' | 'lieve' | 'moderato' | 'severo'
  plane: AnatomicalPlane
  suggestion?: string
  numericValue?: number
  unit?: QuantitativeUnit
}

export type LowerLimbRotationDirection =
  | 'intrarotazione'
  | 'extrarotazione'
  | 'neutra'
  | 'non valutabile'

export type ValgusVarusLabel = 'neutro' | 'valgismo' | 'varismo' | 'non valutabile'

export interface FrontalLowerLimbComputedMetric {
  id: string
  title: string
  value: string
  detail?: string
  evaluable: boolean
  side: 'destro' | 'sinistro'
  kind: 'asse_femoro_tibiale' | 'rotazione_arto_inferiore'
  direction?: ClinicalDirection
  angleDegrees?: number
}

export interface FrontalLowerLimbSideResult {
  side: 'destro' | 'sinistro'
  evaluable: boolean
  hip?: Point2D
  knee?: Point2D
  ankle?: Point2D
  femoroTibialAngleDegrees?: number
  alignment: ValgusVarusLabel
  alignmentDeviation?: number
  rotation: LowerLimbRotationDirection
  rotationDeviation?: number
}

export interface FrontalLowerLimbAnalysis {
  destro: FrontalLowerLimbSideResult
  sinistro: FrontalLowerLimbSideResult
}

const VALGUS_VARUS_DETECTION = 0.01
const ROTATION_MILD = 0.008

const FRONTAL_LOWER_LIMB_AUTO_IDS = new Set([
  'asse_femoro_tibiale_destro',
  'asse_femoro_tibiale_sinistro',
  'rotazione_arto_inferiore_destro',
  'rotazione_arto_inferiore_sinistro',
])

export function isFrontalLowerLimbAutoMeasurementId(id: string): boolean {
  return FRONTAL_LOWER_LIMB_AUTO_IDS.has(id)
}

function findLm(
  landmarks: PlacedLandmark[],
  ...ids: string[]
): PlacedLandmark | undefined {
  for (const id of ids) {
    const hit = landmarks.find(
      (l) => l.landmarkId === id || (l as { type?: string }).type === id,
    )
    if (hit) return hit
  }
  return undefined
}

function pos(lm: PlacedLandmark): Point2D {
  return lm.position
}

function xOnLineAtY(a: Point2D, b: Point2D, y: number): number {
  if (Math.abs(b.y - a.y) < 1e-8) {
    return (a.x + b.x) / 2
  }
  const t = (y - a.y) / (b.y - a.y)
  return a.x + t * (b.x - a.x)
}

/** Deviazione verso mediale (+) o laterale (−) rispetto alla linea anca–caviglia. */
function signedMedialDeviation(
  side: 'destro' | 'sinistro',
  point: Point2D,
  hip: Point2D,
  ankle: Point2D,
): number {
  const expectedX = xOnLineAtY(hip, ankle, point.y)
  const raw = point.x - expectedX
  // Frontale: arto destro medial → verso centro immagine (+x); sinistro medial → verso centro (−x).
  return side === 'destro' ? raw : -raw
}

function classifyValgusVarus(
  deviation: number,
): ValgusVarusLabel {
  if (Math.abs(deviation) < VALGUS_VARUS_DETECTION) {
    return 'neutro'
  }
  return deviation > 0 ? 'valgismo' : 'varismo'
}

function classifyRotationDirection(deviation: number): LowerLimbRotationDirection {
  if (Math.abs(deviation) < ROTATION_MILD) return 'neutra'
  return deviation > 0 ? 'intrarotazione' : 'extrarotazione'
}

function alignmentToDirection(alignment: ValgusVarusLabel): ClinicalDirection | undefined {
  if (alignment === 'valgismo') return 'valgo'
  if (alignment === 'varismo') return 'varo'
  return undefined
}

function rotationToDirection(
  rotation: LowerLimbRotationDirection,
): ClinicalDirection | undefined {
  if (rotation === 'intrarotazione' || rotation === 'extrarotazione') {
    return rotation
  }
  return undefined
}

function resolveAnkle(side: 'destro' | 'sinistro', landmarks: PlacedLandmark[]): Point2D | undefined {
  const suffix = side === 'destro' ? 'dx' : 'sx'
  const med = findLm(landmarks, `malleolo_mediale_${suffix}`)
  const lat = findLm(landmarks, `malleolo_laterale_${suffix}`)
  if (med && lat) return midpoint(pos(med), pos(lat))
  if (med) return pos(med)
  if (lat) return pos(lat)
  return undefined
}

function resolveHip(side: 'destro' | 'sinistro', landmarks: PlacedLandmark[]): Point2D | undefined {
  const suffix = side === 'destro' ? 'dx' : 'sx'
  const trochanter = findLm(landmarks, `trocantere_${suffix}`)
  if (trochanter) return pos(trochanter)
  const sias = findLm(landmarks, `sias_${suffix}`)
  return sias ? pos(sias) : undefined
}

function resolveKnee(side: 'destro' | 'sinistro', landmarks: PlacedLandmark[]): Point2D | undefined {
  const suffix = side === 'destro' ? 'dx' : 'sx'
  const patella = findLm(landmarks, `rotula_${suffix}`)
  return patella ? pos(patella) : undefined
}

function resolveFootReference(
  side: 'destro' | 'sinistro',
  landmarks: PlacedLandmark[],
): Point2D | undefined {
  const suffix = side === 'destro' ? 'dx' : 'sx'
  const toe = findLm(
    landmarks,
    `secondo_dito_${suffix}`,
    `alluce_${suffix}`,
    `arco_plantare_${suffix}`,
  )
  return toe ? pos(toe) : undefined
}

function analyzeSide(
  side: 'destro' | 'sinistro',
  landmarks: PlacedLandmark[],
): FrontalLowerLimbSideResult {
  const hip = resolveHip(side, landmarks)
  const knee = resolveKnee(side, landmarks)
  const ankle = resolveAnkle(side, landmarks)

  if (!hip || !knee || !ankle) {
    return {
      side,
      evaluable: false,
      alignment: 'non valutabile',
      rotation: 'non valutabile',
    }
  }

  const femoroTibialAngleDegrees = angleAtVertexDegrees(hip, knee, ankle)
  const alignmentDeviation = signedMedialDeviation(side, knee, hip, ankle)
  const alignment = classifyValgusVarus(alignmentDeviation)

  const foot = resolveFootReference(side, landmarks)
  const distal = foot ?? ankle
  const kneeDeviation = signedMedialDeviation(side, knee, hip, ankle)
  const distalDeviation = signedMedialDeviation(side, distal, hip, ankle)
  const rotationDeviation = foot
    ? distalDeviation * 0.65 + kneeDeviation * 0.35
    : kneeDeviation

  return {
    side,
    evaluable: true,
    hip,
    knee,
    ankle,
    femoroTibialAngleDegrees,
    alignment,
    alignmentDeviation,
    rotation: classifyRotationDirection(rotationDeviation),
    rotationDeviation,
  }
}

export function analyzeFrontalLowerLimb(
  landmarks: PlacedLandmark[],
): FrontalLowerLimbAnalysis {
  return {
    destro: analyzeSide('destro', landmarks),
    sinistro: analyzeSide('sinistro', landmarks),
  }
}

function formatAxisValue(result: FrontalLowerLimbSideResult): string {
  if (!result.evaluable) return 'non valutabile'
  const angle = result.femoroTibialAngleDegrees?.toFixed(1) ?? '—'
  if (result.alignment === 'neutro') {
    return `${angle}° · allineamento neutro`
  }
  if (result.alignment === 'valgismo') {
    return `${angle}° · valgo`
  }
  if (result.alignment === 'varismo') {
    return `${angle}° · varo`
  }
  return `${angle}°`
}

function buildComputedMetric(
  side: 'destro' | 'sinistro',
  kind: FrontalLowerLimbComputedMetric['kind'],
  result: FrontalLowerLimbSideResult,
): FrontalLowerLimbComputedMetric {
  const sideTag = sideLabel(side)

  if (kind === 'asse_femoro_tibiale') {
    return {
      id: `asse_femoro_tibiale_${side}`,
      title: `Asse femoro-tibiale ${sideTag}`,
      value: formatAxisValue(result),
      detail: result.evaluable
        ? 'Asse femorale anca→ginocchio · asse tibiale ginocchio→caviglia · varo/valgo vs linea anca–caviglia'
        : 'Servono trocantere/SIAS, rotula e malleoli.',
      evaluable: result.evaluable,
      side,
      kind,
      direction: result.evaluable ? alignmentToDirection(result.alignment) : undefined,
      angleDegrees: result.femoroTibialAngleDegrees,
    }
  }

  return {
    id: `rotazione_arto_inferiore_${side}`,
    title: `Rotazione arto inferiore ${sideTag}`,
    value: rotationText(result),
    detail: result.evaluable
      ? 'Rotula/ginocchio e piede/caviglia rispetto all’asse anca–caviglia'
      : 'Servono trocantere/SIAS, rotula e malleoli.',
    evaluable: result.evaluable,
    side,
    kind,
    direction: result.evaluable ? rotationToDirection(result.rotation) : undefined,
  }
}

export function getFrontalLowerLimbComputedMetrics(
  landmarks: PlacedLandmark[],
): FrontalLowerLimbComputedMetric[] {
  const analysis = analyzeFrontalLowerLimb(landmarks)
  const sides: Array<'destro' | 'sinistro'> = ['destro', 'sinistro']

  return sides.flatMap((side) => {
    const result = analysis[side]
    return [
      buildComputedMetric(side, 'asse_femoro_tibiale', result),
      buildComputedMetric(side, 'rotazione_arto_inferiore', result),
    ]
  })
}

function sideLabel(side: 'destro' | 'sinistro'): string {
  return side === 'destro' ? 'DX' : 'SX'
}

function rotationText(result: FrontalLowerLimbSideResult): string {
  if (!result.evaluable) return 'non valutabile'
  return result.rotation
}

export function frontalLowerLimbToAutoMeasurements(
  analysis: FrontalLowerLimbAnalysis,
): FrontalLowerLimbAutoMeasurement[] {
  const sides: Array<'destro' | 'sinistro'> = ['destro', 'sinistro']

  return sides.flatMap((side) => {
    const limb = analysis[side]
    const metrics = [
      buildComputedMetric(side, 'asse_femoro_tibiale', limb),
      buildComputedMetric(side, 'rotazione_arto_inferiore', limb),
    ]

    return metrics.map((metric) => {
      if (!metric.evaluable) {
        return {
          id: metric.id,
          label: metric.title,
          value: metric.value,
          severity: 'normale' as const,
          plane: 'frontale_anteriore' as const,
          suggestion: metric.detail,
        }
      }

      if (metric.kind === 'asse_femoro_tibiale') {
        const angleDeviation = Math.abs(180 - (metric.angleDegrees ?? 180))
        const angleQ = degreesQuantitative(metric.angleDegrees ?? 0)
        const limbResult = analysis[side]
        return {
          id: metric.id,
          label: metric.title,
          value: metric.value,
          severity: autoSeverityFromDegrees(angleDeviation, {
            normale: 4,
            lieve: 6,
            moderato: 10,
            severo: 15,
          }),
          plane: 'frontale_anteriore',
          numericValue: angleQ.value,
          unit: angleQ.unit,
          suggestion:
            limbResult.alignment === 'valgismo'
              ? 'Ginocchio medialeizzato rispetto alla linea anca–caviglia (valgo).'
              : limbResult.alignment === 'varismo'
                ? 'Ginocchio lateralizzato rispetto alla linea anca–caviglia (varo).'
                : metric.detail,
        }
      }

      const limbResult = analysis[side]
      return {
        id: metric.id,
        label: metric.title,
        value: metric.value,
        severity:
          limbResult.rotation === 'neutra'
            ? 'normale'
            : severityFromNormalizedMagnitude(
                Math.abs(limbResult.rotationDeviation ?? 0),
                CLINICAL_THRESHOLDS.rotazione_arto_frontale,
              ),
        plane: 'frontale_anteriore',
        numericValue: limbResult.rotationDeviation,
        unit: 'normalizzato',
        suggestion:
          limbResult.rotation === 'intrarotazione'
            ? 'Segmento distale orientato medialmente rispetto all’asse anca–caviglia.'
            : limbResult.rotation === 'extrarotazione'
              ? 'Segmento distale orientato lateralmente rispetto all’asse anca–caviglia.'
              : metric.detail,
      }
    })
  })
}

export function frontalLowerLimbAxes(
  analysis: FrontalLowerLimbAnalysis,
): Array<{
  id: string
  label: string
  from: Point2D
  to: Point2D
  color: string
}> {
  const axes: Array<{
    id: string
    label: string
    from: Point2D
    to: Point2D
    color: string
  }> = []

  for (const side of ['destro', 'sinistro'] as const) {
    const limb = analysis[side]
    if (!limb.evaluable || !limb.hip || !limb.knee || !limb.ankle) continue
    const tag = side === 'destro' ? 'dx' : 'sx'
    axes.push({
      id: `femoral_${tag}`,
      label: `Asse femorale ${tag.toUpperCase()}`,
      from: limb.hip,
      to: limb.knee,
      color: side === 'destro' ? '#2563eb' : '#1d4ed8',
    })
    axes.push({
      id: `tibial_${tag}`,
      label: `Asse tibiale ${tag.toUpperCase()}`,
      from: limb.knee,
      to: limb.ankle,
      color: side === 'destro' ? '#16a34a' : '#15803d',
    })
    axes.push({
      id: `hip_ankle_ref_${tag}`,
      label: `Riferimento anca–caviglia ${tag.toUpperCase()}`,
      from: limb.hip,
      to: limb.ankle,
      color: side === 'destro' ? '#94a3b8' : '#64748b',
    })
  }

  return axes
}
