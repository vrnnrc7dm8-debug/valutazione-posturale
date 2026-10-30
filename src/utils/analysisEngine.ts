import { formatTransverseRelation, isTransverseRelation } from '@/data/transverseRelations'
import { runClinicalPipeline, formatPattern } from './clinicalPipeline'
import { formatQuantitativeValue } from '@/data/clinicalThresholds'
import {
  formatDirectionLabel,
  formatOperatorDirection,
} from '@/data/directionalDescriptors'
import { getAlterationLabel } from '@/data/planes'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import type {
  AlterationMyersInference,
  AlterationSelection,
  AlterationTissueAnalysis,
  AnatomicalPlane,
  Assessment,
  ClinicalFinding,
  ClinicalReportData,
  MyofascialLineResult,
  PhotoSlot,
  PlaneAssessment,
  PlaneReportSection,
  Side,
} from '@/types'
import { PLANE_LABELS, SEVERITY_LABELS, TISSUE_STATE_LABELS } from '@/types'
import {
  computeAutoMeasurements,
  type AutoMeasurement,
} from '@/utils/biomechanicsEngine'
import {
  analyzeAllPlanes,
  inferMyersForPlane,
} from '@/utils/myersEngine'
import {
  globalTherapeuticPriority,
  scorePlaneAssessment,
  type PlaneClinicalScore,
} from '@/utils/postureScoring'
import {
  analyzeAllTissues,
  analyzeTissuesForPlane,
  formatAlterationTissueSummary,
} from '@/utils/tissueAnalysis'
import { enrichClinicalReportWithQuantitativeFindings } from '@/utils/reportGenerator'
import { countLandmarks, getClinicalLandmarks, normalizeLandmarkCollection } from '@/utils/landmarkCollection'
import { isReportEligibleLandmark } from '@/utils/landmarkValidation'
import { resolvePersistablePhotoDataUrl } from '@/utils/imageDataUrl'
import { angleAtVertex } from '@/utils/geometry'
import { formatLineMeasurementLabel, resolveLineReference } from '@/utils/lineMeasurements'

export interface FullAnalysisResult {
  myofascialResults: MyofascialLineResult[]
  report: ClinicalReportData
  planeScores: PlaneClinicalScore[]
  autoMeasurements: AutoMeasurement[]
}

const REPORT_PLANE_ORDER: AnatomicalPlane[] = [
  'frontale_anteriore',
  'frontale_posteriore',
  'sagittale_destro',
  'sagittale_sinistro',
  'trasverso',
]

export function getReportLandmarks(photo: PhotoSlot) {
  return getClinicalLandmarks(normalizeLandmarkCollection(photo.annotations.landmarks, photo.plane))
    .filter(lm => isReportEligibleLandmark(lm) && Number.isFinite(lm.position?.x) && Number.isFinite(lm.position?.y) && lm.position.x >= 0 && lm.position.x <= 1 && lm.position.y >= 0 && lm.position.y <= 1)
}

function collectReportMeasurements(photos: PhotoSlot[]): AutoMeasurement[] {
  return photos.filter(photo => resolvePersistablePhotoDataUrl(photo)).flatMap(photo =>
    computeAutoMeasurements(photo.plane, getReportLandmarks(photo).map(lm => ({ ...lm, landmarkId: normalizeLandmarkId(lm), plane: photo.plane })))
      .filter(m => m.id !== 'need_more_lm' && m.numericValue !== undefined && Number.isFinite(m.numericValue)),
  )
}

