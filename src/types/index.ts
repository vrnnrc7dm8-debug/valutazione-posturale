export type { ClinicalObservation, PosturalPattern, TissueFunctionalState, ClinicalStatus, AnatomicalDetails, SpinalRegion } from './clinical'
import type {
  AssessmentSchemaVersion,
  ClinicalDirection,
  ClinicalDistrict,
  QuantitativeValue,
} from './clinical'
export type {
  AssessmentSchemaVersion,
  ClinicalAlterationMeta,
  ClinicalDirection,
  ClinicalDistrict,
  FrontalDirection,
  QuantitativeUnit,
  QuantitativeValue,
  SagittalDirection,
  TransverseDirection,
} from './clinical'
export {
  CURRENT_ASSESSMENT_SCHEMA_VERSION,
  LEGACY_ASSESSMENT_SCHEMA_VERSION,
} from './clinical'

export type Sex = 'M' | 'F' | 'altro'

export type Descriptor =
  | 'tilt'
  | 'bend'
  | 'shift'
  | 'rotation'
  | 'compenso'
  | 'fissazione_accorciamento'
  | 'fissazione_allungamento'

export type Severity = 'lieve' | 'moderato' | 'severo'

export type Side = 'destro' | 'sinistro' | 'bilaterale'

export type TissueState =
  | 'accorciamento'
  | 'allungamento'
  | 'fissazione'
  | 'compenso'

export type AnatomicalPlane =
  | 'frontale_anteriore'
  | 'frontale_posteriore'
  | 'sagittale_destro'
  | 'sagittale_sinistro'
  | 'trasverso'

export type MyofascialLineId =
  | 'superficial_front'
  | 'superficial_back'
  | 'lateral_right'
  | 'lateral_left'
  | 'spiral_right'
  | 'spiral_left'
  | 'deep_front'
  | 'arm_lines'
  | 'linea_superficiale_frontale_braccio_dx'
  | 'linea_superficiale_frontale_braccio_sx'
  | 'linea_profonda_frontale_braccio_dx'
  | 'linea_profonda_frontale_braccio_sx'
  | 'linea_superficiale_posteriore_braccio_dx'
  | 'linea_superficiale_posteriore_braccio_sx'
  | 'linea_profonda_posteriore_braccio_dx'
  | 'linea_profonda_posteriore_braccio_sx'
  | 'functional_front'
  | 'functional_back'

export interface Anthropometry {
  pesoKg: number | null
  altezzaCm: number | null
  dataMisurazione?: string
  aggiornatoIl?: string
}
export interface AnthropometrySnapshot extends Anthropometry {
  dataMisurazione: string
  etaAnni: number | null
  sesso: Sex | ''
}

export interface Patient {
  antropometria?: Anthropometry
  photoCount?: number
  landmarkCount?: number
  alterationCount?: number
  hasReport?: boolean
  homonymCount?: number
  evaluationCount?: number
  lastEvaluationDate?: string
  archived?: boolean
  codiceClinico?: string
  id: string
  nome: string
  cognome: string
  eta: number | ''
  sesso: Sex | ''
  dataValutazione: string
  noteCliniche: string
  operatore: string
}

export type LandmarkCatalogId = string

export type LandmarkCategory =
  | 'head'
  | 'shoulder_girdle'
  | 'thorax'
  | 'pelvis'
  | 'upper_limb'
  | 'lower_limb'
  | 'spine'
  | 'foot'
  | 'midline'

export type LandmarkSide =
  | 'destro'
  | 'sinistro'
  | 'bilaterale'
  | 'linea_mediana'

export type AnnotationTool =
  | 'landmark'
  | 'line'
  | 'angle'
  | 'select'
  | 'delete'

export interface Point2D {
  x: number
  y: number
}

export type LandmarkDetectionSource = 'manual' | 'automatic' | 'confirmed_auto'

/** Stato clinico del landmark per referto e UI. */
export type LandmarkValidationState =
  | 'automatico_stimato'
  | 'manuale_confermato'
  | 'manuale_corretto'

