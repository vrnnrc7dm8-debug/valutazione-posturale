import { MYOFASCIAL_LINES, inferTissueState } from '@/data/myofascialLines'
import { resolveAlterationId } from '@/data/alterationAliases'
import { effectiveSideForMyers } from '@/data/directionalDescriptors'
import { getAlterationLabel, getPlaneConfig } from '@/data/planes'
import type {
  AlterationLineInference,
  AlterationMyersInference,
  AlterationSelection,
  AnatomicalPlane,
  Descriptor,
  MyofascialLineId,
  MyofascialLineResult,
  PlaneAssessment,
  Severity,
  Side,
  TissueInvolvement,
} from '@/types'

type LineWeight = Partial<Record<MyofascialLineId, number>>

interface AlterationRule {
  alterationIds: string[]
  lines: LineWeight
  planes?: AnatomicalPlane[]
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  lieve: 1,
  moderato: 2,
  severo: 3,
}

const MIN_LINE_SCORE = 2
const MIN_INSTANCE_LINE_SCORE = 1.5

const GLOBAL_RULES: AlterationRule[] = [
  {
    alterationIds: [
      'deviazione_rachidea_toracica',
      'deviazione_rachidea',
      'scoliosi_funzionale',
      'curva_primaria',
    ],
    lines: { spiral_right: 3, spiral_left: 3, lateral_right: 2, lateral_left: 2 },
    planes: ['frontale_posteriore'],
  },
  {
    alterationIds: ['deviazione_rachidea_cervicale'],
    lines: { spiral_right: 3, spiral_left: 3, superficial_back: 2 },
    planes: ['frontale_posteriore'],
  },
  {
    alterationIds: [
      'deviazione_rachidea_lombare',
      'deviazione_rachidea_lombosacrale',
    ],
    lines: {
      superficial_back: 3,
      functional_back: 2,
      lateral_right: 2,
      lateral_left: 2,
    },
    planes: ['frontale_posteriore'],
  },
  {
    alterationIds: ['deviazione_sacrale'],
    lines: { superficial_back: 3, functional_back: 2, deep_front: 1 },
    planes: ['frontale_posteriore'],
  },
  {
    alterationIds: ['tilt_scapolare', 'asimmetria_scapolare', 'winging_scapolare'],
    lines: { spiral_right: 3, spiral_left: 3, arm_lines: 2 },
    planes: ['frontale_posteriore'],
  },
  {
    alterationIds: ['dislivello_sias', 'tilt_pelvico_anteriore', 'shift_bacino', 'dislivello_psis'],
    lines: { lateral_right: 3, lateral_left: 3, deep_front: 2 },
  },
  {
    alterationIds: [
      'anteriorizzazione_capo',
      'anteriorizzazione_capo_sx',
      'forward_head_posture',
      'forward_head_posture_sx',
    ],
    lines: { superficial_back: 3, superficial_front: 2, deep_front: 2 },
    planes: ['sagittale_destro', 'sagittale_sinistro'],
  },
  {
    alterationIds: [
      'ipercifosi_dorsale',
      'ipercifosi_dorsale_sx',
      'rettilineizzazione_dorsale',
      'rettilineizzazione_dorsale_sx',
    ],
    lines: { superficial_back: 3, functional_back: 2 },
  },
  {
    alterationIds: [
      'iperlordosi_lombare',
      'iperlordosi_lombare_sx',
      'rettilineizzazione_lombare',
      'rettilineizzazione_lombare_sx',
    ],
    lines: { superficial_back: 2, deep_front: 2, functional_back: 2 },
  },
  {
    alterationIds: [
      'tilt_pelvico_anteriore_sag',
      'tilt_pelvico_anteriore_sag_sx',
      'tilt_pelvico_anteriore',
    ],
    lines: { deep_front: 3, superficial_front: 2, lateral_right: 1, lateral_left: 1 },
  },
  {
    alterationIds: [
      'tilt_pelvico_posteriore_sag',
      'tilt_pelvico_posteriore_sag_sx',
    ],
    lines: { superficial_back: 3, functional_back: 2 },
  },
  {
    alterationIds: [
      'rotazione_toracica',
      'torsione_sternale',
      'compensi_crociati',
      'disaccoppiamento_torace_bacino',
    ],
    lines: { spiral_right: 3, spiral_left: 3, functional_front: 2, functional_back: 2 },
    planes: ['trasverso'],
  },
  {
    alterationIds: ['tilt_spalle', 'dislivello_acromiale', 'triangoli_taglia'],
    lines: { lateral_right: 2, lateral_left: 2, superficial_front: 1, arm_lines: 1 },
    planes: ['frontale_anteriore'],
  },
]