function annotationMeasurements(photo: PhotoSlot | undefined): string[] {
  if (!photo || !resolvePersistablePhotoDataUrl(photo)) return []
  const landmarks = new Map(getReportLandmarks(photo).map(lm => [lm.id, lm]))
  const measurements: string[] = []
  for (const [index, line] of photo.annotations.lines.entries()) {
    const a = landmarks.get(line.landmarkAId), b = landmarks.get(line.landmarkBId)
    if (!a || !b || Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) < 1e-8) continue
    measurements.push(`Linea annotata ${index + 1}: ${formatLineMeasurementLabel(a.position, b.position, resolveLineReference(line.reference))} (indice su coordinate normalizzate)`)
  }
  for (const [index, angle] of photo.annotations.angles.entries()) {
    const a = landmarks.get(angle.landmarkAId), v = landmarks.get(angle.vertexLandmarkId), c = landmarks.get(angle.landmarkCId)
    if (!a || !v || !c || Math.hypot(a.position.x - v.position.x, a.position.y - v.position.y) < 1e-8 || Math.hypot(c.position.x - v.position.x, c.position.y - v.position.y) < 1e-8) continue
    measurements.push(`Angolo annotato ${index + 1}: ${angleAtVertex(a.position, v.position, c.position).toFixed(1)}° (indice su coordinate normalizzate)`)
  }
  return measurements
}

export function normalizeLandmarkId(lm: {
  landmarkId?: string
  type?: string
}): string {
  return lm.landmarkId ?? lm.type ?? ''
}

function formatObservedAlteration(
  plane: AnatomicalPlane,
  alteration: PlaneAssessment['alterations'][number],
): string {
  if (plane === 'trasverso' && isTransverseRelation(alteration.descriptor) && alteration.transverseRelation) return `${formatTransverseRelation(alteration.transverseRelation, alteration.quantitative)} · ${SEVERITY_LABELS[alteration.severity]}${alteration.note ? ` · ${alteration.note}` : ''}`
  const quantitativeLabel = formatQuantitativeValue(alteration.quantitative)
  const descriptorPart = formatOperatorDirection(alteration.descriptor, alteration.direction)
  const sidePart =
    alteration.side && !alteration.direction ? ` · ${alteration.side}` : ''
  const valuePart = quantitativeLabel ? ` · ${quantitativeLabel}` : ''
  const details = alteration.anatomicalDetails ? ` · ${formatPattern({ id: alteration.instanceId, plane, district: alteration.district ?? 'globale', phenomenon: '', observationIds: [], source: 'manual', status: 'confirmed', anatomicalDetails: alteration.anatomicalDetails, notes: alteration.note })}` : alteration.note ? ` · ${alteration.note}` : ''
  return `${getAlterationLabel(plane, alteration.alterationId)} — ${descriptorPart}${sidePart}${valuePart} (${SEVERITY_LABELS[alteration.severity]})${details}`
}

function sideShort(side: Side): string {
  if (side === 'destro') return 'dx'
  if (side === 'sinistro') return 'sx'
  return side
}

function formatMyersLinesSummary(myers: AlterationMyersInference): string {
  const top = myers.lines.slice(0, 2)
  if (top.length === 0) return 'Nessuna linea Myers sopra soglia.'
  return top
    .map(
      (line) =>
        `${line.lineName} (${line.side}, ${TISSUE_STATE_LABELS[line.functionalState].toLowerCase()}, conf. ${Math.round(line.confidence * 100)}%)`,
    )
    .join('; ')
}

