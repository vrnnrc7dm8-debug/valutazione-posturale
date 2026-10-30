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
export function functionalModelToLines(model: FunctionalModel): string[] {
  const lines = ['RETE FUNZIONALE / PATTERN GLOBALI', model.methodology, 'LIVELLO 4 — PATTERN LOCALI']
  for (const local of model.localPatterns) lines.push(`${local.family} — ${local.descriptor ? formatOperatorDirection(local.descriptor, local.direction) : 'operatore non registrato'} · ${FUNCTIONAL_SEGMENT_LABELS[local.segment]} · ${local.side ?? 'lato non specificato'} · Indice locale: ${functionalPercent(local.index)} · Coerenza multiplanare: ${local.planes.length}/3`, ...functionalProvenanceLines(local))
  lines.push('LIVELLO 5 — CONFRONTO INTERLATERALE / CROCIATO')
  for (const c of model.comparisons) lines.push(`${c.family}: ${COMPARISON_LABELS[c.relation]}`, ...c.consequences, ...functionalProvenanceLines(c))
  lines.push('LIVELLO 6 — PATTERN GLOBALI DI TENSEGRITÀ (IPOTESI)')
  if (!model.globalPatterns.length) lines.push('Nessun pattern globale sufficientemente supportato; nessuna propagazione automatica.')
  for (const g of model.globalPatterns) lines.push(`${g.kind} · Direzione globale: ${g.direction ?? 'non determinabile'} · Indice globale: ${functionalPercent(g.index)} · Coerenza multiplanare: ${g.planes.length}/3`, `Componenti: ${g.lineIds.map(id => MYOFASCIAL_LINES[id].name).join(', ') || 'da verificare'}`, ...g.consequences, ...functionalProvenanceLines(g))
  lines.push('BILANCIO DEI BINARI MIOFASCIALI — DISTRIBUZIONE SEGMENTARIA')
  for (const line of model.lines) {
    lines.push(`${MYOFASCIAL_LINES[line.lineId].name} · Indice globale: ${functionalPercent(line.globalIndex)} · Direzione: ${line.direction ?? 'non determinabile'} · Copertura: ${line.coverage}% dei segmenti/lati`)
    for (const segment of line.segments) lines.push(`${FUNCTIONAL_SEGMENT_LABELS[segment.segment]} · ${segment.side} · ${functionalPercent(segment.index)} · Stato: ${segment.state === 'mixed' ? 'misto' : FUNCTIONAL_STATE_LABELS[segment.state]}`, ...functionalProvenanceLines(segment))
    lines.push(...functionalProvenanceLines(line))
  }
  lines.push('LIVELLO 3 — STATI FUNZIONALI TESSUTALI PRESUNTI')
  for (const t of model.tissues) lines.push(`${t.name} · Lato inferito/registrato: ${t.side} · Segmento: ${FUNCTIONAL_SEGMENT_LABELS[t.segment]} · ${FUNCTIONAL_STATE_LABELS[t.state]}`,
    `Indice locale: ${functionalPercent(t.localIndex)} · Incidenza sul segmento: ${functionalPercent(t.segmentIncidence)} · Incidenza sulla linea globale: ${functionalPercent(t.globalIncidence)}`,
    `Linee: ${t.lineIds.map(id => MYOFASCIAL_LINES[id].name).join(', ')} · Relazione degli indici controlaterali: ${COMPARISON_LABELS[t.contralateral]}`,
    `Antagonisti supportati: ${t.antagonistTissueIds.join('; ') || 'non determinabili'}`, ...t.uncertainty, ...t.consequences, ...functionalProvenanceLines(t))
  lines.push('DISCORDANZE E CONSEGUENZE BIOMECCANICHE PRESUMIBILI')
  for (const conflict of model.conflicts) lines.push(conflict.message, ...functionalProvenanceLines(conflict))
  for (const local of model.localPatterns) lines.push(...local.consequences)
  return lines
}
