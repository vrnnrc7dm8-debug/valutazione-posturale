import type { AlterationMyersInference, PosturalPattern, TissueFunctionalState } from '@/types'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import { primaryRegion, tissueProximity } from '@/data/tissueDistricts'

export function independentPatterns(a: PosturalPattern, b: PosturalPattern): boolean {
  return a.id !== b.id && !a.observationIds.some(id => b.observationIds.includes(id)) &&
    !(a.phenomenon === b.phenomenon && a.descriptor === b.descriptor && a.direction && b.direction && a.direction !== b.direction)
}

/** A remote line association is retained only when another independent pattern supports that tissue locally. */
export function supportedTissueEvidence(patterns: PosturalPattern[], inferences: AlterationMyersInference[]): TissueFunctionalState[] {
  const evidence: TissueFunctionalState[] = []
  for (const inference of inferences) {
    const pattern = patterns.find(p => p.id === inference.instanceId)!
    for (const line of inference.lines) for (const tissue of line.tissues) {
      const local: TissueFunctionalState = {
        tissueId: tissue.name.toLowerCase(), name: tissue.name, side: tissue.side,
        // Kinematics alone do not establish muscle length or fixation.
        lengthState: pattern.descriptor === 'fissazione_accorciamento' ? 'shortened' : pattern.descriptor === 'fissazione_allungamento' ? 'lengthened' : 'unknown',
        mobilityState: pattern.descriptor?.startsWith('fissazione_') ? 'fixed' : 'unknown',
        functionalRole: pattern.descriptor === 'compenso' ? 'compensatory' : 'associated',
        evidence: [pattern.id], observationIds: pattern.observationIds, sourceLineIds: [line.lineId],
        confidence: tissue.confidence, conflict: false, conflictingEvidence: [],
        support: [{ patternId: pattern.id, region: primaryRegion(pattern), proximity: 'local', confidence: tissue.confidence, corroboratingPatternIds: line.corroboratedBy }],
      }
      evidence.push(local)
      for (const other of inferences) {
        const remotePattern = patterns.find(p => p.id === other.instanceId)!
        if (!independentPatterns(pattern, remotePattern)) continue
        const proximity = tissueProximity(tissue.name, primaryRegion(remotePattern))
        if (proximity === 'local') continue
        const relatedLine = other.lines.find(l => l.lineId === line.lineId && (l.side === tissue.side || l.side === 'bilaterale' || tissue.side === 'bilaterale'))
        if (!relatedLine || !MYOFASCIAL_LINES[line.lineId].softTissues.includes(tissue.name)) continue
        const confidence = Math.round(Math.min(tissue.confidence * 0.55, relatedLine.confidence * 0.45) * 100) / 100
        evidence.push({ ...local, lengthState: 'unknown', mobilityState: 'unknown', functionalRole: 'associated',
          evidence: [remotePattern.id], observationIds: remotePattern.observationIds, confidence,
          support: [{ patternId: remotePattern.id, region: primaryRegion(remotePattern), proximity, confidence, corroboratingPatternIds: [pattern.id] }],
        })
      }
    }
  }
  return evidence
}


export function mergeTissueSupport(items: TissueFunctionalState[]): NonNullable<TissueFunctionalState['support']> {
  const support = new Map<string, NonNullable<TissueFunctionalState['support']>[number]>()
  for (const source of items.flatMap(i => i.support ?? [])) {
    const key = `${source.patternId}:${source.proximity}`
    const old = support.get(key)
    support.set(key, { ...source, confidence: Math.max(source.confidence, old?.confidence ?? 0),
      corroboratingPatternIds: [...new Set([...(old?.corroboratingPatternIds ?? []), ...(source.corroboratingPatternIds ?? [])])],
    })
  }
  return [...support.values()]
}
