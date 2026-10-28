import type { AnatomicalPlane, Point2D } from '@/types'

/** Piano di osservazione nel formato referto quantitativo. */
export type ObservationPlane =
  | 'front_anterior'
  | 'front_posterior'
  | 'sagittal'
  | 'transverse'

export type PosturalOperator = 'tilt' | 'shift' | 'bend' | 'rotation' | 'alignment'

export type ReferenceMode = 'absolute' | 'relative'

export type QuantitativeDirection =
  | 'dx'
  | 'sx'
  | 'anterior'
  | 'posterior'
  | 'superior'
  | 'inferior'
  | 'medial'
  | 'lateral'
  | 'intrarotazione'
  | 'extrarotazione'
  | 'medializzazione'
  | 'lateralizzazione'

export type ObservationType =
  | 'osservazione_diretta'
  | 'stima_biomeccanica'
  | 'inferenza_miofasciale'

export type StructuredSeverity = 'normal' | 'lieve' | 'moderata' | 'marcata'

export type QuantitativeUnitCode = 'deg' | 'cm' | 'px'

/** Asse clinico per raggruppamento referto quantitativo. */
export type ClinicalAxis =
  | 'asse_cefalico'
  | 'asse_sternale'
  | 'asse_toraco_addominale'
  | 'asse_pelvico'
  | 'rapporto_cranio_torace'
  | 'rapporto_torace_bacino'
  | 'rapporto_addome_bacino'
  | 'arto_superiore'
  | 'cingolo_scapolare'
  | 'rapporto_braccio_torace'

export const CLINICAL_AXIS_LABELS: Record<ClinicalAxis, string> = {
  asse_cefalico: 'Asse cefalico',
  asse_sternale: 'Asse sternale',
  asse_toraco_addominale: 'Asse toraco-addominale',
  asse_pelvico: 'Asse pelvico',
  rapporto_cranio_torace: 'Rapporto cranio–torace',
  rapporto_torace_bacino: 'Rapporto torace–bacino',
  rapporto_addome_bacino: 'Rapporto addome–bacino',
  arto_superiore: 'Arto superiore',
  cingolo_scapolare: 'Cingolo scapolare',
  rapporto_braccio_torace: 'Rapporto braccio–torace',
}

export type LandmarkDetectionSource = 'manual' | 'automatic' | 'confirmed_auto'

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
  /** cm per unità normalizzata verticale (0–1 sull'immagine). */
  cmPerNormalizedUnit?: number
  status: CalibrationStatus
}

export function createDefaultCalibration(): PhotoCalibration {
  return { mode: 'none', status: 'unavailable' }
}

export interface StructuredPosturalFinding {
  id: string
  plane: ObservationPlane
  anatomicalPlane: AnatomicalPlane
  segment: string
  operator: PosturalOperator
  referenceMode: ReferenceMode
  referenceTarget: string
  landmarksUsed: string[]
  value: number
  unit: QuantitativeUnitCode
  direction: QuantitativeDirection
  severity: StructuredSeverity
  confidence: number
  relatedMyofascialLines: string[]
  relatedMuscles: string[]
  interpretation: string
  /** alterazione assoluta | relativa | compenso sovrasegmentario | compenso sottosegmentario */
  clinicalCategory?: string
  /** Asse clinico di appartenenza della misura. */
  clinicalAxis?: ClinicalAxis
  /** true se tutti i landmark usati sono validati e sopra soglia referto. */
  reportEligible?: boolean
  /** Motivi per cui la misura resta in sezione preliminare. */
  preliminaryReasons?: string[]
  warnings?: string[]
  /** Osservazione diretta | stima biomeccanica | inferenza miofasciale (arto superiore). */
  observationType?: ObservationType
}

export interface LandmarkDetectionResult {
  landmarkId: string
  position: Point2D
  confidence: number
  needsConfirmation: boolean
  plane: AnatomicalPlane
}

export interface MyofascialInferenceContext {
  plane: AnatomicalPlane
  landmarks: Array<{
    landmarkId: string
    position: Point2D
    confidence: number
  }>
  calibration?: PhotoCalibration
  imageHeightPx?: number
}

export const ANATOMICAL_TO_OBSERVATION_PLANE: Record<
  AnatomicalPlane,
  ObservationPlane
> = {
  frontale_anteriore: 'front_anterior',
  frontale_posteriore: 'front_posterior',
  sagittale_destro: 'sagittal',
  sagittale_sinistro: 'sagittal',
  trasverso: 'transverse',
}

export function toObservationPlane(plane: AnatomicalPlane): ObservationPlane {
  return ANATOMICAL_TO_OBSERVATION_PLANE[plane]
}
