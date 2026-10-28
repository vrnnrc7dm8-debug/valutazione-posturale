import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import {
  classifyDegreeSeverity,
  classifyShiftSeverityCm,
  POSTURAL_THRESHOLDS,
} from '@/config/posturalThresholds'
import type { AnatomicalPlane, PlacedLandmark, Point2D, StructuredLandmarkCollection } from '@/types'
import type {
  ObservationPlane,
  QuantitativeDirection,
  StructuredPosturalFinding,
  StructuredSeverity,
} from '@/types/landmarks'
import { toObservationPlane } from '@/types/landmarks'
import type { ResolvedCalibration } from '@/utils/calibration'
import { normalizedDistanceToCm } from '@/utils/calibration'
import { deviationFromVerticalDegrees } from '@/utils/angleCalculations'
import { computePreliminaryReasons, formatPreliminaryReasons } from '@/utils/findingEligibility'
import {
  computeLimbRotationOffset,
  passesConfidenceThreshold,
  passesDegreeDetection,
  passesShiftDetection,
} from '@/utils/landmarkGeometry'
import { getEffectiveConfidence, resolveValidationState } from '@/utils/landmarkValidation'

type SideCode = 'dx' | 'sx'

type LandmarkEntry = {
  position: Point2D
  confidence: number
}

const SIDE_LABEL: Record<SideCode, string> = {
  dx: 'destro',
  sx: 'sinistro',
}

const LM_IDS: Record<
  SideCode,
  { acromion: string; gomito: string; stiloide: string; dorso: string }
> = {
  dx: {
    acromion: 'acromion_dx',
    gomito: 'gomito_dx',
    stiloide: 'stiloide_radiale_dx',
    dorso: 'dorso_mano_dx',
  },
  sx: {
    acromion: 'acromion_sx',
    gomito: 'gomito_sx',
    stiloide: 'stiloide_radiale_sx',
    dorso: 'dorso_mano_sx',
  },
}

const INTRA_LINES: Record<SideCode, string[]> = {
  dx: [
    MYOFASCIAL_LINES.linea_superficiale_frontale_braccio_dx.name,
    MYOFASCIAL_LINES.linea_profonda_frontale_braccio_dx.name,
  ],
  sx: [
    MYOFASCIAL_LINES.linea_superficiale_frontale_braccio_sx.name,
    MYOFASCIAL_LINES.linea_profonda_frontale_braccio_sx.name,
  ],
}

const EXTRA_LINES: Record<SideCode, string[]> = {
  dx: [
    MYOFASCIAL_LINES.linea_superficiale_posteriore_braccio_dx.name,
    MYOFASCIAL_LINES.linea_profonda_posteriore_braccio_dx.name,
  ],
  sx: [
    MYOFASCIAL_LINES.linea_superficiale_posteriore_braccio_sx.name,
    MYOFASCIAL_LINES.linea_profonda_posteriore_braccio_sx.name,
  ],
}

const INTRA_MUSCLES = [
  'pettorale maggiore',
  'pettorale minore',
  'gran dorsale',
  'bicipite brachiale',
  'flessori del carpo',
  'pronatore rotondo',
  'pronatore quadrato',
]

const EXTRA_MUSCLES = [
  'cuffia dei rotatori',
  'estensori del carpo',
  'tricipite brachiale',
  'trapezio',
  'elevatore della scapola',
]

export function isUpperLimbFinding(f: StructuredPosturalFinding): boolean {
  return (
    f.clinicalAxis === 'arto_superiore' ||
    f.clinicalAxis === 'rapporto_braccio_torace' ||
    f.segment.startsWith('arto_superiore')
  )
}

function avgConf(entries: LandmarkEntry[]): number {
  if (entries.length === 0) return 0
  return entries.reduce((s, e) => s + e.confidence, 0) / entries.length
}

function rotationClinicalDirection(
  side: SideCode,
  geoDirection: 'medial' | 'lateral' | 'neutro',
): QuantitativeDirection | null {
  if (geoDirection === 'neutro') return null
  if (side === 'dx') {
    return geoDirection === 'lateral' ? 'intrarotazione' : 'extrarotazione'
  }
  return geoDirection === 'medial' ? 'intrarotazione' : 'extrarotazione'
}

