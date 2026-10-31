import type { AnatomicalPlane, ClinicalDirection, Descriptor, Severity, Side, AnatomicalDetails, MyofascialLineId } from './index'
import type { FunctionalProvenance } from './functional'

export type PatternRegion = 'head' | 'cervical' | 'thoracic' | 'lumbar' | 'scapular' | 'pelvic' | 'lower_limb' | 'distal'
export type PatternFamily = 'cranio_cervical' | 'frontal' | 'sagittal' | 'transverse' | 'lower_limb' | 'mixed'
export interface GeometricPatternEvidence {
  region: PatternRegion
  tags: string[]
  /** Shared geometry is one independent source, even when expressed as angle and offset. */
  independenceKey: string
  landmarkIds: string[]
  multiSegment?: boolean
  bendDirection?: 'dx' | 'sx'
  convexityDirection?: 'dx' | 'sx'
  shape?: 'C' | 'S'
}
export interface PatternEvidence extends FunctionalProvenance {
  id: string
  plane: AnatomicalPlane
  region: PatternRegion
  tags: string[]
  independenceKey: string
  reference?: string
  direction?: ClinicalDirection | 'C' | 'S' | 'opposto' | 'DX→SX' | 'SX→DX'
  side?: Side
  severity: Severity | 'normale'
  value?: number
  unit?: string
  description: string
  multiSegment: boolean
  derived?: boolean
  confirmed: boolean
  landmarkValidated?: boolean
  reportEligible: boolean
  bendDirection?: 'dx' | 'sx'
  convexityDirection?: 'dx' | 'sx'
}
export interface RegionalPosturalPattern extends FunctionalProvenance {
  name?: string
  components?: string[]
  interpretation?: string
  convexityDirection?: 'dx'|'sx'
  bendDirection?: 'dx'|'sx'
  bilateralOrganization?: 'symmetric' | 'asymmetric' | 'unilateral_alteration' | 'bilateral_alteration' | 'opposite' | 'not_comparable'
  id: string
  region: PatternRegion
  evidenceIds: string[]
  supportedPlanes: AnatomicalPlane[]
  directions: string[]
  severity: Severity
  confirmed: boolean
}
export type GlobalSupportType = 'geometricSupport'|'clinicalObservationSupport'|'multiplanarSupport'|'contralateralSupport'
export interface RecognizedGlobalPattern extends FunctionalProvenance {
  supportScore?: number
  supportTypes?: GlobalSupportType[]
  corroboration?: { eligible: boolean; reasons: string[] }
  prevalentSide?: 'destro'|'sinistro'
  id: string
  signatureId: string
  name: string
  family: PatternFamily
  evidenceIds: string[]
  regionalPatternIds: string[]
  supportedPlanes: AnatomicalPlane[]
  independentEvidenceCount: number
  regionsInvolved: PatternRegion[]
  direction: string
  functionalIntensity: number
  severity: Severity
  confirmed: boolean
  reportEligible: boolean
  myersCompatibility: MyofascialLineId[]
  consequences: string[]
  explanation: string[]
}
export interface PatternRecognitionResult {
  version: 'pattern-recognition-v1'
  evidence: PatternEvidence[]
  regionalPatterns: RegionalPosturalPattern[]
  regionalRelations: Array<FunctionalProvenance & { id: string; from: string; to: string; fromSide?: Side; toSide?: Side; kind: 'anatomical_continuity' | 'crossed' | 'opposition' | 'measured_relation'; evidenceIds: string[]; direction: string }>
  globalPatterns: RecognizedGlobalPattern[]
  unresolvedPotentialPatterns: Array<{ signatureId: string; reason: string; missingEvidence: string[] }>
}
export interface ElementarySuggestion {
  phenomenon: string
  district: import('./clinical').ClinicalDistrict
  descriptor: Descriptor
  direction?: ClinicalDirection
  anatomicalDetails?: AnatomicalDetails
}
