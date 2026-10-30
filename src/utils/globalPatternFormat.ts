import { PATTERN_REGION_LABELS } from './patternRecognition'
import type { PatternRecognitionResult } from '@/types/patternRecognition'
import { functionalProvenanceLines } from './functionalFormat'
export function recognizedPatternReportLines(result:PatternRecognitionResult):string[] {
  const lines=['PATTERN POSTURALI REGIONALI E GLOBALI','Ipotesi fotografiche descrittive, non diagnosi strutturali. Nessuna causalità ascendente/discendente dedotta.']
  for(const r of result.regionalPatterns)lines.push(`Pattern regionale ${PATTERN_REGION_LABELS[r.region]} · ${r.severity} · ${r.directions.join('; ')} · Piani: ${r.supportedPlanes.join(', ')}`)
  for(const g of result.globalPatterns.filter(p=>p.reportEligible))lines.push(`${g.name} — ${g.direction}`,`Indice funzionale stimato: ${g.functionalIntensity}% (euristico, non anatomico) · ${g.severity}`,`Stato: ${g.confirmed?'fonti confermate clinicamente':'ipotesi fotografica da verificare; nessun ingresso automatico in Myers'}`,`Piani: ${g.supportedPlanes.join(', ')} · Regioni: ${g.regionsInvolved.map(r=>PATTERN_REGION_LABELS[r]).join(', ')} · Riscontri indipendenti: ${g.independentEvidenceCount}`,'Perché questo pattern?',...g.explanation,...g.consequences,...functionalProvenanceLines(g))
  return lines
}
