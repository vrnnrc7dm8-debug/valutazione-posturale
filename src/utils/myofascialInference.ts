import {
  MYOFASCIAL_CLINICAL_DATABASE,
  resolveLinesForOperator,
  type ClinicalObservationPlane,
  type FunctionalMovementOperator,
} from '@/data/myofascialLines'
import type { AnatomicalPlane, PlacedLandmark, Point2D } from '@/types'
import type {
  ClinicalAxis,
  StructuredPosturalFinding,
  StructuredSeverity,
} from '@/types/landmarks'
import { toObservationPlane } from '@/types/landmarks'
import { classifyShiftSeverityCm, POSTURAL_THRESHOLDS } from '@/config/posturalThresholds'
import {
  type ResolvedCalibration,
  normalizedDistanceToCm,
  resolveCalibration,
} from '@/utils/calibration'
import {
  clinicalHorizontalTilt,
  computeLimbRotationOffset,
  computeRelativeShift,
  computeRelativeTilt,
  midpoint,
  passesConfidenceThreshold,
  passesDegreeDetection,
  passesShiftDetection,
  sagittalAlignment,
  type SegmentLine,
} from '@/utils/landmarkGeometry'
import {
  computePreliminaryReasons,
  formatPreliminaryReasons,
} from '@/utils/findingEligibility'
import {
  getEffectiveConfidence,
  resolveValidationState,
} from '@/utils/landmarkValidation'
import {
  getAllLandmarks,
  getClinicalLandmarks,
  normalizeLandmarkCollection,
} from '@/utils/landmarkCollection'
import { sortPosturalFindings } from '@/utils/posturalFormatting'
import { inferFrontAnteriorUpperLimb } from '@/utils/frontalUpperLimbAnalysis'

export interface InferMyofascialOptions {
  calibration?: ResolvedCalibration
  subjectHeightCm?: number
  gravityLineX?: number
  collection?: import('@/types').StructuredLandmarkCollection
}

type LandmarkEntry = {
  position: Point2D
  confidence: number
  validationState: ReturnType<typeof resolveValidationState>
}

type LandmarkMap = Map<string, LandmarkEntry>

function findLm(map: LandmarkMap, ...ids: string[]) {
  for (const id of ids) {
    const hit = map.get(id)
    if (hit) return hit
  }
  return undefined
}

function avgConf(entries: LandmarkEntry[]): number {
  if (entries.length === 0) return 0
  return entries.reduce((s, e) => s + e.confidence, 0) / entries.length
}

function buildLandmarkMap(landmarks: PlacedLandmark[]): LandmarkMap {
  const map: LandmarkMap = new Map()
  for (const lm of landmarks) {
    const id = lm.landmarkId ?? (lm as { type?: string }).type ?? ''
    if (!id || !lm.position) continue
    map.set(id, {
      position: lm.position,
      confidence: getEffectiveConfidence(lm),
      validationState: resolveValidationState(lm),
    })
  }
  return map
}

function elevatedSideFromTilt(left: Point2D, right: Point2D): 'dx' | 'sx' {
  return left.y < right.y - 0.0005 ? 'dx' : 'sx'
}

function resolveRelatedLines(
  observationPlane: ClinicalObservationPlane,
  operator: FunctionalMovementOperator,
  side?: 'dx' | 'sx',
): { lines: string[]; muscles: string[] } {
  const profiles = resolveLinesForOperator(observationPlane, operator, side)
  return {
    lines: profiles.map((p) => p.name),
    muscles: [...new Set(profiles.flatMap((p) => p.muscles))].slice(0, 6),
  }
}

