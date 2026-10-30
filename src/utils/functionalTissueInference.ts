import { tissueProximity } from '@/data/tissueDistricts'
import type { ClinicalObservation, PosturalPattern, TissueFunctionalState, AlterationMyersInference } from '@/types'
import type { FunctionalLocalPattern, FunctionalTissue, FunctionalState } from '@/types/functional'
import { MYOFASCIAL_LINES, getTissueCatalogEntry } from '@/data/myofascialLines'
import { evidenceForPattern, mergeProvenance, independentEvidence, patternRegion, functionalSegment, comparisonFamily, observationSignal, planeFamily, FUNCTIONAL_SEVERITY_WEIGHT, unique } from './functionalEvidence'

export function inferLocalFunctionalPatterns(patterns: PosturalPattern[], observations: ClinicalObservation[], inferences: AlterationMyersInference[]): FunctionalLocalPattern[] {
  const groups = new Map<string, PosturalPattern[]>()
  for (const p of patterns) {
    if (p.status === 'suggested' || p.status === 'excluded') continue
    const key = JSON.stringify([patternRegion(p), p.side, comparisonFamily(p), p.descriptor, observationSignal(p)])
    groups.set(key, [...groups.get(key) ?? [], p])
  }
  return [...groups.entries()].map(([key, sources]) => {
    const p = sources[0], provenance = mergeProvenance(sources.map(s => evidenceForPattern(s, observations)))
    const severities = sources.filter(s => s.severity).map(s => FUNCTIONAL_SEVERITY_WEIGHT[s.severity!])
    const geometric = sources.some(s => s.quantitative && Number.isFinite(s.quantitative.value))
    // Magnitude and unit stay in measurement records. This is an evidence-weighted index, not a length conversion.
    const independent = sources.filter((s, i) => !sources.slice(0, i).some(other => !independentEvidence(evidenceForPattern(s, observations), evidenceForPattern(other, observations))))
    const independentPlanes = unique(independent.map(s => planeFamily(s.plane)))
    const quality = Math.min(.9, (geometric ? .65 : .45) + .12 * (independentPlanes.length - 1))
    const index = severities.length ? Math.round(Math.max(...severities) * quality * 100) : null
    return { id: `functional-local:${key}`, segment: functionalSegment(patternRegion(p)), region: patternRegion(p), side: p.side,
      family: comparisonFamily(p), descriptor: p.descriptor, direction: p.direction, signal: observationSignal(p), index, planes: independentPlanes,
      lineIds: unique([...observations.filter(o => provenance.sourceObservationIds.includes(o.id)).flatMap(o => (o.functionalTissueFindings ?? []).filter(f => f.state !== 'neutral' && tissueProximity(f.tissueName, patternRegion(p) as Parameters<typeof tissueProximity>[1]) === 'local').flatMap(f => Object.values(MYOFASCIAL_LINES).filter(line => line.softTissues.includes(f.tissueName)).map(line => line.id))), ...inferences.filter(i => sources.some(s => s.id === i.instanceId)).flatMap(i => i.lines.map(l => l.lineId))]),
      comparisonIds: [], ...provenance,
      consequences: [index === null ? 'Evidenza insufficiente per stimare un contributo funzionale.' : 'Possibile adattamento locale; estensione ad altri segmenti da verificare con riscontri dedicati.'],
    }
  })
}

function tissueHint(name: string, p: PosturalPattern): 'concentric' | 'eccentric' | undefined {
  const entry = getTissueCatalogEntry(name)
  const regional = p.phenomenon === 'deviazione_rachidea' ? `${p.phenomenon}_${p.anatomicalDetails?.region ?? ''}` : p.phenomenon
  const hint = entry?.alterationHints?.[regional] ?? entry?.alterationHints?.[p.phenomenon]
  return hint === 'accorciamento' ? 'concentric' : hint === 'allungamento' ? 'eccentric' : undefined
}