function medializationDirection(
  side: SideCode,
  offsetNorm: number,
): QuantitativeDirection | null {
  if (Math.abs(offsetNorm) < 0.008) return null
  const medial = side === 'dx' ? offsetNorm > 0 : offsetNorm < 0
  return medial ? 'medializzazione' : 'lateralizzazione'
}

function emitFinding(
  findings: StructuredPosturalFinding[],
  landmarks: PlacedLandmark[],
  calibration: ResolvedCalibration,
  collection: StructuredLandmarkCollection | undefined,
  partial: Omit<
    StructuredPosturalFinding,
    'relatedMyofascialLines' | 'relatedMuscles' | 'interpretation' | 'reportEligible' | 'preliminaryReasons'
  > & {
    relatedMyofascialLines?: string[]
    relatedMuscles?: string[]
    interpretation?: string
    reportEligible?: boolean
    preliminaryReasons?: string[]
  },
): void {
  if (partial.severity === 'normal') return

  const computedReasons = computePreliminaryReasons(partial.landmarksUsed, landmarks, {
    operator: partial.operator === 'alignment' ? 'tilt' : partial.operator,
    unit: partial.unit,
    calibration,
    collection,
  })
  const preliminaryReasons =
    partial.preliminaryReasons ??
    (computedReasons.length > 0 ? formatPreliminaryReasons(computedReasons) : undefined)
  const eligible =
    partial.reportEligible === false ? false : computedReasons.length === 0
  const lines = partial.relatedMyofascialLines ?? []
  const muscles = partial.relatedMuscles ?? []

  findings.push({
    ...partial,
    reportEligible: eligible,
    preliminaryReasons: eligible ? undefined : preliminaryReasons,
    relatedMyofascialLines: lines,
    relatedMuscles: muscles,
    interpretation:
      partial.interpretation ??
      `${partial.segment}: ${partial.direction} (${partial.value.toFixed(1)}${partial.unit === 'deg' ? '°' : partial.unit === 'cm' ? ' cm' : ''}).`,
    warnings: eligible
      ? partial.warnings
      : [
          ...(partial.warnings ?? []),
          ...(preliminaryReasons ?? []).slice(0, 2),
        ],
  })
}