function buildInterpretation(
  segment: string,
  operator: string,
  directionLabel: string,
  valueLabel: string,
  lines: string[],
  muscles: string[],
  referenceMode: 'absolute' | 'relative',
  category?: string,
): string {
  const linePart =
    lines.length > 0
      ? `Compatibile con ${lines.length > 1 ? 'linee' : 'linea'} ${lines.slice(0, 2).join(' e/o ')}`
      : 'Correlazione miofasciale da confermare'
  const musclePart =
    muscles.length > 0
      ? `; possibile coinvolgimento di ${muscles.slice(0, 4).join(', ')}`
      : ''
  const refLabel =
    referenceMode === 'absolute'
      ? 'alterazione assoluta rispetto all\'orizzontale/verticale'
      : 'alterazione relativa rispetto al segmento adiacente'
  const cat = category ? ` (${category})` : ''
  return `${segment}: ${operator} ${directionLabel} ${valueLabel}${cat}. ${refLabel}. ${linePart}${musclePart}.`
}

function pushFinding(
  findings: StructuredPosturalFinding[],
  landmarks: PlacedLandmark[],
  calibration: ResolvedCalibration,
  collection: import('@/types').StructuredLandmarkCollection | undefined,
  partial: Omit<
    StructuredPosturalFinding,
    'relatedMyofascialLines' | 'relatedMuscles' | 'interpretation' | 'reportEligible' | 'preliminaryReasons'
  > & { side?: 'dx' | 'sx' },
): void {
  if (partial.severity === 'normal') return
  if (partial.operator === 'shift' && partial.unit !== 'cm' && partial.unit !== 'px') return

  const preliminaryReasons = computePreliminaryReasons(partial.landmarksUsed, landmarks, {
    operator: partial.operator,
    unit: partial.unit,
    calibration,
    collection,
  })
  const eligible = preliminaryReasons.length === 0
  const operatorForLines: FunctionalMovementOperator =
    partial.operator === 'alignment' ? 'tilt' : partial.operator
  const { lines, muscles } = resolveRelatedLines(
    partial.plane,
    operatorForLines,
    partial.side,
  )
  const valueLabel =
    partial.unit === 'deg'
      ? `${partial.value.toFixed(1)}°`
      : partial.unit === 'cm'
        ? `${partial.value.toFixed(1)} cm`
        : `${partial.value.toFixed(1)}% imm.`

  findings.push({
    ...partial,
    reportEligible: eligible,
    preliminaryReasons: eligible ? undefined : formatPreliminaryReasons(preliminaryReasons),
    relatedMyofascialLines: lines,
    relatedMuscles: muscles,
    interpretation: buildInterpretation(
      partial.segment,
      partial.operator,
      partial.direction,
      valueLabel,
      lines,
      muscles,
      partial.referenceMode,
      partial.clinicalCategory,
    ),
    warnings: eligible
      ? partial.warnings
      : [
          ...(partial.warnings ?? []),
          ...(formatPreliminaryReasons(preliminaryReasons).slice(0, 2)),
        ],
  })
}

function pushShiftFinding(
  findings: StructuredPosturalFinding[],
  landmarks: PlacedLandmark[],
  calibration: ResolvedCalibration,
  collection: import('@/types').StructuredLandmarkCollection | undefined,
  partial: Omit<
    StructuredPosturalFinding,
    | 'relatedMyofascialLines'
    | 'relatedMuscles'
    | 'interpretation'
    | 'value'
    | 'unit'
    | 'reportEligible'
    | 'preliminaryReasons'
  > & {
    normalizedDistance: number
    side?: 'dx' | 'sx'
  },
): void {
  const cmResult = normalizedDistanceToCm(partial.normalizedDistance, calibration)

  if (cmResult.cm !== undefined && passesShiftDetection(cmResult.cm, 'cm')) {
    pushFinding(findings, landmarks, calibration, collection, {
      ...partial,
      value: cmResult.cm,
      unit: 'cm',
      severity: classifyShiftSeverityCm(cmResult.cm) as StructuredSeverity,
      warnings: cmResult.warning ? [cmResult.warning] : partial.warnings,
    })
    return
  }

  const absNorm = Math.abs(partial.normalizedDistance)
  if (absNorm < POSTURAL_THRESHOLDS.detectionMinShiftCm / 100) return

  const canPreview =
    passesConfidenceThreshold(
      partial.confidence,
    ) &&
    partial.landmarksUsed.some((id) => {
      const lm = landmarks.find((l) => l.landmarkId === id)
      return lm && resolveValidationState(lm) !== 'automatico_stimato'
    })

  if (!canPreview && !passesConfidenceThreshold(partial.confidence)) return

  pushFinding(findings, landmarks, calibration, collection, {
    ...partial,
    value: absNorm * 100,
    unit: 'px',
    severity: 'lieve',
    warnings: [
      ...(partial.warnings ?? []),
      cmResult.warning ?? 'Shift in cm non disponibile senza calibrazione scala.',
    ],
  })
}