export function formatClinicalFinding(
  plane: AnatomicalPlane,
  alt: AlterationSelection,
  myers: AlterationMyersInference,
  tissueAnalysis: AlterationTissueAnalysis,
): string {
  const relation = plane === 'trasverso' && isTransverseRelation(alt.descriptor) ? alt.transverseRelation : undefined
  const label = relation ? formatTransverseRelation(relation, alt.quantitative) : getAlterationLabel(plane, alt.alterationId)
  const directionLabel = relation ? undefined : formatDirectionLabel(alt.direction)
  const quantitativeLabel = relation ? undefined : formatQuantitativeValue(alt.quantitative)

  let alterationPart = label
  if (directionLabel) {
    alterationPart += ` verso ${directionLabel.toLowerCase()}`
  } else if (!relation && alt.side && alt.side !== 'bilaterale') {
    alterationPart += ` lato ${alt.side}`
  }
  alterationPart += ` di grado ${SEVERITY_LABELS[alt.severity].toLowerCase()}`
  if (quantitativeLabel) {
    alterationPart += ` (${quantitativeLabel})`
  }

  const topLine = myers.lines[0]
  const topTissues = tissueAnalysis.tissues.slice(0, 2)

  if (!topLine && topTissues.length === 0) {
    return `${alterationPart}. Nessuna correlazione Myers/tessuti sopra soglia.`
  }

  const myersParts: string[] = []
  if (topLine) {
    myersParts.push(
      `${topLine.lineName} (${topLine.side}, ${TISSUE_STATE_LABELS[topLine.functionalState].toLowerCase()})`,
    )
  }
  if (myers.lines[1]) {
    myersParts.push(
      `${myers.lines[1].lineName} (${myers.lines[1].side})`,
    )
  }

  const myersClause = myersParts.length
    ? `associata a possibile coinvolgimento ${myersParts.length > 1 ? 'delle linee' : 'della linea'} ${myersParts.join(' e della ')}`
    : ''

  const tissueClause =
    topTissues.length > 0
      ? ` (${topTissues
          .map(
            (t) =>
              `${t.name} ${sideShort(t.side)} → ${TISSUE_STATE_LABELS[t.functionalState].toLowerCase()} probabile`,
          )
          .join(', ')})`
      : ''

  if (!myersClause) {
    return `${alterationPart}, con possibile coinvolgimento tessutale${tissueClause}.`
  }

  return `${alterationPart}, ${myersClause}${tissueClause}.`
}

function buildClinicalFinding(
  plane: AnatomicalPlane,
  alt: AlterationSelection,
  myers: AlterationMyersInference,
  tissueAnalysis: AlterationTissueAnalysis,
): ClinicalFinding {
  const topLine = myers.lines[0]
  return {
    instanceId: alt.instanceId,
    alterationId: alt.alterationId,
    plane,
    planeLabel: PLANE_LABELS[plane],
    alterationLabel: getAlterationLabel(plane, alt.alterationId),
    severity: alt.severity,
    narrative: formatClinicalFinding(plane, alt, myers, tissueAnalysis),
    myersSummary: formatMyersLinesSummary(myers),
    tissueSummary: formatAlterationTissueSummary(plane, tissueAnalysis),
    topMyersLine: topLine
      ? {
          lineName: topLine.lineName,
          side: topLine.side,
          functionalState: topLine.functionalState,
          confidence: topLine.confidence,
        }
      : undefined,
    topTissues: tissueAnalysis.tissues.slice(0, 4),
  }
}

export function buildStructuredFindings(
  planeAssessments: PlaneAssessment[],
): ClinicalFinding[] {
  const findings: ClinicalFinding[] = []

  for (const pa of planeAssessments) {
    if (pa.alterations.length === 0) continue
    const myersInferences = inferMyersForPlane(pa.plane, pa.alterations)
    const tissueAnalyses = analyzeTissuesForPlane(
      pa.plane,
      pa.alterations,
      myersInferences,
    )
    const byInstance = new Map(pa.alterations.map((a) => [a.instanceId, a]))
    const tissueByInstance = new Map(
      tissueAnalyses.map((t) => [t.instanceId, t]),
    )

    for (const myers of myersInferences) {
      const alt = byInstance.get(myers.instanceId)
      const tissue = tissueByInstance.get(myers.instanceId)
      if (!alt || !tissue) continue
      findings.push(buildClinicalFinding(pa.plane, alt, myers, tissue))
    }
  }

  return findings
}