function scoreToSeverity(score: number): Severity {
  if (score >= 9) return 'severo'
  if (score >= 5) return 'moderato'
  return 'lieve'
}

function applySideBias(lineId: MyofascialLineId, side?: Side): MyofascialLineId {
  if (!side || side === 'bilaterale') return lineId
  if (lineId === 'lateral_right' && side === 'sinistro') return 'lateral_left'
  if (lineId === 'lateral_left' && side === 'destro') return 'lateral_right'
  if (lineId === 'spiral_right' && side === 'sinistro') return 'spiral_left'
  if (lineId === 'spiral_left' && side === 'destro') return 'spiral_right'
  return lineId
}

function resolveRules(resolvedId: string, plane: AnatomicalPlane): AlterationRule[] {
  return GLOBAL_RULES.filter(
    (r) =>
      r.alterationIds.includes(resolvedId) &&
      (!r.planes || r.planes.includes(plane)),
  )
}

function getFallbackLineWeights(descriptor: Descriptor): LineWeight {
  const fallback: LineWeight = {}
  if (['shift', 'tilt'].includes(descriptor)) {
    fallback.lateral_right = 1
    fallback.lateral_left = 1
  }
  if (descriptor === 'rotation') {
    fallback.spiral_right = 2
    fallback.spiral_left = 2
  }
  if (descriptor === 'bend') {
    fallback.superficial_back = 1
    fallback.functional_back = 1
  }
  if (descriptor === 'compenso') {
    fallback.functional_front = 1
    fallback.functional_back = 1
  }
  return fallback
}

function sideFromLineId(lineId: MyofascialLineId, fallback: Side): Side {
  if (lineId.endsWith('_right')) return 'destro'
  if (lineId.endsWith('_left')) return 'sinistro'
  return fallback
}

function computeInferenceConfidence(
  alteration: AlterationSelection,
  score: number,
  hasExplicitRule: boolean,
): number {
  let confidence = hasExplicitRule ? 0.55 : 0.35
  if (alteration.source === 'confirmed') confidence += 0.15
  else if (alteration.source === 'manual') confidence += 0.1
  if (alteration.severity === 'severo') confidence += 0.12
  else if (alteration.severity === 'moderato') confidence += 0.08
  else confidence += 0.04
  if (alteration.quantitative) confidence += 0.05
  if (score >= 6) confidence += 0.05
  return Math.min(0.95, Math.round(confidence * 100) / 100)
}

function buildTissueInvolvements(
  tissueNames: string[],
  side: Side,
  score: number,
  descriptor: Descriptor,
  lineConfidence: number,
): TissueInvolvement[] {
  return tissueNames.slice(0, 4).map((name, index) => ({
    name,
    side,
    functionalState: inferTissueState(Math.max(1, score - index * 0.75), descriptor),
    confidence: Math.max(0.3, Math.round((lineConfidence - index * 0.08) * 100) / 100),
  }))
}

function scoreAlterationLineWeights(
  alteration: AlterationSelection,
  plane: AnatomicalPlane,
): { scores: Map<MyofascialLineId, number>; hasExplicitRule: boolean } {
  const config = getPlaneConfig(plane)
  const boostLines = new Set(config.primaryMyersLines)
  const resolvedId = resolveAlterationId(alteration.alterationId)
  const effectiveSide = effectiveSideForMyers(alteration)
  const rules = resolveRules(resolvedId, plane)
  const weight = SEVERITY_WEIGHT[alteration.severity]
  const scores = new Map<MyofascialLineId, number>()

  const addWeights = (lines: LineWeight, multiplier = 1) => {
    for (const [lineId, pts] of Object.entries(lines) as [MyofascialLineId, number][]) {
      const target = applySideBias(lineId, effectiveSide)
      const bonus = boostLines.has(target) ? 1.25 : 1
      const lineScore = pts * weight * bonus * multiplier
      scores.set(target, (scores.get(target) ?? 0) + lineScore)
    }
  }

  if (rules.length > 0) {
    for (const rule of rules) addWeights(rule.lines)
  } else {
    addWeights(getFallbackLineWeights(alteration.descriptor), 0.85)
  }

  return { scores, hasExplicitRule: rules.length > 0 }
}

