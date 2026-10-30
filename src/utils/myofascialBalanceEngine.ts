import type { FunctionalLine, FunctionalLocalPattern, FunctionalTissue, GlobalTensegrityPattern, FunctionalState } from '@/types/functional'
import { MYOFASCIAL_LINES, ALL_LINE_IDS } from '@/data/myofascialLines'
import { tissueRegions } from '@/data/tissueDistricts'
import { functionalSegment, mergeProvenance, unique } from './functionalEvidence'

/** Equal anatomical segment weights, normalized over the entire known line, including unobserved segments. */
export function balanceMyofascialLines(locals: FunctionalLocalPattern[], tissues: FunctionalTissue[], globals: GlobalTensegrityPattern[]): FunctionalLine[] {
  return ALL_LINE_IDS.flatMap(lineId => {
    const sources = locals.filter(l => l.lineIds.includes(lineId))
    if (!sources.length) return []
    const segments = unique([...MYOFASCIAL_LINES[lineId].softTissues.flatMap(tissueRegions).map(functionalSegment), ...sources.map(l => l.segment)]).filter(s => s !== 'unspecified')
    if (!segments.length) return []
    const observedSides = unique(sources.flatMap(l => l.side ? [l.side] : []))
    const sides = observedSides.some(s => s === 'destro' || s === 'sinistro') ? ['destro', 'sinistro'] as const
      : observedSides.includes('bilaterale') ? ['bilaterale'] as const : ['undetermined'] as const
    const distribution = segments.flatMap(segment => sides.map(side => {
      const local = sources.filter(s => s.segment === segment && (s.side === side || s.side === 'bilaterale' || !s.side && side === 'undetermined'))
      const values = local.flatMap(l => l.index === null ? [] : [l.index])
      const states = unique(tissues.filter(t => t.segment === segment && t.lineIds.includes(lineId) && (t.side === side || t.side === 'bilaterale') && t.state !== 'undetermined').map(t => t.state))
      return { segment, side, weight: 1 / (segments.length * sides.length),
        index: values.length ? Math.max(...values) : null, state: states.length > 1 ? 'mixed' as const : states[0] ?? 'undetermined' as FunctionalState,
        ...mergeProvenance(local) }
    }))
    const hasGlobalSpiral = globals.some(g => g.lineIds.includes(lineId))
    const directions = unique(globals.filter(g => g.lineIds.includes(lineId)).flatMap(g => g.direction ? [g.direction] : []))
    return [{ lineId, direction: directions.length === 1 ? directions[0] : undefined, segments: distribution, coverage: Math.round(distribution.filter(s => s.index !== null).length / distribution.length * 100),
      globalIndex: lineId.startsWith('spiral_') && !hasGlobalSpiral || !distribution.some(s => s.index !== null) ? null : Math.round(distribution.reduce((sum, s) => sum + (s.index ?? 0) * s.weight, 0)),
      linkedLineIds: unique(sources.flatMap(s => s.lineIds)).filter(id => id !== lineId), ...mergeProvenance(sources) }]
  })
}
const ANTAGONISTS: Record<string, string[]> = {
  quadricipite: ['ischiocrurali'], ischiocrurali: ['quadricipite'],
  'tibiale anteriore': ['gastrocnemio', 'soleo'], gastrocnemio: ['tibiale anteriore'], soleo: ['tibiale anteriore'],
  'retto addominale': ['erettori spinali'], 'erettori spinali': ['retto addominale'],
}
export function completeTissueBalance(tissues: FunctionalTissue[], lines: FunctionalLine[]): FunctionalTissue[] {
  return tissues.map(t => {
    const related = lines.filter(l => t.lineIds.includes(l.lineId))
    const segmentIncidence = t.localIndex === null ? null : Math.round(t.localIndex * (t.state === 'undetermined' ? .45 : .8))
    const weights = related.filter(l => l.globalIndex !== null).flatMap(l => l.segments.filter(s => s.segment === t.segment && (s.side === t.side || s.side === 'bilaterale' || s.side === 'undetermined') && s.index !== null).map(s => s.weight))
    const opposite = tissues.find(o => o.id !== t.id && o.name === t.name && o.segment === t.segment && o.side !== 'bilaterale' && t.side !== 'bilaterale' && o.side !== t.side)
    const determined = opposite && opposite.state !== 'undetermined' && t.state !== 'undetermined'
    const delta = opposite && opposite.localIndex !== null && t.localIndex !== null ? t.localIndex - opposite.localIndex : undefined
    return { ...t, segmentIncidence, globalIncidence: segmentIncidence !== null && weights.length ? Math.round(segmentIncidence * Math.max(...weights)) : null,
      contralateral: determined && [opposite.state, t.state].includes('concentric') && [opposite.state, t.state].includes('eccentric') ? 'opposite' : delta === undefined ? 'not_comparable' : Math.abs(delta) <= 5 ? 'symmetric' : (delta > 0 ? t.side === 'destro' : opposite!.side === 'destro') ? 'greater_right' : 'greater_left',
      antagonistTissueIds: tissues.filter(o => ANTAGONISTS[t.name]?.includes(o.name) && o.segment === t.segment && o.side === t.side && o.state !== 'undetermined' && t.state !== 'undetermined' && o.state !== t.state).map(o => o.id) }
  })
}