/** Existing tissue-specific hints are hypotheses: never apply a line's state to every tissue. */
function contextualState(name: string, sources: PosturalPattern[], observations: ClinicalObservation[], side: FunctionalTissue['side']): { state: FunctionalState; ruleIds: string[]; uncertainty: string[] } {
  const sourceIds = new Set(sources.flatMap(p => p.observationIds))
  const explicit = observations.filter(o => sourceIds.has(o.id) && o.status !== 'suggested' && o.status !== 'excluded').flatMap(o =>
    (o.functionalTissueFindings ?? []).filter(f => f.tissueName.toLowerCase() === name.toLowerCase() && f.method.trim() && (f.side === side || f.side === 'bilaterale')))
  if (explicit.length) {
    const states = unique(explicit.map(f => f.state))
    return states.length === 1 ? { state: states[0], ruleIds: ['clinical-tissue-assessment:v1'], uncertainty: ['Stato funzionale registrato dal clinico; non ricavato da una percentuale geometrica.'] }
      : { state: 'undetermined', ruleIds: [], uncertainty: ['Valutazioni cliniche specifiche del tessuto discordanti.'] }
  }
  const qualified = sources.filter(p => observationSignal(p) !== undefined && p.status !== 'suggested' && p.status !== 'excluded')
  const hints = qualified.flatMap(p => { const state = tissueHint(name, p); return state ? [{ p, state }] : [] })
  if (new Set(hints.map(h => h.state)).size > 1) return { state: 'undetermined', ruleIds: [], uncertainty: ['Hint specifici del tessuto discordanti: nessuna sintesi forzata.'] }
  for (const hint of hints) {
    const corroborator = qualified.find(other => other.id !== hint.p.id && independentEvidence(evidenceForPattern(hint.p, observations), evidenceForPattern(other, observations)) &&
      (other.quantitative || hint.p.quantitative) && (tissueHint(name, other) === hint.state ||
        other.descriptor === (hint.state === 'concentric' ? 'fissazione_accorciamento' : 'fissazione_allungamento')))
    if (corroborator) return { state: hint.state, ruleIds: [`tissue-context-v1:${name}:${hint.p.phenomenon}`, `corroboration:${corroborator.id}`],
      uncertainty: ['Ipotesi contestuale da hint anatomici esistenti e reperti confermati; attività contrattile e lunghezza non misurate.'] }
  }
  return { state: 'undetermined', ruleIds: [], uncertainty: ['Dati non sufficienti per distinguere facilitazione concentrica, fissazione eccentrica o neutralità del singolo tessuto.'] }
}

export function inferFunctionalTissues(tissues: TissueFunctionalState[], patterns: PosturalPattern[], observations: ClinicalObservation[], locals: FunctionalLocalPattern[]): FunctionalTissue[] {
  const candidates = tissues.map(t => ({ ...t, support: [...t.support ?? []] }))
  for (const p of patterns) for (const o of observations.filter(o => p.observationIds.includes(o.id) && o.status !== 'suggested' && o.status !== 'excluded')) {
    for (const f of o.functionalTissueFindings ?? []) {
      const region = patternRegion(p)
      if (!f.method.trim() || tissueProximity(f.tissueName, region as Parameters<typeof tissueProximity>[1]) !== 'local') continue
      const lines = Object.values(MYOFASCIAL_LINES).filter(line => line.softTissues.includes(f.tissueName)).map(line => line.id)
      if (!lines.length) continue
      const support = { patternId: p.id, region, proximity: 'local' as const, confidence: .6 }
      const existing = candidates.find(t => t.name === f.tissueName && t.side === f.side)
      if (existing) { existing.support.push(support); existing.sourceLineIds = unique([...existing.sourceLineIds, ...lines]) }
      else candidates.push({ tissueId: f.tissueName.toLowerCase(), name: f.tissueName, side: f.side,
        lengthState: 'unknown', mobilityState: 'unknown', functionalRole: 'associated', evidence: [p.id], observationIds: [o.id], sourceLineIds: lines,
        confidence: .6, conflict: false, conflictingEvidence: [], support: [support] })
    }
  }
  return candidates.flatMap(t => {
    const localIds = unique((t.support ?? []).filter(s => s.proximity === 'local').map(s => s.patternId))
    const localSources = patterns.filter(p => localIds.includes(p.id) && tissueProximity(t.name, patternRegion(p) as Parameters<typeof tissueProximity>[1]) === 'local')
    const regions = unique(localSources.map(patternRegion))
    return regions.map(region => {
      const sources = localSources.filter(p => patternRegion(p) === region)
      const local = locals.filter(l => l.sourcePatternIds.some(id => sources.some(p => p.id === id)))
      const indices = local.flatMap(l => l.index === null ? [] : [l.index])
      const functional = contextualState(t.name, sources, observations, t.side)
      return { id: `functional-tissue:${t.tissueId}:${t.side}:${region}`, name: t.name, side: t.side, segment: functionalSegment(region),
        ...functional, localIndex: functional.state === 'neutral' ? 0 : indices.length ? Math.max(...indices) : null, segmentIncidence: null, globalIncidence: null,
        lineIds: t.sourceLineIds, contralateral: 'not_comparable' as const, antagonistTissueIds: [],
        consequences: [functional.state === 'undetermined' ? 'Nessuna conseguenza specifica attribuibile al tessuto isolato.' : 'Possibile organizzazione funzionale locale da verificare con esame clinico dedicato.'],
        ...mergeProvenance(sources.map(p => evidenceForPattern(p, observations))),
      }
    })
  })
}
