import type { ClinicalObservation, PosturalPattern, Severity } from '@/types'
import type { FunctionalProvenance, FunctionalSegment, PlaneFamily, FunctionalMeasurement } from '@/types/functional'
import type { AutoMeasurement } from './biomechanicsEngine'
import { primaryRegion } from '@/data/tissueDistricts'

export const FUNCTIONAL_SEVERITY_WEIGHT: Record<Severity, number> = { lieve: .25, moderato: .55, severo: .85 }
export const unique = <T,>(values: T[]) => [...new Set(values)]
export function mergeProvenance(items: FunctionalProvenance[]): FunctionalProvenance {
  return { sourceObservationIds: unique(items.flatMap(i => i.sourceObservationIds)), sourceMeasurementIds: unique(items.flatMap(i => i.sourceMeasurementIds)), sourcePatternIds: unique(items.flatMap(i => i.sourcePatternIds)) }
}
export function planeFamily(plane: string): PlaneFamily {
  return plane.startsWith('sagittale') ? 'sagittal' : plane === 'trasverso' ? 'transverse' : 'frontal'
}
export function functionalSegment(region: string): FunctionalSegment {
  if (['piede'].includes(region)) return 'foot'
  if (region === 'gamba') return 'crural'
  if (region === 'coscia') return 'femoral'
  if (['pelvico', 'sacrale', 'lombosacrale'].includes(region)) return 'pelvic'
  if (['cervicale', 'cranio_cervicale'].includes(region)) return 'cervical'
  if (region === 'cintura_scapolare') return 'scapular'
  if (['cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare'].includes(region)) return 'vertebral'
  if (region === 'arto_superiore') return 'upper_limb'
  return 'unspecified'
}
export function patternRegion(p: PosturalPattern): string {
  if (/recurvatum|flessione_ginocchio|flexum/.test(p.phenomenon)) return 'gamba'
  return primaryRegion(p)
}
export function comparisonFamily(p: PosturalPattern): string {
  if (/recurvatum|flessione_ginocchio|flexum/.test(p.phenomenon)) return 'knee_sagittal'
  return p.phenomenon
}
/** Sign describes observation polarity only, never a muscle's contractile state. */
export function observationSignal(p: PosturalPattern): -1 | 0 | 1 | undefined {
  if (p.descriptor === 'anteposizione') return 1
  if (p.descriptor === 'retroposizione') return -1
  if (/recurvatum/.test(p.phenomenon)) return 1
  if (/flessione_ginocchio|flexum/.test(p.phenomenon)) return -1
  if (p.descriptor === 'fissazione_accorciamento') return 1
  if (p.descriptor === 'fissazione_allungamento') return -1
  if (['dx', 'rotazione_dx', 'anteriore', 'anteriorizzazione', 'antiversione', 'valgo', 'extrarotazione'].includes(p.direction ?? '')) return 1
  if (['sx', 'rotazione_sx', 'posteriore', 'posteriorizzazione', 'retroversione', 'varo', 'intrarotazione'].includes(p.direction ?? '')) return -1
  return undefined
}
export function evidenceForPattern(p: PosturalPattern, observations: ClinicalObservation[]): FunctionalProvenance {
  const sources = observations.filter(o => p.observationIds.includes(o.id))
  return { sourceObservationIds: unique(sources.map(o => o.id)), sourcePatternIds: [p.id],
    sourceMeasurementIds: unique(sources.filter(o => o.quantitative && Number.isFinite(o.quantitative.value)).flatMap(o => {
      const ids = o.sourceIds.filter(id => id.startsWith('automatic_measurement:'))
      return [`recorded_measurement:${o.id}`, ...ids]
    })) }
}
export function independentEvidence(a: FunctionalProvenance, b: FunctionalProvenance): boolean {
  return !a.sourceObservationIds.some(id => b.sourceObservationIds.includes(id)) && !a.sourceMeasurementIds.some(id => b.sourceMeasurementIds.includes(id))
}
export function measurementRecords(observations: ClinicalObservation[], measurements: AutoMeasurement[]): FunctionalMeasurement[] {
  const computed: FunctionalMeasurement[] = measurements.map(m => ({ id: `automatic_measurement:${m.plane}:${m.id}`, value: Number.isFinite(m.numericValue) ? (m.numericValue === 0 ? 0 : m.numericValue) : undefined,
    unit: m.unit, plane: m.plane, origin: 'computed_geometry' as const, label: m.label, available: Number.isFinite(m.numericValue) }))
  const known = new Set(computed.map(m => m.id))
  for (const o of observations) if (o.quantitative && Number.isFinite(o.quantitative.value)) {
    const ids = [`recorded_measurement:${o.id}`, ...o.sourceIds.filter(id => id.startsWith('automatic_measurement:'))]
    for (const id of ids) if (!known.has(id)) {
      // A saved measure is a clinical snapshot; it is not a newly calculated photo measurement.
      computed.push({ id, value: o.quantitative.value === 0 ? 0 : o.quantitative.value, unit: o.quantitative.unit, plane: o.plane, origin: 'recorded_measurement', label: o.phenomenon, available: true }); known.add(id)
    }
  }
  return computed
}
