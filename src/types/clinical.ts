/** Versione del modello dati persistito (localStorage / futuro export). */
export type AssessmentSchemaVersion = 'assessment-v1' | 'assessment-v2'

export const LEGACY_ASSESSMENT_SCHEMA_VERSION = 'assessment-v1' as const
export const CURRENT_ASSESSMENT_SCHEMA_VERSION = 'assessment-v2' as const

/** Distretto anatomico-funzionale (Step 2 popolerà il catalogo). */
export type ClinicalDistrict =
  | 'cranio_cervicale'
  | 'cervicale'
  | 'cervico_dorsale'
  | 'toracica'
  | 'toraco_lombare'
  | 'lombare'
  | 'lombosacrale'
  | 'sacrale'
  | 'pelvico'
  | 'cintura_scapolare'
  | 'arto_superiore'
  | 'arto_inferiore'
  | 'globale'

/** Direzioni semantiche per piano (Step 3 attiverà in UI). */
export type FrontalDirection =
  | 'dx'
  | 'sx'
  | 'mediale'
  | 'laterale'
  | 'varo'
  | 'valgo'

export type SagittalDirection =
  | 'anteriore'
  | 'posteriore'
  | 'antiversione'
  | 'retroversione'
  | 'anteriorizzazione'
  | 'posteriorizzazione'

export type TransverseDirection =
  | 'dx'
  | 'sx'
  | 'intrarotazione'
  | 'extrarotazione'
  | 'rotazione_dx'
  | 'rotazione_sx'

export type ClinicalDirection =
  | FrontalDirection
  | SagittalDirection
  | TransverseDirection

export type QuantitativeUnit = 'gradi' | 'percentuale' | 'normalizzato' | 'mm'

export interface QuantitativeValue {
  value: number
  unit: QuantitativeUnit
}

/** Metadati estesi catalogo alterazioni (non persistiti in Assessment). */
export interface ClinicalAlterationMeta {
  district?: ClinicalDistrict
  /** es. 'deviazione_rachidea' per raggruppamento UI */
  parentType?: string
  allowedDirections?: ClinicalDirection[]
}


import type { AnatomicalPlane, Severity, Side, MyofascialLineId } from './index'

export type ClinicalStatus = 'suggested' | 'confirmed' | 'modified' | 'excluded'
export type SpinalRegion = 'cervicale' | 'cervico_dorsale' | 'toracica' | 'toraco_lombare' | 'lombare' | 'lombosacrale' | 'globale' | 'indeterminata'
export interface AnatomicalDetails {
  region?: SpinalRegion
  level?: string
  apex?: string
  convexity?: 'dx' | 'sx' | 'indeterminata'
  startLevel?: string
  endLevel?: string
}
export interface ClinicalObservation {
  id: string
  plane: AnatomicalPlane
  district: ClinicalDistrict
  phenomenon: string
  side?: Side
  direction?: ClinicalDirection
  severity?: Severity
  quantitative?: QuantitativeValue
  source: 'automatic_measurement' | 'automatic_suggestion' | 'manual'
  sourceIds: string[]
  status: ClinicalStatus
  anatomicalDetails?: AnatomicalDetails
  /** Collegamento esplicito deciso dal clinico; non dedotto da reperti diversi. */
  patternId?: string
  notes?: string
}
export interface PosturalPattern {
  id: string
  plane: AnatomicalPlane
  district: ClinicalDistrict
  phenomenon: string
  side?: Side
  direction?: ClinicalDirection
  severity?: Severity
  observationIds: string[]
  anatomicalDetails?: AnatomicalDetails
  source: 'derived' | 'manual' | 'mixed'
  status: ClinicalStatus
  confidence?: number
  notes?: string
}
export interface TissueFunctionalState {
  tissueId: string
  name: string
  side: Side
  lengthState: 'shortened' | 'lengthened' | 'neutral' | 'unknown'
  mobilityState: 'fixed' | 'restricted' | 'mobile' | 'unknown'
  functionalRole: 'primary' | 'compensatory' | 'associated' | 'unknown'
  evidence: string[]
  observationIds: string[]
  sourceLineIds: MyofascialLineId[]
  confidence: number
  conflict: boolean
  conflictingEvidence: string[]
}