export interface PlacedLandmark {
  aiProposal?: {
    model: string
    modelVersion: string
    keypoint: string
    mappingType: import('@/data/synthposeLandmarkMapping').SynthposeMappingType
    rawConfidence: number
    minimumConfidence: number
    reportEligibleByDefault: false
    bulkEligible: boolean
  }
  id: string
  landmarkId: string
  label: string
  shortLabel: string
  position: Point2D
  plane: AnatomicalPlane
  side: LandmarkSide
  category: LandmarkCategory
  confidence: number
  notes?: string
  /** Posizione originale del rilevamento automatico (prima di correzione manuale). */
  autoPosition?: Point2D
  detectionSource?: LandmarkDetectionSource
  /** Landmark automatico in attesa di conferma clinica. */
  needsConfirmation?: boolean
  /** Stato di validazione clinica (preferito rispetto a detectionSource). */
  validationState?: LandmarkValidationState
  /** @deprecated migrazione */
  type?: string
}

export interface DrawnLine {
  id: string
  landmarkAId: string
  landmarkBId: string
  /** Riferimento pendenza — opzionale per compatibilità dati legacy. */
  reference?: 'horizontal' | 'gravity_vertical'
}

export interface DrawnAngle {
  id: string
  landmarkAId: string
  vertexLandmarkId: string
  landmarkCId: string
}

export interface AnnotationOverlaySettings {
  showGrid: boolean
  showGravityLine: boolean
  showHorizontalRef: boolean
  gravityLineX: number
  horizontalRefY: number
  snapEnabled: boolean
  gridDivisions: number
}

/** Pan/zoom della foto nel riquadro di analisi (griglia resta fissa). */
export interface ImageViewState {
  /** Offset px del bordo sinistro immagine rispetto alla posizione "adatta al riquadro". */
  panX: number
  panY: number
  /** Moltiplicatore zoom (1 = adatta al riquadro). */
  zoom: number
}

export function createDefaultImageView(): ImageViewState {
  return { panX: 0, panY: 0, zoom: 1 }
}

export interface StructuredLandmarkCollection {
  /** Landmark confermati da proposta automatica. */
  confirmed: PlacedLandmark[]
  /** Landmark posizionati manualmente dall'operatore. */
  manual: PlacedLandmark[]
  /** Proposte euristiche temporanee (non refertabili). */
  autoProposals: PlacedLandmark[]
}

export interface PhotoAnnotations {
  landmarks: StructuredLandmarkCollection
  lines: DrawnLine[]
  angles: DrawnAngle[]
  overlay: AnnotationOverlaySettings
  imageView: ImageViewState
}

export function createDefaultOverlay(): AnnotationOverlaySettings {
  return {
    showGrid: true,
    showGravityLine: true,
    showHorizontalRef: true,
    gravityLineX: 0.5,
    horizontalRefY: 0.5,
    snapEnabled: true,
    gridDivisions: 10,
  }
}

export function createEmptyAnnotations(): PhotoAnnotations {
  return {
    landmarks: { confirmed: [], manual: [], autoProposals: [] },
    lines: [],
    angles: [],
    overlay: createDefaultOverlay(),
    imageView: createDefaultImageView(),
  }
}

/** Snapshot fotografico per confronto prima/dopo trattamento. */
export interface PhotoSnapshot {
  id: string
  dataUrl: string
  imageUrl?: string
  photoUrl?: string
  src?: string
  originalPath?: string
  fileName?: string
  annotations: PhotoAnnotations
  capturedAt: string
  label: string
}

export type CalibrationMode =
  | 'subject_height'
  | 'marker_distance'
  | 'manual_scale'
  | 'none'

export type CalibrationStatus = 'calibrated' | 'estimated' | 'unavailable'

export interface PhotoCalibration {
  mode: CalibrationMode
  subjectHeightCm?: number
  markerDistanceCm?: number
  markerLandmarkA?: string
  markerLandmarkB?: string
  cmPerNormalizedUnit?: number
  status: CalibrationStatus
}

export function createDefaultCalibration(): PhotoCalibration {
  return { mode: 'none', status: 'unavailable' }
}

