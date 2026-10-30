import type { AnatomicalPlane, Descriptor, MyofascialLineId, QuantitativeUnit, Side, ClinicalDirection } from './index'

export type FunctionalState = 'concentric' | 'eccentric' | 'neutral' | 'undetermined'
export type FunctionalSegment = 'foot' | 'crural' | 'femoral' | 'pelvic' | 'vertebral' | 'scapular' | 'cervical' | 'upper_limb' | 'unspecified'
export type PlaneFamily = 'frontal' | 'sagittal' | 'transverse'
export interface FunctionalProvenance {
  sourceObservationIds: string[]
  sourceMeasurementIds: string[]
  sourcePatternIds: string[]
}
export interface FunctionalMeasurement {
  id: string
  value?: number
  unit?: QuantitativeUnit
  plane: AnatomicalPlane
  origin: 'computed_geometry' | 'recorded_measurement'
  label: string
  available: boolean
}
export interface FunctionalLocalPattern extends FunctionalProvenance {
  id: string
  segment: FunctionalSegment
  region: string
  side?: Side
  family: string
  descriptor?: Descriptor
  direction?: ClinicalDirection
  signal?: -1 | 0 | 1
  index: number | null
  planes: PlaneFamily[]
  lineIds: MyofascialLineId[]
  comparisonIds: string[]
  consequences: string[]
}
export interface BilateralComparison extends FunctionalProvenance {
  id: string
  segment: FunctionalSegment
  family: string
  relation: 'symmetric' | 'greater_right' | 'greater_left' | 'opposite' | 'not_comparable'
  rightPatternIds: string[]
  leftPatternIds: string[]
  normalSide?: 'destro' | 'sinistro'
  consequences: string[]
}
export interface FunctionalTissue extends FunctionalProvenance {
  id: string
  name: string
  side: Side
  segment: FunctionalSegment
  state: FunctionalState
  localIndex: number | null
  segmentIncidence: number | null
  globalIncidence: number | null
  lineIds: MyofascialLineId[]
  contralateral: BilateralComparison['relation']
  antagonistTissueIds: string[]
  ruleIds: string[]
  uncertainty: string[]
  consequences: string[]
}
export interface FunctionalEdge extends FunctionalProvenance {
  id: string
  from: string
  to: string
  kind: 'continuity' | 'opposition' | 'girdle' | 'crossed' | 'distal'
  direction?: 'DX→SX' | 'SX→DX'
}
export interface FunctionalLineSegment extends FunctionalProvenance {
  segment: FunctionalSegment
  side: Side | 'undetermined'
  weight: number
  index: number | null
  state: FunctionalState | 'mixed'
}
export interface FunctionalLine extends FunctionalProvenance {
  direction?: 'DX→SX' | 'SX→DX'
  lineId: MyofascialLineId
  globalIndex: number | null
  coverage: number
  segments: FunctionalLineSegment[]
  linkedLineIds: MyofascialLineId[]
}
export interface GlobalTensegrityPattern extends FunctionalProvenance {
  id: string
  kind: 'regional_continuity' | 'torsional' | 'global_tensegrity'
  localPatternIds: string[]
  edgeIds: string[]
  direction?: 'DX→SX' | 'SX→DX'
  index: number
  planes: PlaneFamily[]
  lineIds: MyofascialLineId[]
  consequences: string[]
}
export interface FunctionalModel {
  version: 'functional-network-v1'
  methodology: string
  measurements: FunctionalMeasurement[]
  localPatterns: FunctionalLocalPattern[]
  comparisons: BilateralComparison[]
  tissues: FunctionalTissue[]
  edges: FunctionalEdge[]
  lines: FunctionalLine[]
  globalPatterns: GlobalTensegrityPattern[]
  conflicts: Array<FunctionalProvenance & { message: string }>
}
