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
