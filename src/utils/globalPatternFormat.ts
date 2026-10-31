import { GLOBAL_SUPPORT_LABELS } from './clinicalCorroboration'
import { PATTERN_REGION_LABELS } from './patternRecognition'
import type { PatternRecognitionResult } from '@/types/patternRecognition'
import { functionalProvenanceLines } from './functionalFormat'
export function recognizedPatternReportLines(result:PatternRecognitionResult, technical = false):string[] {
  const lines=['PATTERN POSTURALI REGIONALI E GLOBALI','Ipotesi fotografiche descrittive, non diagnosi strutturali. Nessuna causalità ascendente/discendente dedotta.']
  for(const r of result.regionalPatterns)lines.push(`${r.name??`Pattern regionale ${PATTERN_REGION_LABELS[r.region]}`} · ${r.severity} · ${r.interpretation??''} · Piani: ${r.supportedPlanes.join(', ')}`, ...(r.components??[]))
  for(const g of result.globalPatterns.filter(p=>p.reportEligible))lines.push(`${g.name} — ${g.direction}${g.prevalentSide?` · Bilaterale, prevalenza ${g.prevalentSide==='sinistro'?'SX':'DX'}`:''}`,`Indice funzionale stimato: ${g.functionalIntensity}% (euristico, non anatomico) · ${g.severity}`,`Stato: ${g.corroboration?.eligible?'pattern funzionale corroborato':g.confirmed?'fonti confermate clinicamente':'ipotesi fotografica non corroborata'}`,`Piani: ${g.supportedPlanes.join(', ')} · Regioni: ${g.regionsInvolved.map(r=>PATTERN_REGION_LABELS[r]).join(', ')} · Riscontri indipendenti: ${g.independentEvidenceCount}`,'Perché questo pattern?',...(g.supportScore!==undefined?[`Supporto stimato: ${Math.round(g.supportScore*100)}% · ${g.supportTypes?.map(t=>GLOBAL_SUPPORT_LABELS[t]).join('; ')}`]:[]),...g.explanation,...g.consequences,...(technical?functionalProvenanceLines(g):[]))
  return lines
}