function inferFrontAnterior(
  anatomicalPlane: AnatomicalPlane,
  map: LandmarkMap,
  landmarks: PlacedLandmark[],
  options: InferMyofascialOptions,
): StructuredPosturalFinding[] {
  const findings: StructuredPosturalFinding[] = []
  const obsPlane: ClinicalObservationPlane = 'front_anterior'
  const calibration = options.calibration!
  const collection = options.collection

  const acrD = findLm(map, 'acromion_dx')
  const acrS = findLm(map, 'acromion_sx')
  const siasD = findLm(map, 'sias_dx')
  const siasS = findLm(map, 'sias_sx')
  const vertex = findLm(map, 'vertex')
  const glabella = findLm(map, 'glabella')
  const rotD = findLm(map, 'rotula_dx')
  const rotS = findLm(map, 'rotula_sx')
  const trcD = findLm(map, 'trocantere_dx')
  const trcS = findLm(map, 'trocantere_sx')
  const malD = findLm(map, 'malleolo_laterale_dx', 'malleolo_mediale_dx')
  const malS = findLm(map, 'malleolo_laterale_sx', 'malleolo_mediale_sx')
  const manubrio = findLm(map, 'manubrio')
  const tragoD = findLm(map, 'trago_dx')
  const tragoS = findLm(map, 'trago_sx')
  const sternalLine = findLm(map, 'linea_sternale')
  const ombelico = findLm(map, 'ombelico')
  const arcoD = findLm(map, 'arco_costale_dx')
  const arcoS = findLm(map, 'arco_costale_sx')

  const gravityX = options.gravityLineX ?? 0.5

  // --- Tier 1: cingolo scapolare / bacino ---

  if (acrD && acrS) {
    const tilt = clinicalHorizontalTilt(acrD.position, acrS.position)
    const conf = avgConf([acrD, acrS])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(tilt.degrees)) {
      const side = elevatedSideFromTilt(acrD.position, acrS.position)
      pushFinding(findings, landmarks, calibration, collection, {
        id: `fa_tilt_acromion_abs_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment: 'cingolo scapolare',
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'orizzontale fotografica',
        landmarksUsed: ['acromion_dx', 'acromion_sx'],
        value: tilt.degrees,
        unit: 'deg',
        direction: side,
        severity: tilt.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'rapporto_cranio_torace',
        side,
      })
    }
  }

  if (siasD && siasS) {
    const tilt = clinicalHorizontalTilt(siasD.position, siasS.position)
    const conf = avgConf([siasD, siasS])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(tilt.degrees)) {
      const side = elevatedSideFromTilt(siasD.position, siasS.position)
      pushFinding(findings, landmarks, calibration, collection, {
        id: `fa_tilt_pelvis_abs_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment: 'bacino',
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'orizzontale fotografica',
        landmarksUsed: ['sias_dx', 'sias_sx'],
        value: tilt.degrees,
        unit: 'deg',
        direction: side,
        severity: tilt.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'asse_pelvico',
        side,
      })
    }
  }

  if (acrD && acrS && siasD && siasS) {
    const shoulderSeg: SegmentLine = { from: acrD.position, to: acrS.position }
    const pelvisSeg: SegmentLine = { from: siasD.position, to: siasS.position }
    const relTilt = computeRelativeTilt(shoulderSeg, pelvisSeg)
    const conf = avgConf([acrD, acrS, siasD, siasS])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(relTilt.degrees)) {
      pushFinding(findings, landmarks, calibration, collection, {
        id: 'fa_tilt_scapulo_pelvic_rel',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'cingolo scapolare rispetto al bacino',
        operator: 'tilt',
        referenceMode: 'relative',
        referenceTarget: 'asse bisiliaco (SIAS dx/sx)',
        landmarksUsed: ['acromion_dx', 'acromion_sx', 'sias_dx', 'sias_sx'],
        value: relTilt.degrees,
        unit: 'deg',
        direction: relTilt.signedDegrees > 0 ? 'dx' : 'sx',
        severity: relTilt.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_torace_bacino',
        side: relTilt.signedDegrees > 0 ? 'dx' : 'sx',
      })
    }
  }

  // --- Asse cefalico: trago ---

  if (tragoD && tragoS) {
    const tilt = clinicalHorizontalTilt(tragoD.position, tragoS.position)
    const conf = avgConf([tragoD, tragoS])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(tilt.degrees)) {
      const side = elevatedSideFromTilt(tragoD.position, tragoS.position)
      pushFinding(findings, landmarks, calibration, collection, {
        id: `fa_tilt_trago_abs_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment: 'tilt cefalico (trago dx/sx)',
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'orizzontale fotografica',
        landmarksUsed: ['trago_dx', 'trago_sx'],
        value: tilt.degrees,
        unit: 'deg',
        direction: side,
        severity: tilt.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'asse_cefalico',
        side,
      })
    }
  }

  for (const [side, trago, ref] of [
    ['dx', tragoD, acrD] as const,
    ['sx', tragoS, acrS] as const,
  ]) {
    if (trago && ref) {
      const tilt = clinicalHorizontalTilt(trago.position, ref.position)
      const conf = avgConf([trago, ref])
      if (passesConfidenceThreshold(conf) && passesDegreeDetection(tilt.degrees)) {
        pushFinding(findings, landmarks, calibration, collection, {
          id: `fa_tilt_trago_acromion_${side}`,
          plane: obsPlane,
          anatomicalPlane,
          segment: `trago ${side} rispetto ad acromion omolatero`,
          operator: 'tilt',
          referenceMode: 'relative',
          referenceTarget: `acromion ${side}`,
          landmarksUsed: [`trago_${side}`, `acromion_${side}`],
          value: tilt.degrees,
          unit: 'deg',
          direction: side,
          severity: tilt.severity as StructuredSeverity,
          confidence: conf,
          clinicalCategory: 'alterazione relativa',
          clinicalAxis: 'rapporto_cranio_torace',
          side,
        })
      }
    }
  }

  // --- Shift testa vs linea sternale ---

  const headRef = vertex ?? (tragoD && tragoS ? { position: midpoint(tragoD.position, tragoS.position), confidence: avgConf([tragoD, tragoS]), validationState: tragoD.validationState } : undefined)
  const sternalRef = sternalLine ?? manubrio

  if (headRef && sternalRef) {
    const conf = avgConf([headRef, sternalRef])
    if (passesConfidenceThreshold(conf)) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_head_sternal_line',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'shift testa rispetto alla linea sternale',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'linea mediana dello sterno',
        landmarksUsed: sternalLine
          ? [vertex ? 'vertex' : 'trago_dx', 'linea_sternale'].filter(Boolean) as string[]
          : [vertex ? 'vertex' : 'trago_dx', 'manubrio'],
        normalizedDistance: headRef.position.x - sternalRef.position.x,
        direction: headRef.position.x > sternalRef.position.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_cranio_torace',
        side: headRef.position.x > sternalRef.position.x ? 'dx' : 'sx',
      })
    }
  }

  if (vertex && acrD && acrS) {
    const shoulderMid = midpoint(acrD.position, acrS.position)
    const conf = avgConf([vertex, acrD, acrS])
    if (passesConfidenceThreshold(conf)) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_head_rel_shoulder',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'testa rispetto al cingolo scapolare',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro biacromiale',
        landmarksUsed: ['vertex', 'acromion_dx', 'acromion_sx'],
        normalizedDistance: vertex.position.x - shoulderMid.x,
        direction: vertex.position.x > shoulderMid.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: conf,
        clinicalCategory: 'compenso sovrasegmentario',
        clinicalAxis: 'rapporto_cranio_torace',
      })
    }
  }

  if (glabella && manubrio) {
    const conf = avgConf([glabella, manubrio])
    if (passesConfidenceThreshold(conf)) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_head_sternum',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'capo rispetto allo sterno',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'asse manubrio sternale',
        landmarksUsed: ['glabella', 'manubrio'],
        normalizedDistance: glabella.position.x - manubrio.position.x,
        direction: glabella.position.x > manubrio.position.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_cranio_torace',
      })
    }
  }

  // --- Asse sternale / toraco-addominale ---

  if (manubrio && ombelico) {
    const align = sagittalAlignment(manubrio.position, ombelico.position)
    const conf = avgConf([manubrio, ombelico])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(align.degrees)) {
      pushFinding(findings, landmarks, calibration, collection, {
        id: 'fa_dev_sternum_umbilicus',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'deviazione sterno–ombelico (linea alba)',
        operator: 'bend',
        referenceMode: 'absolute',
        referenceTarget: 'verticale fotografica',
        landmarksUsed: ['manubrio', 'ombelico'],
        value: align.degrees,
        unit: 'deg',
        direction: align.signedDegrees > 0 ? 'lateral' : 'medial',
        severity: align.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'asse_toraco_addominale',
        side: align.signedDegrees > 0 ? 'dx' : 'sx',
      })
    }
  }

  if (sternalLine && ombelico) {
    const align = sagittalAlignment(sternalLine.position, ombelico.position)
    const conf = avgConf([sternalLine, ombelico])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(align.degrees)) {
      pushFinding(findings, landmarks, calibration, collection, {
        id: 'fa_dev_sternal_line_umbilicus',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'deviazione linea sternale–ombelico',
        operator: 'bend',
        referenceMode: 'absolute',
        referenceTarget: 'verticale fotografica',
        landmarksUsed: ['linea_sternale', 'ombelico'],
        value: align.degrees,
        unit: 'deg',
        direction: align.signedDegrees > 0 ? 'lateral' : 'medial',
        severity: align.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'asse_sternale',
        side: align.signedDegrees > 0 ? 'dx' : 'sx',
      })
    }
  }

  // --- Arcate costali ---

  if (arcoD && arcoS) {
    const tilt = clinicalHorizontalTilt(arcoD.position, arcoS.position)
    const conf = avgConf([arcoD, arcoS])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(tilt.degrees)) {
      const side = elevatedSideFromTilt(arcoD.position, arcoS.position)
      pushFinding(findings, landmarks, calibration, collection, {
        id: `fa_tilt_rib_arch_abs_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment: 'asimmetria arcate costali (tilt)',
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'orizzontale fotografica',
        landmarksUsed: ['arco_costale_dx', 'arco_costale_sx'],
        value: tilt.degrees,
        unit: 'deg',
        direction: side,
        severity: tilt.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'asse_toraco_addominale',
        side,
      })
    }

    const heightDiff = Math.abs(arcoD.position.y - arcoS.position.y)
    if (passesConfidenceThreshold(conf)) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_rib_arch_vertical',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'asimmetria arcate costali (altezza)',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'simmetria verticale dx/sx',
        landmarksUsed: ['arco_costale_dx', 'arco_costale_sx'],
        normalizedDistance: heightDiff,
        direction: arcoD.position.y < arcoS.position.y ? 'dx' : 'sx',
        severity: classifyShiftSeverityCm(
          (normalizedDistanceToCm(heightDiff, calibration).cm ?? heightDiff * 100),
        ) as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'asse_toraco_addominale',
        side: arcoD.position.y < arcoS.position.y ? 'dx' : 'sx',
      })
    }
  }

  // --- Rapporti torace–bacino vs SIAS ---

  if (siasD && siasS) {
    const siasMid = midpoint(siasD.position, siasS.position)

    if (sternalLine && passesConfidenceThreshold(avgConf([sternalLine, siasD, siasS]))) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_sternum_vs_sias',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'sterno rispetto al centro SIAS',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro bisiliaco',
        landmarksUsed: ['linea_sternale', 'sias_dx', 'sias_sx'],
        normalizedDistance: sternalLine.position.x - siasMid.x,
        direction: sternalLine.position.x > siasMid.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: avgConf([sternalLine, siasD, siasS]),
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_torace_bacino',
        side: sternalLine.position.x > siasMid.x ? 'dx' : 'sx',
      })
    }

    if (manubrio && !sternalLine && passesConfidenceThreshold(avgConf([manubrio, siasD, siasS]))) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_manubrium_vs_sias',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'manubrio rispetto al centro SIAS',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro bisiliaco',
        landmarksUsed: ['manubrio', 'sias_dx', 'sias_sx'],
        normalizedDistance: manubrio.position.x - siasMid.x,
        direction: manubrio.position.x > siasMid.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: avgConf([manubrio, siasD, siasS]),
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_torace_bacino',
        side: manubrio.position.x > siasMid.x ? 'dx' : 'sx',
      })
    }

    if (arcoD && arcoS && passesConfidenceThreshold(avgConf([arcoD, arcoS, siasD, siasS]))) {
      const ribMid = midpoint(arcoD.position, arcoS.position)
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_rib_vs_sias',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'arcate costali rispetto al centro SIAS',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro bisiliaco',
        landmarksUsed: ['arco_costale_dx', 'arco_costale_sx', 'sias_dx', 'sias_sx'],
        normalizedDistance: ribMid.x - siasMid.x,
        direction: ribMid.x > siasMid.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: avgConf([arcoD, arcoS, siasD, siasS]),
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_torace_bacino',
        side: ribMid.x > siasMid.x ? 'dx' : 'sx',
      })
    }

    if (ombelico && passesConfidenceThreshold(avgConf([ombelico, siasD, siasS]))) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_umbilicus_vs_sias',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'shift ombelico rispetto al centro SIAS',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro bisiliaco',
        landmarksUsed: ['ombelico', 'sias_dx', 'sias_sx'],
        normalizedDistance: ombelico.position.x - siasMid.x,
        direction: ombelico.position.x > siasMid.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: avgConf([ombelico, siasD, siasS]),
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'rapporto_addome_bacino',
        side: ombelico.position.x > siasMid.x ? 'dx' : 'sx',
      })
    }

    if (vertex && passesConfidenceThreshold(avgConf([vertex, siasD, siasS]))) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_head_vs_sias',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'vertex rispetto al centro SIAS (shift globale)',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro bisiliaco',
        landmarksUsed: ['vertex', 'sias_dx', 'sias_sx'],
        normalizedDistance: vertex.position.x - siasMid.x,
        direction: vertex.position.x > siasMid.x ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: avgConf([vertex, siasD, siasS]),
        clinicalCategory: 'compenso sovrasegmentario',
        clinicalAxis: 'rapporto_cranio_torace',
        side: vertex.position.x > siasMid.x ? 'dx' : 'sx',
      })
    }
  }

  // --- Bacino / arto inferiore ---

  if (siasD && siasS && malD && malS) {
    const pelvisMid = midpoint(siasD.position, siasS.position)
    const ankleMid = midpoint(malD.position, malS.position)
    const shift = computeRelativeShift(pelvisMid, ankleMid, calibration)
    const conf = avgConf([siasD, siasS, malD, malS])
    if (passesConfidenceThreshold(conf) && shift.cm !== undefined) {
      const side = shift.normalizedDistance > 0 ? 'dx' : 'sx'
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: `fa_shift_pelvis_base_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment: 'bacino rispetto alla base d\'appoggio',
        operator: 'shift',
        referenceMode: 'relative',
        referenceTarget: 'centro bimallolare',
        landmarksUsed: ['sias_dx', 'sias_sx', 'malleolo_laterale_dx', 'malleolo_laterale_sx'],
        normalizedDistance: shift.normalizedDistance,
        direction: side,
        severity: shift.severity as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'asse_pelvico',
        side,
      })
    }
  }

  if (siasD && siasS) {
    const pelvisMid = midpoint(siasD.position, siasS.position)
    const conf = avgConf([siasD, siasS])
    if (passesConfidenceThreshold(conf)) {
      pushShiftFinding(findings, landmarks, calibration, collection, {
        id: 'fa_shift_pelvis_gravity',
        plane: obsPlane,
        anatomicalPlane,
        segment: 'bacino rispetto al filo a piombo',
        operator: 'shift',
        referenceMode: 'absolute',
        referenceTarget: 'linea verticale gravitazionale',
        landmarksUsed: ['sias_dx', 'sias_sx'],
        normalizedDistance: pelvisMid.x - gravityX,
        direction: pelvisMid.x > gravityX ? 'lateral' : 'medial',
        severity: 'lieve',
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'asse_pelvico',
        side: pelvisMid.x > gravityX ? 'dx' : 'sx',
      })
    }
  }

  for (const [side, rot, mal, trc] of [
    ['dx', rotD, malD, trcD] as const,
    ['sx', rotS, malS, trcS] as const,
  ]) {
    if (rot && mal) {
      const conf = avgConf([rot, mal])
      if (passesConfidenceThreshold(conf)) {
        pushShiftFinding(findings, landmarks, calibration, collection, {
          id: `fa_shift_knee_${side}`,
          plane: obsPlane,
          anatomicalPlane,
          segment: `ginocchio ${side} rispetto alla caviglia`,
          operator: 'shift',
          referenceMode: 'relative',
          referenceTarget: `asse malleolare ${side}`,
          landmarksUsed: [`rotula_${side}`, `malleolo_laterale_${side}`],
          normalizedDistance: rot.position.x - mal.position.x,
          direction: rot.position.x > mal.position.x ? 'lateral' : 'medial',
          severity: 'lieve',
          confidence: conf,
          clinicalCategory: 'alterazione relativa',
          clinicalAxis: 'asse_pelvico',
          side,
        })
      }
    }

    if (trc && rot && mal) {
      const rotOffset = computeLimbRotationOffset(trc.position, rot.position, mal.position)
      const conf = avgConf([trc, rot, mal])
      if (
        passesConfidenceThreshold(conf) &&
        passesDegreeDetection(rotOffset.degrees) &&
        rotOffset.direction !== 'neutro'
      ) {
        pushFinding(findings, landmarks, calibration, collection, {
          id: `fa_rotation_limb_${side}`,
          plane: obsPlane,
          anatomicalPlane,
          segment: `arto inferiore ${side}`,
          operator: 'rotation',
          referenceMode: 'relative',
          referenceTarget: 'asse trocantere–ginocchio–malleolo',
          landmarksUsed: [`trocantere_${side}`, `rotula_${side}`, `malleolo_laterale_${side}`],
          value: rotOffset.degrees,
          unit: 'deg',
          direction: rotOffset.direction === 'medial' ? 'medial' : 'lateral',
          severity: rotOffset.severity as StructuredSeverity,
          confidence: conf,
          clinicalCategory: 'alterazione relativa',
          clinicalAxis: 'asse_pelvico',
          side,
        })
      }
    }
  }

  findings.push(
    ...inferFrontAnteriorUpperLimb(anatomicalPlane, map, landmarks, calibration, collection),
  )

  return sortPosturalFindings(findings)
}

export function inferMyofascialAlterations(
  landmarks: PlacedLandmark[],
  plane: AnatomicalPlane,
  _myofascialDatabase = MYOFASCIAL_CLINICAL_DATABASE,
  options: InferMyofascialOptions = {},
): StructuredPosturalFinding[] {
  const map = buildLandmarkMap(landmarks)
  const calibration =
    options.calibration ??
    resolveCalibration(undefined, landmarks, options.subjectHeightCm)

  if (plane === 'frontale_anteriore') {
    return inferFrontAnterior(plane, map, landmarks, { ...options, calibration })
  }

  return []
}

export function filterReportEligibleFindings(
  findings: StructuredPosturalFinding[],
): StructuredPosturalFinding[] {
  return findings.filter((f) => f.reportEligible !== false)
}

export function filterPreliminaryFindings(
  findings: StructuredPosturalFinding[],
): StructuredPosturalFinding[] {
  return findings.filter((f) => f.reportEligible === false)
}

export function inferMyofascialAlterationsForPhotos(
  photos: Array<{
    plane: AnatomicalPlane
    annotations: {
      landmarks: import('@/types').StructuredLandmarkCollection | PlacedLandmark[]
      overlay?: { gravityLineX?: number }
    }
    calibration?: import('@/types').PhotoCalibration
  }>,
  subjectHeightCm?: number,
  options: { reportEligibleOnly?: boolean } = {},
): StructuredPosturalFinding[] {
  const all: StructuredPosturalFinding[] = []
  for (const photo of photos) {
    const collection = normalizeLandmarkCollection(
      photo.annotations.landmarks,
      photo.plane,
    )
    const landmarksForInference = options.reportEligibleOnly
      ? getClinicalLandmarks(collection)
      : getAllLandmarks(collection)
    const resolved = resolveCalibration(
      photo.calibration,
      landmarksForInference,
      subjectHeightCm,
    )
    all.push(
      ...inferMyofascialAlterations(
        landmarksForInference,
        photo.plane,
        MYOFASCIAL_CLINICAL_DATABASE,
        {
          calibration: resolved,
          subjectHeightCm,
          gravityLineX: photo.annotations.overlay?.gravityLineX,
          collection,
        },
      ),
    )
  }
  if (options.reportEligibleOnly) {
    return filterReportEligibleFindings(all)
  }
  return all
}

export function formatStructuredFindingSummary(f: StructuredPosturalFinding): string {
  const unitLabel = f.unit === 'deg' ? '°' : f.unit === 'cm' ? ' cm' : ' px'
  const refLabel = f.referenceMode === 'absolute' ? 'assoluta' : 'relativa'
  const eligible = f.reportEligible !== false ? 'definitivo' : 'preliminare'
  return `[${toObservationPlane(f.anatomicalPlane)}] ${f.segment} · ${f.operator} ${refLabel} · ${f.value.toFixed(1)}${unitLabel} · ${f.severity} · conf. ${Math.round(f.confidence * 100)}% · ${eligible}`
}

export function groupFindingsByClinicalAxis(
  findings: StructuredPosturalFinding[],
): Partial<Record<ClinicalAxis, StructuredPosturalFinding[]>> {
  const groups: Partial<Record<ClinicalAxis, StructuredPosturalFinding[]>> = {}
  for (const f of findings) {
    if (!f.clinicalAxis) continue
    const list = groups[f.clinicalAxis] ?? []
    list.push(f)
    groups[f.clinicalAxis] = list
  }
  return groups
}
