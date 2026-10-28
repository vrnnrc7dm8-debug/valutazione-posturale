import { resolveAlterationId } from '@/data/alterationAliases'
import { resolveTissueFunctionalState } from '@/data/myofascialLines'
import { getAlterationLabel } from '@/data/planes'
import type {
  AlterationMyersInference,
  AlterationSelection,
  AlterationTissueAnalysis,
  AnatomicalPlane,
  MyofascialLineId,
  PlaneAssessment,
  RankedTissueFinding,
  Side,
  TissueState,
} from '@/types'
import { TISSUE_STATE_LABELS } from '@/types'
import { inferMyersForAllPlanes, inferMyersForPlane } from '@/utils/myersEngine'

function tissueKey(name: string, side: Side): string {
  return `${name.trim().toLowerCase()}::${side}`
}

function mergeFinding(
  existing: RankedTissueFinding,
  incoming: RankedTissueFinding,
): RankedTissueFinding {
  return {
    ...existing,
    score: existing.score + incoming.score * 0.35,
    confidence: Math.max(existing.confidence, incoming.confidence),
    sourceLineIds: [...new Set([...existing.sourceLineIds, ...incoming.sourceLineIds])],
    sourceLineNames: [
      ...new Set([...existing.sourceLineNames, ...incoming.sourceLineNames]),
    ],
    functionalState:
      incoming.confidence > existing.confidence
        ? incoming.functionalState
        : existing.functionalState,
  }
}

function buildRankedFinding(
  inference: AlterationMyersInference,
  tissueName: string,
  side: Side,
  lineScore: number,
  tissueConfidence: number,
  fallbackState: TissueState,
  lineId: MyofascialLineId,
  lineName: string,
  resolvedAlterationId: string,
  descriptor?: AlterationSelection['descriptor'],
): RankedTissueFinding {
  const functionalState = resolveTissueFunctionalState(
    tissueName,
    lineScore,
    descriptor,
    resolvedAlterationId,
    fallbackState,
  )
  return {
    name: tissueName,
    side,
    functionalState,
    confidence: tissueConfidence,
    score: lineScore * tissueConfidence,
    sourceLineIds: [lineId],
    sourceLineNames: [lineName],
    instanceId: inference.instanceId,
    alterationId: inference.alterationId,
    plane: inference.plane,
  }
}

export function analyzeTissuesForAlteration(
  inference: AlterationMyersInference,
  alteration?: AlterationSelection,
): AlterationTissueAnalysis {
  const resolvedId = resolveAlterationId(inference.alterationId)
  const descriptor = alteration?.descriptor
  const merged = new Map<string, RankedTissueFinding>()

  for (const line of inference.lines) {
    for (const tissue of line.tissues) {
      const key = tissueKey(tissue.name, tissue.side)
      const finding = buildRankedFinding(
        inference,
        tissue.name,
        tissue.side,
        line.score,
        tissue.confidence,
        tissue.functionalState,
        line.lineId,
        line.lineName,
        resolvedId,
        descriptor,
      )
      const existing = merged.get(key)
      merged.set(key, existing ? mergeFinding(existing, finding) : finding)
    }
  }

  return {
    instanceId: inference.instanceId,
    alterationId: inference.alterationId,
    plane: inference.plane,
    tissues: [...merged.values()].sort((a, b) => b.score - a.score),
  }
}

export function analyzeTissuesForPlane(
  plane: AnatomicalPlane,
  alterations: AlterationSelection[],
  inferences?: AlterationMyersInference[],
): AlterationTissueAnalysis[] {
  const myersInferences =
    inferences ?? inferMyersForPlane(plane, alterations)
  const byInstance = new Map(alterations.map((a) => [a.instanceId, a]))

  return myersInferences.map((inf) =>
    analyzeTissuesForAlteration(inf, byInstance.get(inf.instanceId)),
  )
}

export function analyzeAllTissues(
  planeAssessments: PlaneAssessment[],
): RankedTissueFinding[] {
  const inferences = inferMyersForAllPlanes(planeAssessments)
  const alterationByInstance = new Map<string, AlterationSelection>()
  for (const pa of planeAssessments) {
    for (const alt of pa.alterations) {
      alterationByInstance.set(alt.instanceId, alt)
    }
  }

  const global = new Map<string, RankedTissueFinding>()
  for (const inf of inferences) {
    const analysis = analyzeTissuesForAlteration(
      inf,
      alterationByInstance.get(inf.instanceId),
    )
    for (const tissue of analysis.tissues) {
      const key = tissueKey(tissue.name, tissue.side)
      const existing = global.get(key)
      global.set(key, existing ? mergeFinding(existing, tissue) : tissue)
    }
  }

  return [...global.values()].sort((a, b) => b.score - a.score)
}

export function formatTissueFinding(finding: RankedTissueFinding): string {
  const state = TISSUE_STATE_LABELS[finding.functionalState]
  return `${finding.name} ${finding.side} → ${state} (${Math.round(finding.confidence * 100)}%)`
}

export function formatAlterationTissueSummary(
  plane: AnatomicalPlane,
  analysis: AlterationTissueAnalysis,
): string {
  const label = getAlterationLabel(plane, analysis.alterationId)
  const top = analysis.tissues.slice(0, 3)
  if (top.length === 0) {
    return `${label}: nessun tessuto miofasciale sopra soglia.`
  }
  return `${label}: ${top.map(formatTissueFinding).join('; ')}`
}

export function formatRankedTissuesForExport(findings: RankedTissueFinding[]): string[] {
  return findings.map(
    (f) =>
      `${f.name} (${f.side}, ${TISSUE_STATE_LABELS[f.functionalState]}, conf. ${Math.round(f.confidence * 100)}%)`,
  )
}
