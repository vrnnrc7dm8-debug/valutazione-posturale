import type { AssessmentSchemaVersion } from './clinical'
import type { AnatomicalPlane, Assessment } from './index'

/** Versione formato export paziente (Step 9a). */
export const PATIENT_EXPORT_VERSION = 'patient_export_v1' as const

export type PatientExportVersion = typeof PATIENT_EXPORT_VERSION

export type ExportWarningCode =
  | 'report_absent'
  | 'alteration_missing_side'
  | 'alteration_missing_value'
  | 'duplicate_landmark'
  | 'redundant_occipital_landmarks'

export interface ExportClinicalWarning {
  code: ExportWarningCode
  severity: 'info' | 'warning'
  message: string
  plane?: AnatomicalPlane
  instanceId?: string
  alterationId?: string
  landmarkId?: string
}

export interface PatientExportManifest {
  exportVersion: PatientExportVersion
  assessmentSchemaVersion: AssessmentSchemaVersion
  clinicalThresholdsVersion: string
  exportedAt: string
  patientId: string
  patientName: string
  evaluationDate: string
  files: string[]
  photoCount: number
  annotationCount: number
  alterationCount: number
  hasReport: boolean
  /** true se myers.json deriva da calcolo al volo (assessment senza myofascialResults salvati). */
  myersComputedAtExport: boolean
  warningCount: number
}

export interface PatientImportResult {
  assessment: Assessment
  manifest: PatientExportManifest
  warnings: ExportClinicalWarning[]
}
