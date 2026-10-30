import type { ClinicalObservation, PosturalPattern, AlterationMyersInference } from '@/types'
import type { FunctionalLocalPattern, BilateralComparison, FunctionalEdge, GlobalTensegrityPattern, FunctionalModel } from '@/types/functional'
import { transverseRelationSide } from '@/data/transverseRelations'
import { mergeProvenance, evidenceForPattern, independentEvidence, unique } from './functionalEvidence'

const ADJACENT = ['foot:crural', 'crural:femoral', 'femoral:pelvic', 'pelvic:vertebral', 'vertebral:scapular', 'scapular:cervical', 'scapular:upper_limb']
export function buildFunctionalNetwork(locals: FunctionalLocalPattern[], comparisons: BilateralComparison[], patterns: PosturalPattern[], observations: ClinicalObservation[], inferences: AlterationMyersInference[]): Pick<FunctionalModel, 'edges' | 'globalPatterns' | 'conflicts'> {
  const edges: FunctionalEdge[] = [], conflicts: FunctionalModel['conflicts'] = []
  const enabled = new Set(inferences.map(i => i.instanceId))
  const conflictNodes = new Set<string>()
  for (let i = 0; i < locals.length; i++) for (const b of locals.slice(i + 1)) {
    const a = locals[i]
    if (a.side === b.side && a.segment === b.segment && a.family === b.family && a.signal && b.signal && a.signal !== b.signal) {
      conflicts.push({ message: 'Reperti discordanti sullo stesso lato e segmento: sintesi globale sospesa per queste fonti.', ...mergeProvenance([a, b]) })
      conflictNodes.add(a.id); conflictNodes.add(b.id)
    }
  }
  function connect(a: FunctionalLocalPattern, b: FunctionalLocalPattern, kind: FunctionalEdge['kind'], relation?: PosturalPattern) {
    if (a.id === b.id || conflictNodes.has(a.id) || conflictNodes.has(b.id) || !independentEvidence(a, b)) return
    if (edges.some(e => e.kind === kind && (!relation || e.sourcePatternIds.includes(relation.id)) && [e.from, e.to].includes(a.id) && [e.from, e.to].includes(b.id))) return
    const side = relation && transverseRelationSide(relation.transverseRelation)
    edges.push({ id: `edge:${kind}:${a.id}:${b.id}:${relation?.id ?? ''}`, from: a.id, to: b.id, kind,
      direction: side === 'destro' ? 'DX→SX' : side === 'sinistro' ? 'SX→DX' : undefined,
      ...mergeProvenance([a, b, ...(relation ? [evidenceForPattern(relation, observations)] : [])]),
    })
  }
  for (let i = 0; i < locals.length; i++) for (const b of locals.slice(i + 1)) {
    const a = locals[i]
    const adjacent = ADJACENT.includes(`${a.segment}:${b.segment}`) || ADJACENT.includes(`${b.segment}:${a.segment}`)
    if (adjacent && a.side === b.side && a.family === b.family && a.descriptor === b.descriptor && a.signal && a.signal === b.signal && a.lineIds.some(id => b.lineIds.includes(id))) connect(a, b, 'continuity')
  }
  for (const comparison of comparisons.filter(c => c.relation === 'opposite')) {
    for (const a of locals.filter(l => comparison.rightPatternIds.includes(l.id))) for (const b of locals.filter(l => comparison.leftPatternIds.includes(l.id))) connect(a, b, 'opposition')
  }
  const relations = patterns.filter(p => (p.status === 'confirmed' || p.status === 'modified') && enabled.has(p.id) && p.quantitative && transverseRelationSide(p.transverseRelation))
  for (const relation of relations) {
    const reference = relation.transverseRelation!.reference
    const endpoints = reference === 'scapolare_pelvico' || reference === 'scapulum_ileo' ? ['scapular', 'pelvic']
      : reference === 'pelvico_bicalcaneare' || reference === 'pelvico_asse_piede' ? ['pelvic', 'foot']
      : reference === 'scapolare_bicalcaneare' || reference === 'scapolare_asse_piede' ? ['scapular', 'foot'] : undefined
    if (endpoints) for (const a of locals.filter(l => l.segment === endpoints[0] && !l.sourcePatternIds.includes(relation.id))) {
      for (const b of locals.filter(l => l.segment === endpoints[1] && !l.sourcePatternIds.includes(relation.id))) {
        const differentSides = a.side && b.side && a.side !== 'bilaterale' && b.side !== 'bilaterale' && a.side !== b.side
        const explicitCross = relation.descriptor === 'compenso_crociato' || reference === 'scapulum_ileo' && relation.transverseRelation?.referenceSide && relation.side && (relation.side === 'destro' ? 'dx' : 'sx') !== relation.transverseRelation.referenceSide
        if (reference === 'scapulum_ileo' && (relation.side && a.side !== relation.side || relation.transverseRelation?.referenceSide && b.side !== (relation.transverseRelation.referenceSide === 'dx' ? 'destro' : 'sinistro'))) continue
        if (differentSides && !explicitCross) continue
        connect(a, b, differentSides ? 'crossed' : endpoints[1] === 'foot' ? 'distal' : 'girdle', relation)
      }
    }
    // Opposed lower-limb organization is only a local contrast until a confirmed pelvic relationship corroborates it.
    if (['pelvico_bicalcaneare', 'scapolare_pelvico', 'scapulum_ileo'].includes(reference)) {
      for (const comparison of comparisons.filter(c => c.relation === 'opposite' && ['crural', 'femoral'].includes(c.segment))) {
        const lower = locals.filter(l => [...comparison.leftPatternIds, ...comparison.rightPatternIds].includes(l.id))
        for (const a of lower) for (const b of locals.filter(l => l.segment === 'pelvic' && l.side && l.side !== 'bilaterale' && l.side !== a.side)) connect(a, b, 'crossed', relation)
      }
    }
  }
  const visited = new Set<string>(), globalPatterns: GlobalTensegrityPattern[] = []
  for (const root of locals) {
    if (visited.has(root.id)) continue
    const ids = new Set([root.id]), queue = [root.id]
    while (queue.length) {
      const id = queue.pop()!
      visited.add(id)
      for (const e of edges.filter(e => e.from === id || e.to === id)) for (const next of [e.from, e.to]) if (!ids.has(next)) { ids.add(next); queue.push(next) }
    }
    const nodes = locals.filter(l => ids.has(l.id)), componentEdges = edges.filter(e => ids.has(e.from) && ids.has(e.to))
    const segments = unique(nodes.map(l => l.segment).filter(s => s !== 'unspecified'))
    // Bilateral opposition alone is not propagation or a global Spiral pattern.
    if (nodes.length < 2 || segments.length < 2 || !componentEdges.some(e => e.kind !== 'opposition')) continue
    const directions = unique(componentEdges.flatMap(e => e.direction ? [e.direction] : []))
    const provenance = mergeProvenance([...nodes, ...componentEdges])
    if (directions.length > 1) {
      conflicts.push({ ...provenance, message: 'Relazioni globali con orientamenti discordanti: nessuna direzione globale forzata.' }); continue
    }
    const planes = unique(nodes.flatMap(n => n.planes)), values = nodes.flatMap(n => n.index === null ? [] : [n.index])
    const measuredNodes = nodes.filter(n => n.sourceMeasurementIds.length || observations.some(o => n.sourceObservationIds.includes(o.id) && o.functionalTissueFindings?.length))
    if (values.length < 2 || provenance.sourceObservationIds.length < 2 || !measuredNodes.some((n, i) => measuredNodes.slice(i + 1).some(other => independentEvidence(n, other) && n.segment !== other.segment))) continue
    const crossed = componentEdges.some(e => e.kind === 'crossed') && directions.length === 1
    const lineIds = unique(nodes.flatMap(n => n.lineIds)).filter(id => !id.startsWith('spiral_') || crossed && id === (directions[0] === 'DX→SX' ? 'spiral_right' : 'spiral_left'))
    const global = segments.includes('pelvic') && segments.includes('scapular') && segments.some(s => ['foot', 'crural', 'femoral'].includes(s))
    globalPatterns.push({ id: `global:${[...ids].sort().join('|')}`, kind: global ? 'global_tensegrity' : crossed ? 'torsional' : 'regional_continuity', localPatternIds: [...ids], edgeIds: componentEdges.map(e => e.id),
      direction: directions[0], index: Math.min(100, Math.round(values.reduce((a, b) => a + b, 0) / values.length * (1 + .1 * (segments.length - 1) + .1 * (planes.length - 1)))),
      planes, lineIds, ...provenance, consequences: [
        'Possibile redistribuzione delle tensioni nei soli segmenti supportati dal pattern.',
        ...(crossed ? ['Componente torsionale compatibile con un adattamento crociato; da verificare clinicamente.'] : []),
        ...(componentEdges.some(e => e.kind === 'girdle' || e.kind === 'crossed') ? ['Possibile componente di taglio biomeccanico: indice organizzativo, non misura di forza o carico discale.'] : []),
      ] })
  }
  return { edges, globalPatterns, conflicts }
}