function inferSideUpperLimb(
  findings: StructuredPosturalFinding[],
  side: SideCode,
  map: Map<string, LandmarkEntry>,
  landmarks: PlacedLandmark[],
  calibration: ResolvedCalibration,
  collection: StructuredLandmarkCollection | undefined,
  obsPlane: ObservationPlane,
  anatomicalPlane: AnatomicalPlane,
  midlineX: number,
  siasMidX: number,
): void {
  const ids = LM_IDS[side]
  const acr = map.get(ids.acromion)
  const gom = map.get(ids.gomito)
  const sti = map.get(ids.stiloide)
  const dor = map.get(ids.dorso)
  const segment = `arto_superiore_${side}`
  const sideLabel = SIDE_LABEL[side]

  if (acr && gom) {
    const deg = deviationFromVerticalDegrees(acr.position, gom.position)
    const conf = avgConf([acr, gom])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(deg)) {
      emitFinding(findings, landmarks, calibration, collection, {
        id: `fa_ul_tilt_arm_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment,
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'verticale fotografica',
        landmarksUsed: [ids.acromion, ids.gomito],
        value: deg,
        unit: 'deg',
        direction: gom.position.x > acr.position.x ? 'lateral' : 'medial',
        severity: classifyDegreeSeverity(deg, POSTURAL_THRESHOLDS.tiltDegrees) as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'arto_superiore',
        observationType: 'osservazione_diretta',
        interpretation: `Asse braccio ${sideLabel}: inclinazione omero/segmento prossimale ${deg.toFixed(1)}° rispetto alla verticale.`,
      })
    }
  }

  if (gom && sti) {
    const deg = deviationFromVerticalDegrees(gom.position, sti.position)
    const conf = avgConf([gom, sti])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(deg)) {
      emitFinding(findings, landmarks, calibration, collection, {
        id: `fa_ul_tilt_forearm_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment,
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'verticale fotografica',
        landmarksUsed: [ids.gomito, ids.stiloide],
        value: deg,
        unit: 'deg',
        direction: sti.position.x > gom.position.x ? 'lateral' : 'medial',
        severity: classifyDegreeSeverity(deg, POSTURAL_THRESHOLDS.tiltDegrees) as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'arto_superiore',
        observationType: 'osservazione_diretta',
        interpretation: `Asse avambraccio ${sideLabel}: orientamento ${deg.toFixed(1)}° rispetto alla verticale.`,
      })
    }
  }

  if (acr && sti && !gom) {
    const deg = deviationFromVerticalDegrees(acr.position, sti.position)
    const conf = avgConf([acr, sti])
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(deg)) {
      emitFinding(findings, landmarks, calibration, collection, {
        id: `fa_ul_tilt_arm_wrist_global_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment,
        operator: 'tilt',
        referenceMode: 'absolute',
        referenceTarget: 'verticale fotografica (gomito assente)',
        landmarksUsed: [ids.acromion, ids.stiloide],
        value: deg,
        unit: 'deg',
        direction: sti.position.x > acr.position.x ? 'lateral' : 'medial',
        severity: classifyDegreeSeverity(deg, POSTURAL_THRESHOLDS.tiltDegrees) as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione assoluta',
        clinicalAxis: 'arto_superiore',
        observationType: 'osservazione_diretta',
        warnings: ['Misura globale acromion–stiloide: gomito non disponibile.'],
        interpretation: `Asse braccio–polso ${sideLabel} (globale): ${deg.toFixed(1)}° — preferire segmenti con gomito quando disponibile.`,
      })
    }
  }

  if (sti && dor) {
    const deg = deviationFromVerticalDegrees(sti.position, dor.position)
    const conf = avgConf([sti, dor])
    const dir = medializationDirection(side, dor.position.x - sti.position.x)
    if (passesConfidenceThreshold(conf) && passesDegreeDetection(deg)) {
      emitFinding(findings, landmarks, calibration, collection, {
        id: `fa_ul_align_hand_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment,
        operator: 'alignment',
        referenceMode: 'relative',
        referenceTarget: 'stiloide radiale → dorso mano',
        landmarksUsed: [ids.stiloide, ids.dorso],
        value: deg,
        unit: 'deg',
        direction: dir ?? (dor.position.x > sti.position.x ? 'lateral' : 'medial'),
        severity: classifyDegreeSeverity(deg, POSTURAL_THRESHOLDS.rotationDegrees) as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'arto_superiore',
        observationType: 'osservazione_diretta',
        interpretation: `Orientamento mano ${sideLabel}: ${deg.toFixed(1)}°${dir ? `, deviazione ${dir}` : ''}.`,
      })
    }
  }

  const shiftTargets: Array<{
    point: LandmarkEntry
    id: string
    label: string
    refX: number
    refLabel: string
  }> = []

  if (sti) {
    shiftTargets.push(
      { point: sti, id: ids.stiloide, label: 'polso', refX: acr?.position.x ?? midlineX, refLabel: acr ? 'acromion omolaterale' : 'linea mediana' },
      { point: sti, id: ids.stiloide, label: 'polso', refX: midlineX, refLabel: 'linea mediana sternale' },
      { point: sti, id: ids.stiloide, label: 'polso', refX: siasMidX, refLabel: 'centro SIAS' },
    )
  }
  if (dor) {
    shiftTargets.push(
      { point: dor, id: ids.dorso, label: 'dorso mano', refX: acr?.position.x ?? midlineX, refLabel: acr ? 'acromion omolaterale' : 'linea mediana' },
      { point: dor, id: ids.dorso, label: 'dorso mano', refX: midlineX, refLabel: 'linea mediana sternale' },
    )
  }

  const emittedShift = new Set<string>()
  for (const target of shiftTargets) {
    const normShift = target.point.position.x - target.refX
    const dir = medializationDirection(side, normShift)
    if (!dir) continue
    const key = `${target.id}_${target.refLabel}`
    if (emittedShift.has(key)) continue
    emittedShift.add(key)

    const conf = target.point.confidence
    if (!passesConfidenceThreshold(conf)) continue

    const cmResult = normalizedDistanceToCm(Math.abs(normShift), calibration)
    const value = cmResult.cm
    const unit = value !== undefined && passesShiftDetection(value, 'cm') ? 'cm' as const : 'px' as const
    const magnitude = unit === 'cm' ? value! : Math.abs(normShift) * 100

    if (unit === 'cm' && !passesShiftDetection(magnitude, 'cm')) continue
    if (unit === 'px' && magnitude < POSTURAL_THRESHOLDS.detectionMinShiftCm) continue

    emitFinding(findings, landmarks, calibration, collection, {
      id: `fa_ul_shift_${target.label.replace(/\s/g, '_')}_${side}_${target.refLabel.replace(/\s/g, '_')}`,
      plane: obsPlane,
      anatomicalPlane,
      segment,
      operator: 'shift',
      referenceMode: 'relative',
      referenceTarget: target.refLabel,
      landmarksUsed: [target.id],
      value: magnitude,
      unit,
      direction: dir,
      severity:
        unit === 'cm'
          ? (classifyShiftSeverityCm(magnitude) as StructuredSeverity)
          : 'lieve',
      confidence: conf,
      clinicalCategory: 'alterazione relativa',
      clinicalAxis: 'rapporto_braccio_torace',
      observationType: 'osservazione_diretta',
      interpretation: `${target.label.charAt(0).toUpperCase()}${target.label.slice(1)} ${sideLabel} ${dir} rispetto a ${target.refLabel}.`,
      warnings: unit === 'px' ? [cmResult.warning ?? 'Shift in cm non disponibile senza calibrazione.'] : undefined,
    })
  }

  if (acr && gom && sti && dor) {
    const wristRot = computeLimbRotationOffset(acr.position, gom.position, sti.position)
    const handRot = computeLimbRotationOffset(gom.position, sti.position, dor.position)
    const conf = avgConf([acr, gom, sti, dor])

    const wristDir = rotationClinicalDirection(side, wristRot.direction)
    const handDir = rotationClinicalDirection(side, handRot.direction)
    const primaryDir = wristDir ?? handDir
    const primaryDeg = Math.max(wristRot.degrees, handRot.degrees)

    if (
      primaryDir &&
      passesConfidenceThreshold(conf) &&
      passesDegreeDetection(primaryDeg)
    ) {
      const lines = primaryDir === 'intrarotazione' ? INTRA_LINES[side] : EXTRA_LINES[side]
      const muscles = primaryDir === 'intrarotazione' ? INTRA_MUSCLES : EXTRA_MUSCLES

      emitFinding(findings, landmarks, calibration, collection, {
        id: `fa_ul_rotation_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment,
        operator: 'rotation',
        referenceMode: 'relative',
        referenceTarget: 'asse acromion → gomito → stiloide (foto frontale)',
        landmarksUsed: [ids.acromion, ids.gomito, ids.stiloide, ids.dorso],
        value: primaryDeg,
        unit: 'deg',
        direction: primaryDir,
        severity: classifyDegreeSeverity(primaryDeg, POSTURAL_THRESHOLDS.rotationDegrees) as StructuredSeverity,
        confidence: conf,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'arto_superiore',
        observationType: 'stima_biomeccanica',
        warnings: [
          'Stima biomeccanica da foto frontale — non misurazione tridimensionale reale.',
        ],
        interpretation: `Arto superiore ${sideLabel}: tendenza a ${primaryDir} (${primaryDeg.toFixed(1)}°) rispetto all'asse acromion–gomito–stiloide; stima da foto frontale, non rotazione 3D reale.`,
      })

      emitFinding(findings, landmarks, calibration, collection, {
        id: `fa_ul_myofascial_${side}`,
        plane: obsPlane,
        anatomicalPlane,
        segment,
        operator: 'rotation',
        referenceMode: 'relative',
        referenceTarget: 'pattern miofasciale arto superiore',
        landmarksUsed: [ids.acromion, ids.gomito, ids.stiloide, ids.dorso],
        value: primaryDeg,
        unit: 'deg',
        direction: primaryDir,
        severity: classifyDegreeSeverity(primaryDeg, POSTURAL_THRESHOLDS.rotationDegrees) as StructuredSeverity,
        confidence: conf * 0.85,
        clinicalCategory: 'alterazione relativa',
        clinicalAxis: 'arto_superiore',
        observationType: 'inferenza_miofasciale',
        relatedMyofascialLines: lines,
        relatedMuscles: muscles,
        warnings: ['Inferenza funzionale — da correlare con esame clinico.'],
        interpretation: `Pattern compatibile con possibile coinvolgimento di ${lines.join(' e ')} (${sideLabel}), con partecipazione di ${muscles.slice(0, 4).join(', ')}.`,
      })
    }
  } else if (sti && !gom) {
    emitFinding(findings, landmarks, calibration, collection, {
      id: `fa_ul_prelim_styloid_only_${side}`,
      plane: obsPlane,
      anatomicalPlane,
      segment,
      operator: 'shift',
      referenceMode: 'relative',
      referenceTarget: 'posizione stiloide (preliminare)',
      landmarksUsed: [ids.stiloide],
      value: Math.abs(sti.position.x - midlineX) * 100,
      unit: 'px',
      direction: medializationDirection(side, sti.position.x - midlineX) ?? 'medial',
      severity: 'lieve',
      confidence: sti.confidence,
      clinicalCategory: 'alterazione relativa',
      clinicalAxis: 'arto_superiore',
      observationType: 'osservazione_diretta',
      reportEligible: false,
      preliminaryReasons: ['Solo stiloide disponibile — impossibile valutare rotazione arto superiore.'],
      interpretation: `Polso ${sideLabel}: posizione distale stimata; rotazione arto superiore non valutabile senza gomito.`,
    })
  }
}

