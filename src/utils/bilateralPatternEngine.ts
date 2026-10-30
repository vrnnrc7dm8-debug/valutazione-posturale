import type { AutoMeasurement } from './biomechanicsEngine'
import type { FunctionalLocalPattern, BilateralComparison, FunctionalProvenance } from '@/types/functional'
import { mergeProvenance, unique } from './functionalEvidence'

/** Only explicit segment-specific normal measures support a normal opposite side. Absence never means normal. */
function normalCounterpart(measurements: AutoMeasurement[], family: string, side: 'destro' | 'sinistro') {
  const ids = family === 'asse_femoro_tibiale' ? [`asse_femoro_tibiale_${side}`]
    : family === 'rotazione_arto_inferiore' ? [`rotazione_arto_inferiore_${side}`] : []
  return measurements.filter(m => ids.includes(m.id) && m.side === side && m.severity === 'normale' && Number.isFinite(m.numericValue))
}
export function compareBilateralPatterns(locals: FunctionalLocalPattern[], measurements: AutoMeasurement[]): BilateralComparison[] {
  const groups = new Map<string, FunctionalLocalPattern[]>()
  for (const local of locals.filter(l => l.side === 'destro' || l.side === 'sinistro')) {
    const key = `${local.segment}:${local.family}`
    groups.set(key, [...groups.get(key) ?? [], local])
  }
  return [...groups.entries()].map(([key, sources]) => {
    const right = sources.filter(s => s.side === 'destro'), left = sources.filter(s => s.side === 'sinistro')
    const a = right.filter(l => l.index !== null), b = left.filter(l => l.index !== null)
    const rightSigns = unique(a.flatMap(l => l.signal === undefined ? [] : [l.signal]))
    const leftSigns = unique(b.flatMap(l => l.signal === undefined ? [] : [l.signal]))
    let relation: BilateralComparison['relation'] = 'not_comparable'
    let normalSide: BilateralComparison['normalSide']
    const normal = normalCounterpart(measurements, sources[0].family, right.length ? 'sinistro' : 'destro')
    if (a.length && b.length && rightSigns.length === 1 && leftSigns.length === 1) {
      if (rightSigns[0] * leftSigns[0] < 0) relation = 'opposite'
      else {
        const delta = Math.max(...a.map(l => l.index!)) - Math.max(...b.map(l => l.index!))
        relation = Math.abs(delta) <= 5 ? 'symmetric' : delta > 0 ? 'greater_right' : 'greater_left'
      }
    } else if (normal.length && (a.length || b.length) && !(right.length && left.length)) {
      normalSide = right.length ? 'sinistro' : 'destro'; relation = right.length ? 'greater_right' : 'greater_left'
    }
    const normalProvenance: FunctionalProvenance = { sourceObservationIds: [], sourcePatternIds: [], sourceMeasurementIds: normal.map(m => `automatic_measurement:${m.plane}:${m.id}`) }
    return { id: `bilateral:${key}`, segment: sources[0].segment, family: sources[0].family, relation, normalSide,
      rightPatternIds: right.map(l => l.id), leftPatternIds: left.map(l => l.id), ...mergeProvenance([...sources, normalProvenance]),
      consequences: [relation === 'opposite' ? 'Asimmetria funzionale interlaterale: verificare relazioni pelviche e crociate prima di ipotizzare una componente spirale.'
        : relation === 'not_comparable' ? 'Lato controlaterale non confrontabile: nessuna simmetria presunta.' : 'Possibile organizzazione differenziale dei due lati; il confronto non misura lo stato muscolare.'],
    }
  })
}
