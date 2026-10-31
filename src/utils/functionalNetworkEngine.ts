import { buildFunctionalGlobalPatterns } from './clinicalCorroboration'
import type { PatternRecognitionResult } from '@/types/patternRecognition'
import type { FunctionalLocalPattern, FunctionalSegment } from '@/types/functional'
import { unique, FUNCTIONAL_SEVERITY_WEIGHT, planeFamily } from './functionalEvidence'
import type { AlterationMyersInference, ClinicalObservation, PosturalPattern, TissueFunctionalState } from '@/types'
import type { FunctionalModel } from '@/types/functional'
import type { AutoMeasurement } from './biomechanicsEngine'
import { measurementRecords } from './functionalEvidence'
import { inferLocalFunctionalPatterns, inferFunctionalTissues } from './functionalTissueInference'
import { compareBilateralPatterns } from './bilateralPatternEngine'
import { buildFunctionalNetwork } from './globalTensegrityEngine'
import { balanceMyofascialLines, completeTissueBalance } from './myofascialBalanceEngine'

export function buildFunctionalModel(observations: ClinicalObservation[], patterns: PosturalPattern[], tissues: TissueFunctionalState[], inferences: AlterationMyersInference[], measurements: AutoMeasurement[], recognition?: PatternRecognitionResult): FunctionalModel {
  patterns = patterns.filter(p => p.status === 'confirmed' || p.status === 'modified')
  const localPatterns = inferLocalFunctionalPatterns(patterns, observations, inferences)
  const corroborated = recognition ? buildFunctionalGlobalPatterns(recognition) : []
  const network = buildFunctionalNetwork(localPatterns, compareBilateralPatterns(localPatterns, measurements), patterns, observations, inferences)
  const globals = [...network.globalPatterns, ...corroborated]
  const regionSegment:Record<string,FunctionalSegment>={head:'cervical',cervical:'cervical',thoracic:'vertebral',lumbar:'vertebral',scapular:'scapular',pelvic:'pelvic',lower_limb:'crural',distal:'foot'}
  if (recognition) for (const evidence of recognition.evidence.filter(e => !e.derived && e.reportEligible && e.severity !== 'normale')) {
    const sources = corroborated.filter(g=>recognition.globalPatterns.find(p=>p.id===g.posturalPatternId)?.evidenceIds.includes(evidence.id))
    if (!sources.length) continue
    const lineIds=unique(sources.flatMap(g=>g.lineIds)).filter(id=>!id.startsWith('lateral_')||!evidence.convexityDirection||id===(evidence.convexityDirection==='sx'?'lateral_left':'lateral_right'))
    const existing=localPatterns.filter(l=>evidence.sourceObservationIds.some(id=>l.sourceObservationIds.includes(id)))
    if(existing.length) { for(const local of existing)local.lineIds=unique([...local.lineIds,...lineIds]); continue }
    const local:FunctionalLocalPattern={id:`functional-geometric:${evidence.id}`,segment:regionSegment[evidence.region],region:evidence.region,
      side:evidence.side, family:evidence.description, descriptor:evidence.tags.includes('spinal_curve')?'bend':evidence.tags.includes('axial_rotation')?'rotation':evidence.tags.includes('tilt')?'tilt':'shift',
      direction:['dx','sx','anteriore','posteriore','rotazione_dx','rotazione_sx'].includes(evidence.direction??'')?evidence.direction as FunctionalLocalPattern['direction']:undefined,
      index:Math.round(FUNCTIONAL_SEVERITY_WEIGHT[evidence.severity as 'lieve'|'moderato'|'severo']*100*Math.max(...sources.map(g=>g.supportScore??0))),
      planes:[planeFamily(evidence.plane)],lineIds,comparisonIds:[],consequences:['Possibile adattamento locale nel pattern globale corroborato.'],
      sourceObservationIds:evidence.sourceObservationIds,sourceMeasurementIds:evidence.sourceMeasurementIds,sourcePatternIds:evidence.sourcePatternIds}
    localPatterns.push(local)
  }
  const comparisons = compareBilateralPatterns(localPatterns, measurements)
  const covered = new Set(globals.flatMap(g=>g.sourcePatternIds))
  // A tissue hypothesis is evaluated only after a global functional context is available.
  const tissueHypotheses = inferFunctionalTissues(tissues, patterns.filter(p=>covered.has(p.id)), observations, localPatterns)
  const lines = balanceMyofascialLines(localPatterns, tissueHypotheses, globals)
  return { version: 'functional-network-v1', methodology: 'Indici funzionali stimati, euristici e non validati: non sono percentuali anatomiche, attività muscolare misurata, probabilità diagnostiche o forze. Il modello di rete non è una simulazione fisica della tensegrità.',
    measurements: measurementRecords(observations, measurements), localPatterns: localPatterns.map(l => ({ ...l, comparisonIds: comparisons.filter(c => [...c.rightPatternIds, ...c.leftPatternIds].includes(l.id)).map(c => c.id) })),
    comparisons, tissues: completeTissueBalance(tissueHypotheses, lines), lines, ...network, globalPatterns:globals }
}