export function inferFrontAnteriorUpperLimb(
  anatomicalPlane: AnatomicalPlane,
  map: Map<string, LandmarkEntry>,
  landmarks: PlacedLandmark[],
  calibration: ResolvedCalibration,
  collection: StructuredLandmarkCollection | undefined,
): StructuredPosturalFinding[] {
  const findings: StructuredPosturalFinding[] = []
  const obsPlane = toObservationPlane(anatomicalPlane)

  const sternal = map.get('linea_sternale') ?? map.get('manubrio') ?? map.get('ombelico')
  const midlineX = sternal?.position.x ?? 0.5
  const siasD = map.get('sias_dx')
  const siasS = map.get('sias_sx')
  const siasMidX =
    siasD && siasS ? (siasD.position.x + siasS.position.x) / 2 : midlineX

  for (const side of ['dx', 'sx'] as SideCode[]) {
    inferSideUpperLimb(
      findings,
      side,
      map,
      landmarks,
      calibration,
      collection,
      obsPlane,
      anatomicalPlane,
      midlineX,
      siasMidX,
    )
  }

  return findings
}

export function inferFrontAnteriorUpperLimbFromLandmarks(
  anatomicalPlane: AnatomicalPlane,
  landmarks: PlacedLandmark[],
  calibration: ResolvedCalibration,
  collection: StructuredLandmarkCollection | undefined,
): StructuredPosturalFinding[] {
  return inferFrontAnteriorUpperLimb(
    anatomicalPlane,
    buildUpperLimbLandmarkMap(landmarks),
    landmarks,
    calibration,
    collection,
  )
}

export function buildUpperLimbLandmarkMap(
  landmarks: PlacedLandmark[],
): Map<string, LandmarkEntry> {
  const map = new Map<string, LandmarkEntry>()
  for (const lm of landmarks) {
    const id = lm.landmarkId ?? (lm as { type?: string }).type ?? ''
    if (!id || !lm.position) continue
    map.set(id, {
      position: lm.position,
      confidence: getEffectiveConfidence(lm),
    })
  }
  return map
}

export function upperLimbLandmarksAreClinical(ids: string[], landmarks: PlacedLandmark[]): boolean {
  return ids.every((id) => {
    const lm = landmarks.find((l) => l.landmarkId === id)
    return lm && resolveValidationState(lm) !== 'automatico_stimato'
  })
}