export interface PhotoSlot {
  plane: AnatomicalPlane
  dataUrl?: string
  imageUrl?: string
  photoUrl?: string
  src?: string
  originalPath?: string
  fileName?: string
  note: string
  annotations: PhotoAnnotations
  /** Scala per conversione shift px → cm. */
  calibration?: PhotoCalibration
  /** Baseline (prima trattamento) per confronto. */
  baseline?: PhotoSnapshot
}

export type AlterationSource = 'manual' | 'suggested' | 'confirmed'

export interface AlterationSelection {
  status?: import('./clinical').ClinicalStatus
  district?: ClinicalDistrict
  anatomicalDetails?: import('./clinical').AnatomicalDetails
  patternId?: string
  /** Identità originale del suggerimento, conservata dopo correzioni di lato. */
  suggestionKey?: string
  /** Identificatore univoco istanza (multi-istanza da Step 1). */
  instanceId: string
  alterationId: string
  descriptor: Descriptor
  /** Direzione semantica per piano (Step 3). */
  direction?: ClinicalDirection
  side?: Side
  severity: Severity
  /** Valore quantitativo associato (Step 4). */
  quantitative?: QuantitativeValue
  note?: string
  /** Origine selezione: manuale, suggerita automaticamente, confermata dal clinico */
  source?: AlterationSource
}

export interface PlaneAssessment {
  observations?: import('./clinical').ClinicalObservation[]
  plane: AnatomicalPlane
  alterations: AlterationSelection[]
}

export interface MyofascialLineResult {
  lineId: MyofascialLineId
  score: number
  severity: Severity
  prevalentSide: Side
  possibleState: TissueState
  involvedDistricts: string[]
  softTissues: string[]
}

/** Coinvolgimento muscolare inferito per singola alterazione (Step 6). */
export interface TissueInvolvement {
  name: string
  side: Side
  functionalState: TissueState
  confidence: number
}

/** Linea Myers inferita per una singola istanza di alterazione. */
export interface AlterationLineInference {
  lineId: MyofascialLineId
  lineName: string
  side: Side
  score: number
  severity: Severity
  functionalState: TissueState
  confidence: number
  tissues: TissueInvolvement[]
}

/** Inferenza Myers completa per istanza alterazione. */
export interface AlterationMyersInference {
  instanceId: string
  alterationId: string
  plane: AnatomicalPlane
  lines: AlterationLineInference[]
}

/** Tessuto miofasciale ranked per alterazione (Step 7). */
export interface RankedTissueFinding {
  name: string
  side: Side
  functionalState: TissueState
  confidence: number
  /** Score composito linea × confidenza, usato per ranking. */
  score: number
  sourceLineIds: MyofascialLineId[]
  sourceLineNames: string[]
  instanceId?: string
  alterationId?: string
  plane?: AnatomicalPlane
}

/** Analisi tessuti per singola istanza alterazione. */
export interface AlterationTissueAnalysis {
  instanceId: string
  alterationId: string
  plane: AnatomicalPlane
  tissues: RankedTissueFinding[]
}

/** Reperto clinico integrato per singola istanza (Step 8). */
export interface ClinicalFinding {
  instanceId: string
  alterationId: string
  plane: AnatomicalPlane
  planeLabel: string
  alterationLabel: string
  severity: Severity
  /** Testo narrativo completo (alterazione + Myers + tessuti). */
  narrative: string
  /** Riepilogo linee Myers correlate. */
  myersSummary: string
  /** Riepilogo tessuti ranked. */
  tissueSummary: string
  topMyersLine?: {
    lineName: string
    side: Side
    functionalState: TissueState
    confidence: number
  }
  topTissues: RankedTissueFinding[]
}

export interface PlaneReportSection {
  dataAvailability?: { photoPresent: boolean; clinicalLandmarks: number; excludedLandmarks: number; note: string }
  recordedMeasurements?: string[]
  plane: AnatomicalPlane
  planeLabel: string
  observedAlterations: string[]
  autoMeasurements: string[]
  compensationNotes: string[]
  myersLines: { name: string; severity: Severity; tissues: string[] }[]
  /** Reperti integrati per alterazioni del piano (Step 8). */
  structuredFindings?: ClinicalFinding[]
  priorityEvaluable?: boolean
  therapeuticPriority: 'bassa' | 'media' | 'alta'
  dominantPattern: string
}

