import type { AlterationMyersInference, ClinicalObservation, PosturalPattern, TissueFunctionalState } from '@/types'
import type { FunctionalModel } from '@/types/functional'
import type { AutoMeasurement } from './biomechanicsEngine'
import { measurementRecords } from './functionalEvidence'
import { inferLocalFunctionalPatterns, inferFunctionalTissues } from './functionalTissueInference'
import { compareBilateralPatterns } from './bilateralPatternEngine'
import { buildFunctionalNetwork } from './globalTensegrityEngine'
import { balanceMyofascialLines, completeTissueBalance } from './myofascialBalanceEngine'

export function buildFunctionalModel(observations: ClinicalObservation[], patterns: PosturalPattern[], tissues: TissueFunctionalState[], inferences: AlterationMyersInference[], measurements: AutoMeasurement[]): FunctionalModel {
  patterns = patterns.filter(p => p.status === 'confirmed' || p.status === 'modified')
  const localPatterns = inferLocalFunctionalPatterns(patterns, observations, inferences)
  const comparisons = compareBilateralPatterns(localPatterns, measurements)
  const tissueHypotheses = inferFunctionalTissues(tissues, patterns, observations, localPatterns)
  const network = buildFunctionalNetwork(localPatterns, comparisons, patterns, observations, inferences)
  const lines = balanceMyofascialLines(localPatterns, tissueHypotheses, network.globalPatterns)
  return { version: 'functional-network-v1', methodology: 'Indici funzionali stimati, euristici e non validati: non sono percentuali anatomiche, attività muscolare misurata, probabilità diagnostiche o forze. Il modello di rete non è una simulazione fisica della tensegrità.',
    measurements: measurementRecords(observations, measurements), localPatterns: localPatterns.map(l => ({ ...l, comparisonIds: comparisons.filter(c => [...c.rightPatternIds, ...c.leftPatternIds].includes(l.id)).map(c => c.id) })),
    comparisons, tissues: completeTissueBalance(tissueHypotheses, lines), lines, ...network }
}