export function inferMyersForAlteration(
  plane: AnatomicalPlane,
  alteration: AlterationSelection,
): AlterationMyersInference {
  const { scores, hasExplicitRule } = scoreAlterationLineWeights(alteration, plane)
  const effectiveSide = effectiveSideForMyers(alteration) ?? 'bilaterale'
  const lines: AlterationLineInference[] = []

  for (const [lineId, score] of scores) {
    if (score < MIN_INSTANCE_LINE_SCORE) continue
    const def = MYOFASCIAL_LINES[lineId]
    const side = sideFromLineId(lineId, effectiveSide)
    const confidence = computeInferenceConfidence(alteration, score, hasExplicitRule)
    lines.push({
      lineId,
      lineName: def.name,
      side,
      score,
      severity: scoreToSeverity(score),
      functionalState: inferTissueState(score, alteration.descriptor),
      confidence,
      tissues: buildTissueInvolvements(
        def.softTissues,
        side,
        score,
        alteration.descriptor,
        confidence,
      ),
    })
  }

  lines.sort((a, b) => b.score - a.score)

  return {
    instanceId: alteration.instanceId,
    alterationId: alteration.alterationId,
    plane,
    lines,
  }
}

export function inferMyersForPlane(
  plane: AnatomicalPlane,
  alterations: AlterationSelection[],
): AlterationMyersInference[] {
  return alterations.map((alt) => inferMyersForAlteration(plane, alt))
}

export function inferMyersForAllPlanes(
  planeAssessments: PlaneAssessment[],
): AlterationMyersInference[] {
  return planeAssessments.flatMap((pa) =>
    pa.alterations.length > 0 ? inferMyersForPlane(pa.plane, pa.alterations) : [],
  )
}

export function formatAlterationMyersSummary(
  plane: AnatomicalPlane,
  inference: AlterationMyersInference,
): string {
  const label = getAlterationLabel(plane, inference.alterationId)
  const top = inference.lines[0]
  if (!top) {
    return `${label}: nessuna linea Myers sopra soglia.`
  }
  const topTissue = top.tissues[0]
  const tissuePart = topTissue
    ? `${topTissue.name} ${topTissue.side} → ${topTissue.functionalState} (${Math.round(topTissue.confidence * 100)}%)`
    : top.functionalState
  return `${label}: ${top.lineName} (${top.side}, ${top.functionalState}, conf. ${Math.round(top.confidence * 100)}%) · ${tissuePart}`
}

function dominantSide(sides: Side[]): Side {
  const c = { destro: 0, sinistro: 0, bilaterale: 0 }
  for (const s of sides) c[s]++
  if (c.destro > c.sinistro) return 'destro'
  if (c.sinistro > c.destro) return 'sinistro'
  return 'bilaterale'
}

export function analyzeMyofascialLinesForPlane(
  plane: AnatomicalPlane,
  alterations: AlterationSelection[],
): MyofascialLineResult[] {
  const aggregated = new Map<MyofascialLineId, { score: number; sides: Side[] }>()

  for (const alt of alterations) {
    const { scores } = scoreAlterationLineWeights(alt, plane)
    const effectiveSide = effectiveSideForMyers(alt)
    for (const [lineId, score] of scores) {
      const cur = aggregated.get(lineId) ?? { score: 0, sides: [] }
      cur.score += score
      if (effectiveSide) cur.sides.push(effectiveSide)
      aggregated.set(lineId, cur)
    }
  }

  const results: MyofascialLineResult[] = []
  for (const [lineId, data] of aggregated) {
    if (data.score < MIN_LINE_SCORE) continue
    const def = MYOFASCIAL_LINES[lineId]
    results.push({
      lineId,
      score: data.score,
      severity: scoreToSeverity(data.score),
      prevalentSide: dominantSide(data.sides),
      possibleState: inferTissueState(data.score),
      involvedDistricts: def.districts,
      softTissues: def.softTissues,
    })
  }
  return results.sort((a, b) => b.score - a.score)
}

export function analyzeAllPlanes(
  planeAssessments: PlaneAssessment[],
): MyofascialLineResult[] {
  const merged = new Map<MyofascialLineId, MyofascialLineResult>()

  for (const pa of planeAssessments) {
    if (pa.alterations.length === 0) continue
    for (const r of analyzeMyofascialLinesForPlane(pa.plane, pa.alterations)) {
      const existing = merged.get(r.lineId)
      if (!existing || r.score > existing.score) {
        merged.set(r.lineId, r)
      } else if (existing) {
        merged.set(r.lineId, {
          ...existing,
          score: existing.score + r.score * 0.5,
          severity: scoreToSeverity(existing.score + r.score * 0.5),
        })
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score)
}