export interface ClinicalReportData {
  clinicalPipeline?: {
    observations: import('./clinical').ClinicalObservation[]
    patterns: import('./clinical').PosturalPattern[]
    tissues: import('./clinical').TissueFunctionalState[]
  }
  /** Immutable generation snapshot; image bytes are archived as existing photo references. */
  photographs?: PhotoSlot[]
  generatedAt?: string
  sourceRevision?: number
  antropometria?: AnthropometrySnapshot & { bmi: number | null }
  sections: PlaneReportSection[]
  analyzedPlanes: string[]
  mainAlterations: string[]
  alteredMeridians: MyofascialLineResult[]
  topSoftTissues: string[]
  /** Tessuti ranked con lato e stato funzionale (Step 7). */
  rankedTissueFindings?: RankedTissueFinding[]
  /** Reperti integrati per alterazione (Step 8). */
  structuredFindings?: ClinicalFinding[]
  /** Misure quantitative assolute/relative (modulo inferenza miofasciale). */
  quantitativePosturalFindings?: import('./landmarks').StructuredPosturalFinding[]
  primaryCompensationHypothesis: string
  secondaryCompensationHypotheses: string[]
  priorityEvaluable?: boolean
  therapeuticPriority: 'bassa' | 'media' | 'alta'
  integrationNotes: string
  disclaimer: string
  aiReady?: {
    landmarkDetectionReady: boolean
    patternClassificationReady: boolean
    evolutionTrackingReady: boolean
  }
}

export interface Assessment {
  evaluationId?: number
  loadedRevision?: string
  recoveredRevision?: string
  allowHomonym?: boolean
  importedFiles?: Array<{ path: string; base64: string }>
  inputRevision?: number
  antropometriaSnapshot?: AnthropometrySnapshot | null
  archiveKey?: string
  schemaVersion: AssessmentSchemaVersion
  patient: Patient
  photos: PhotoSlot[]
  planeAssessments: PlaneAssessment[]
  myofascialResults: MyofascialLineResult[]
  report: ClinicalReportData | null
  updatedAt: string
  /** Altezza soggetto default per calibrazione shift (cm). */
  defaultSubjectHeightCm?: number
}

export interface PosturalAlteration {
  id: string
  label: string
  plane: AnatomicalPlane
  suggestedDescriptors: Descriptor[]
  autoHint?: string
  district?: ClinicalDistrict
  parentType?: string
  allowedDirections?: ClinicalDirection[]
}

/** Placeholder per integrazioni AI future */
export interface AiIntegrationConfig {
  tensorflowJs?: boolean
  mediaPipe?: boolean
  openCv?: boolean
  autoLandmarkDetection: boolean
}

export const DESCRIPTOR_LABELS: Record<Descriptor, string> = {
  tilt: 'Tilt',
  bend: 'Bend',
  shift: 'Shift',
  rotation: 'Rotazione',
  compenso: 'Compenso',
  fissazione_accorciamento: 'Fissazione in accorciamento',
  fissazione_allungamento: 'Fissazione in allungamento',
}

export const PLANE_LABELS: Record<AnatomicalPlane, string> = {
  frontale_anteriore: 'Piano frontale anteriore',
  frontale_posteriore: 'Piano frontale posteriore',
  sagittale_destro: 'Piano sagittale destro',
  sagittale_sinistro: 'Piano sagittale sinistro',
  trasverso: 'Piano trasverso / rotazionale',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  lieve: 'Lieve',
  moderato: 'Moderato',
  severo: 'Severo',
}

export const TISSUE_STATE_LABELS: Record<TissueState, string> = {
  accorciamento: 'Accorciamento',
  allungamento: 'Allungamento',
  fissazione: 'Fissazione',
  compenso: 'Compenso',
}