export function generateClinicalReport(
  planeAssessments: PlaneAssessment[],
  photos: PhotoSlot[],
  myofascialResults: MyofascialLineResult[],
  defaultSubjectHeightCm?: number,
): ClinicalReportData {
  const autoMeasurements = collectReportMeasurements(photos)
  const pipeline = runClinicalPipeline(planeAssessments, autoMeasurements)
  planeAssessments = pipeline.consolidatedPlanes
  myofascialResults = analyzeAllPlanes(pipeline.myersPlanes)

  const planeScores = planeAssessments.map((pa) =>
    scorePlaneAssessment(pa, autoMeasurements.filter(m => m.plane !== 'frontale_anteriore')),
  )
  const structuredFindings: ClinicalFinding[] = []
  const findingsByPlane = new Map(
    REPORT_PLANE_ORDER.map((plane) => [
      plane,
      structuredFindings.filter((f) => f.plane === plane),
    ]),
  )

  const sections: PlaneReportSection[] = REPORT_PLANE_ORDER.map((plane) => {
    const pa = planeAssessments.find((p) => p.plane === plane)
    const photo = photos.find(p => p.plane === plane)
    const photoPresent = Boolean(photo && resolvePersistablePhotoDataUrl(photo))
    const clinicalLandmarks = photoPresent && photo ? getReportLandmarks(photo).length : 0
    const allLandmarks = photo ? countLandmarks(normalizeLandmarkCollection(photo.annotations.landmarks, plane)) : 0
    const score = planeScores.find((s) => s.plane === plane)
    const planeAlts = pa?.alterations ?? []
    const planeAuto = autoMeasurements.filter((m) => m.plane === plane)
    const drawnMeasurements = annotationMeasurements(photo)
    const planeMyers = analyzeAllPlanes(
      pipeline.myersPlanes.filter(p => p.plane === plane),
    )

    return {
      plane,
      planeLabel: PLANE_LABELS[plane],
      dataAvailability: {
        photoPresent, clinicalLandmarks, excludedLandmarks: allLandmarks - clinicalLandmarks,
        note: !photoPresent ? 'Fotografia non disponibile: nessuna misura fotografica calcolata.'
          : planeAuto.length + drawnMeasurements.length === 0 ? 'Fotografia presente; nessuna misura calcolabile con i landmark validati e gli operatori disponibili per questo piano.'
          : 'Misure fotografiche derivate dai landmark validati disponibili; unità e riferimenti indicati per ciascun parametro.',
      },
      recordedMeasurements: pipeline.observations.filter(o => o.plane === plane && o.status !== 'excluded' && o.status !== 'suggested' && o.quantitative && Number.isFinite(o.quantitative.value)).map(o => `${o.phenomenon.replaceAll('_', ' ')}: ${formatQuantitativeValue(o.quantitative)}`),
      observedAlterations: planeAlts.map((a) => formatObservedAlteration(plane, a)),
      autoMeasurements: [...planeAuto.map(
        (m) => `${m.label}: ${m.value}${m.suggestion ? ` · ${m.suggestion}` : ''}`,
      ), ...drawnMeasurements],
      compensationNotes: planeAlts.length && score?.dominantPattern ? [`Ipotesi basata sulle alterazioni registrate: ${score.dominantPattern}`] : [],
      myersLines: planeMyers.slice(0, 4).map((m) => ({
        name: MYOFASCIAL_LINES[m.lineId].name,
        severity: m.severity,
        tissues: m.softTissues.slice(0, 5),
      })),
      structuredFindings: findingsByPlane.get(plane)?.filter((f) => f.narrative),
      priorityEvaluable: planeAlts.length > 0 || planeAuto.length > 0,
      therapeuticPriority: score?.priority ?? 'bassa',
      dominantPattern: planeAlts.length ? score?.dominantPattern ?? 'Pattern non determinabile.' : 'Dati insufficienti per un pattern interpretativo.',
    }
  })

  const allAlterations = planeAssessments.flatMap((p) => p.alterations)
  const rankedTissueFindings: ReturnType<typeof analyzeAllTissues> = []

  const baseReport: ClinicalReportData = {
    clinicalPipeline: { inferences: pipeline.inferences, observations: pipeline.observations.filter(o => o.status !== 'excluded' && o.status !== 'suggested'), patterns: pipeline.patterns, tissues: pipeline.tissues },
    sections,
    analyzedPlanes: sections.map((s) => s.planeLabel),
    mainAlterations: allAlterations.map((a) => {
      const plane = planeAssessments.find((p) =>
        p.alterations.includes(a),
      )?.plane
      if (plane === 'trasverso' && isTransverseRelation(a.descriptor) && a.transverseRelation) return formatObservedAlteration(plane, a)
      return plane
        ? `${getAlterationLabel(plane, a.alterationId)} — ${formatOperatorDirection(a.descriptor, a.direction)}${a.quantitative ? ` ${formatQuantitativeValue(a.quantitative)}` : ''} (${SEVERITY_LABELS[a.severity]})`
        : a.alterationId
    }),
    alteredMeridians: myofascialResults,
    topSoftTissues: rankedTissueFindings.slice(0, 12).map(
      (t) => `${t.name} (${t.side}, ${t.functionalState})`,
    ),
    rankedTissueFindings: rankedTissueFindings.slice(0, 20),
    structuredFindings,
    primaryCompensationHypothesis:
      myofascialResults[0]
        ? `Ipotesi di compenso primario lungo ${MYOFASCIAL_LINES[myofascialResults[0].lineId].name} (${myofascialResults[0].prevalentSide}).`
        : 'Dati insufficienti per ipotesi di compenso primario.',
    secondaryCompensationHypotheses: myofascialResults
      .slice(1, 4)
      .map(
        (r) =>
          `Secondario: ${MYOFASCIAL_LINES[r.lineId].name} (${SEVERITY_LABELS[r.severity]}).`,
      ),
    priorityEvaluable: sections.some(s => s.priorityEvaluable),
    therapeuticPriority: globalTherapeuticPriority(planeScores),
    integrationNotes:
      'Predisposto per AI: classificazione pattern, landmark detection (MediaPipe/TF.js), baropodometria, stabilometria, export PDF.',
    disclaimer:
      'Ipotesi funzionale posturale e miofasciale — non diagnosi medica.',
    aiReady: {
      landmarkDetectionReady: true,
      patternClassificationReady: false,
      evolutionTrackingReady: false,
    },
  }

  return enrichClinicalReportWithQuantitativeFindings(baseReport, {
    schemaVersion: 'assessment-v2',
    patient: {} as Assessment['patient'],
    photos: photos.filter(p => resolvePersistablePhotoDataUrl(p)).map(photo => ({ ...photo, annotations: {
      ...photo.annotations,
      landmarks: { confirmed: getReportLandmarks(photo), manual: [], autoProposals: [] },
    } })),
    planeAssessments,
    myofascialResults,
    report: null,
    updatedAt: new Date().toISOString(),
    defaultSubjectHeightCm,
  })
}

export function runFullAnalysis(
  planeAssessments: PlaneAssessment[],
  photos: PhotoSlot[],
  defaultSubjectHeightCm?: number,
): FullAnalysisResult {
  const autoMeasurements = collectReportMeasurements(photos)
  const pipeline = runClinicalPipeline(planeAssessments, autoMeasurements)
  const consolidatedPlanes = pipeline.consolidatedPlanes
  const myofascialResults = analyzeAllPlanes(pipeline.myersPlanes)

  const planeScores = consolidatedPlanes.map((pa) =>
    scorePlaneAssessment(pa, autoMeasurements.filter(m => m.plane !== 'frontale_anteriore')),
  )
  const report = generateClinicalReport(
    planeAssessments,
    photos,
    myofascialResults,
    defaultSubjectHeightCm,
  )
  return { myofascialResults, report, planeScores, autoMeasurements }
}
