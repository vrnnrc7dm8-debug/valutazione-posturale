import type { FunctionalModel, FunctionalProvenance, FunctionalState, FunctionalSegment, BilateralComparison } from '@/types/functional'
import { formatOperatorDirection } from '@/data/clinicalOperators'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
export const FUNCTIONAL_STATE_LABELS: Record<FunctionalState, string> = {
  concentric: 'Facilitazione concentrica / accorciamento (presunta)', eccentric: 'Fissazione eccentrica / allungamento (presunta)',
  neutral: 'Neutro (registrato clinicamente)', undetermined: 'Non sufficientemente determinabile',
}
export const FUNCTIONAL_SEGMENT_LABELS: Record<FunctionalSegment, string> = {
  foot: 'piede/calcagno', crural: 'gamba / comparto crurale', femoral: 'coscia', pelvic: 'bacino', vertebral: 'rachide', scapular: 'cingolo scapolare', cervical: 'capo / cervicale', upper_limb: 'arto superiore', unspecified: 'segmento non determinabile',
}
export const COMPARISON_LABELS: Record<BilateralComparison['relation'], string> = {
  symmetric: 'Indici simmetrici', greater_right: 'Indice maggiore a DX', greater_left: 'Indice maggiore a SX', opposite: 'Organizzazione opposta SX/DX', not_comparable: 'Non confrontabile',
}
export const functionalPercent = (value: number | null) => value === null ? 'non determinabile' : `${value}% (indice stimato)`
export function functionalProvenanceLines(p: FunctionalProvenance): string[] {
  return [`sourceObservationIds: ${p.sourceObservationIds.join('; ') || 'nessuno'}`, `sourceMeasurementIds: ${p.sourceMeasurementIds.join('; ') || 'nessuno'}`, `sourcePatternIds: ${p.sourcePatternIds.join('; ') || 'nessuno'}`]
}
export function functionalModelToLines(model: FunctionalModel, technical = false): string[] {
  const evidence = (p:FunctionalProvenance) => technical ? functionalProvenanceLines(p) : []
  const lines = ['RETE FUNZIONALE / PATTERN GLOBALI', model.methodology, 'PATTERN LOCALI']
  for (const local of model.localPatterns.filter(p=>technical||p.index!==null&&!!p.direction)) lines.push(`${local.family.replaceAll('_',' ')} — ${local.descriptor ? formatOperatorDirection(local.descriptor, local.direction) : ''} · ${FUNCTIONAL_SEGMENT_LABELS[local.segment]} · Indice locale: ${functionalPercent(local.index)}`, ...evidence(local))
  lines.push('CONFRONTO INTERLATERALE')
  for(const c of model.comparisons.filter(c=>technical||c.relation!=='not_comparable'))lines.push(`${c.family.replaceAll('_',' ')}: ${COMPARISON_LABELS[c.relation]}`,...c.consequences,...evidence(c))
  lines.push('PATTERN GLOBALI FUNZIONALI CORROBORATI')
  const globals=model.globalPatterns.filter(g=>technical||g.clinicalDirection||g.direction)
  for(const g of globals)lines.push(`${g.name??'Pattern funzionale integrato'} — ${g.clinicalDirection??g.direction??''} · Indice stimato: ${functionalPercent(g.index)}`,`Componenti Myers: ${g.lineIds.map(id=>MYOFASCIAL_LINES[id].name).join(', ')}`,...g.consequences,...evidence(g))
  lines.push('BILANCIO MIOFASCIALE')
  for(const line of model.lines.filter(l=>technical||l.globalIndex!==null)) {
    lines.push(`${MYOFASCIAL_LINES[line.lineId].name} · Indice globale: ${functionalPercent(line.globalIndex)} · Copertura: ${line.coverage}%`)
    for(const segment of line.segments.filter(s=>technical||s.index!==null))lines.push(`${FUNCTIONAL_SEGMENT_LABELS[segment.segment]} · ${segment.side==='undetermined'?'':segment.side} · ${functionalPercent(segment.index)}${segment.state!=='undetermined'?` · ${segment.state==='mixed'?'stati misti':FUNCTIONAL_STATE_LABELS[segment.state]}`:''}`,...evidence(segment))
  }
  lines.push('STATI FUNZIONALI TESSUTALI PRESUNTI')
  for(const t of model.tissues.filter(t=>technical||t.state!=='undetermined'))lines.push(`${t.name} · ${t.side} · ${FUNCTIONAL_SEGMENT_LABELS[t.segment]} · ${FUNCTIONAL_STATE_LABELS[t.state]}`,
    ...(t.localIndex!==null?[`Indice locale: ${functionalPercent(t.localIndex)}`]:[]),...(t.segmentIncidence!==null?[`Incidenza segmentaria: ${functionalPercent(t.segmentIncidence)}`]:[]),...(t.globalIncidence!==null?[`Incidenza globale: ${functionalPercent(t.globalIncidence)}`]:[]),...t.consequences,...evidence(t))
  if(technical)for(const c of model.conflicts)lines.push(c.message,...evidence(c))
  return lines
}
