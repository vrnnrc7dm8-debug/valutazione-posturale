import { hasTransverseInferenceDirection } from '@/data/clinicalOperators'
import { alterationRegion, tissueProximity, isSpinalPhenomenon } from '@/data/tissueDistricts'
import type { ClinicalDirection, SpinalRegion } from '@/types'
import { MYOFASCIAL_LINES, inferTissueState, resolveLinesForOperator, type ClinicalObservationPlane, type FunctionalMovementOperator } from '@/data/myofascialLines'
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

export interface AlterationRule {
  descriptors?: Descriptor[]
  directions?: ClinicalDirection[]
  regions?: SpinalRegion[]
  convexities?: ('dx' | 'sx')[]
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

const OBSERVATION_PLANES: Record<AnatomicalPlane, ClinicalObservationPlane> = {
  frontale_anteriore: 'front_anterior', frontale_posteriore: 'front_posterior',
  sagittale_destro: 'sagittal', sagittale_sinistro: 'sagittal', trasverso: 'transverse',
}

/** Tissue side is an inference output, not a side added to the spinal observation. */
function inferenceSide(a: AlterationSelection): Side | undefined {
  if (a.myersContext) return a.myersContext.side
  if (['dissociazione', 'compenso_crociato', 'taglio_stimato'].includes(a.descriptor)) return a.direction === 'dx' ? 'destro' : a.direction === 'sx' ? 'sinistro' : undefined
  if (isSpinalPhenomenon(a.alterationId)) {
    const convexity = a.anatomicalDetails?.convexity
    if (a.descriptor === 'bend' && (convexity === 'dx' || convexity === 'sx')) return convexity === 'dx' ? 'destro' : 'sinistro'
    if (a.direction === 'dx' || a.direction === 'rotazione_dx') return 'destro'
    if (a.direction === 'sx' || a.direction === 'rotazione_sx') return 'sinistro'
    return undefined
  }
  return effectiveSideForMyers(a)
}

function compatibleLines(plane: AnatomicalPlane, descriptor: Descriptor, side?: Side): Set<MyofascialLineId> {
  if (!['tilt', 'shift', 'bend', 'rotation'].includes(descriptor)) return new Set()
  return new Set(resolveLinesForOperator(OBSERVATION_PLANES[plane], descriptor as FunctionalMovementOperator,
    side === 'destro' ? 'dx' : side === 'sinistro' ? 'sx' : undefined).map(p => p.id))
}

const SPINAL_IDS = ['deviazione_rachidea', 'scoliosi_funzionale', 'curva_primaria', 'deviazione_sacrale',
  'deviazione_rachidea_cervicale', 'deviazione_rachidea_cervico_dorsale', 'deviazione_rachidea_toracica',
  'deviazione_rachidea_toraco_lombare', 'deviazione_rachidea_lombare', 'deviazione_rachidea_lombosacrale']
const REGIONS: SpinalRegion[] = ['cervicale', 'cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale', 'sacrale']

/** Rules specify relative relevance; membership/plane/operator/side compatibility comes from the clinical database. */
function spinalWeights(descriptor: Descriptor, side?: 'dx' | 'sx'): LineWeight {
  const compatible = compatibleLines('frontale_posteriore', descriptor, side === 'dx' ? 'destro' : side === 'sx' ? 'sinistro' : undefined)
  const weights: LineWeight = {}
  for (const id of compatible) {
    if (descriptor === 'shift' && id.startsWith('lateral_')) weights[id] = side ? 2.5 : 0.7
    if (descriptor === 'rotation' && id.startsWith('spiral_')) weights[id] = side ? 2.5 : 0.7
    if (descriptor === 'bend' && id === 'superficial_back') weights[id] = 2
    if (descriptor === 'bend' && side && id.startsWith('spiral_')) weights[id] = 1
  }
  return weights
}

const SPINAL_RULES: AlterationRule[] = REGIONS.flatMap(region =>
  (['shift', 'rotation', 'bend'] as Descriptor[]).flatMap(descriptor => {
    const base: AlterationRule = { alterationIds: SPINAL_IDS, descriptors: [descriptor], regions: [region], planes: ['frontale_posteriore'], lines: spinalWeights(descriptor) }
    return [base, ...(['dx', 'sx'] as const).flatMap(direction => {
      const rule: AlterationRule = { ...base, directions: [descriptor === 'rotation' ? `rotazione_${direction}` : direction], lines: spinalWeights(descriptor, descriptor === 'bend' ? undefined : direction) }
      return descriptor === 'bend' ? [rule, ...(['dx', 'sx'] as const).map(convexity => ({ ...rule, convexities: [convexity], lines: spinalWeights(descriptor, convexity) }))] : [rule]
    })]
  }),
)
// Unknown region still uses the explicit operator, with lower match quality.
const SPINAL_OPERATOR_RULES: AlterationRule[] = (['shift', 'rotation', 'bend'] as Descriptor[]).flatMap(descriptor => [
  { alterationIds: SPINAL_IDS, descriptors: [descriptor], lines: spinalWeights(descriptor), planes: ['frontale_posteriore'] },
  ...(['dx', 'sx'] as const).map(direction => ({ alterationIds: SPINAL_IDS, descriptors: [descriptor],
    directions: [descriptor === 'rotation' ? `rotazione_${direction}` : direction] as ClinicalDirection[],
    lines: spinalWeights(descriptor, descriptor === 'bend' ? undefined : direction), planes: ['frontale_posteriore'] as AnatomicalPlane[] })),
])
const distalCompatible = compatibleLines('frontale_posteriore', 'tilt')
const DISTAL_RULES: AlterationRule[] = [{
  alterationIds: ['asse_calcaneare_post', 'deviazione_achille'], descriptors: ['tilt'],
  directions: ['varo', 'valgo', 'dx', 'sx'], planes: ['frontale_posteriore'],
  lines: Object.fromEntries((['superficial_back', 'lateral_right', 'lateral_left'] as MyofascialLineId[])
    .filter(id => distalCompatible.has(id)).map(id => [id, id === 'superficial_back' ? 1.2 : 1.5])),
}]
const TRANSVERSE_RELATION_RULES: AlterationRule[] = [{
  alterationIds: ['relazione_scapolo_pelvica', 'relazione_cingoli_piedi', 'asimmetria_cingolo_scapolare', 'asimmetria_cingolo_pelvico'],
  descriptors: ['dissociazione', 'compenso_crociato', 'taglio_stimato'], directions: ['dx', 'sx'], planes: ['trasverso'],
  lines: { spiral_right: 2.5, spiral_left: 2.5, functional_back: 2.5 },
}]
export const MYERS_RULES: AlterationRule[] = [...TRANSVERSE_RELATION_RULES, ...SPINAL_RULES, ...SPINAL_OPERATOR_RULES, ...DISTAL_RULES, ...GLOBAL_RULES]

export function ruleSpecificity(rule: AlterationRule): number {
  return (rule.descriptors ? 16 : 0) + (rule.directions ? 8 : 0) + (rule.regions ? 4 : 0) + (rule.convexities ? 2 : 0) + (rule.planes ? 1 : 0)
}
export function resolveMyersRule(plane: AnatomicalPlane, a: AlterationSelection, rules = MYERS_RULES): AlterationRule | undefined {
  const region = alterationRegion(a)
  return rules.filter(r => (r.alterationIds.includes(a.alterationId) || r.alterationIds.includes(resolveAlterationId(a.alterationId))) &&
    (!r.planes || r.planes.includes(plane)) && (!r.descriptors || r.descriptors.includes(a.descriptor)) &&
    (!r.directions || !!a.direction && r.directions.includes(a.direction)) &&
    (!r.regions || r.regions.includes(region as SpinalRegion)) &&
    (!r.convexities || !!a.anatomicalDetails?.convexity && r.convexities.includes(a.anatomicalDetails.convexity as 'dx' | 'sx')))
    .sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a))[0]
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

function computeInferenceConfidence(a: AlterationSelection, rule?: AlterationRule): number {
  let confidence = rule ? 0.4 : 0.25
  if (rule?.descriptors) confidence += 0.1
  if (rule?.directions) confidence += 0.08
  if (rule?.regions) confidence += 0.08
  if (rule?.convexities && a.anatomicalDetails?.convexitySource !== 'derived') confidence += 0.03
  if (a.anatomicalDetails?.convexitySource === 'derived') confidence -= 0.04
  if (a.status === 'confirmed' || a.status === 'modified' || a.source === 'confirmed' || a.source === 'manual') confidence += 0.08
  if (a.quantitative) confidence += 0.05
  if (!inferenceSide(a) || inferenceSide(a) === 'bilaterale') confidence -= 0.08
  // A single pattern is not independent confirmation of a myofascial hypothesis.
  confidence -= 0.05
  return Math.max(0.15, Math.min(0.85, Math.round(confidence * 100) / 100))
}

function buildTissueInvolvements(tissueNames: string[], side: Side, score: number, a: AlterationSelection, lineConfidence: number): TissueInvolvement[] {
  const region = alterationRegion(a)
  return tissueNames.filter(name => tissueProximity(name, region) === 'local').map(name => ({
    name, side, region, proximity: 'local', functionalState: inferTissueState(score, a.descriptor),
    confidence: Math.round(lineConfidence * 0.9 * 100) / 100,
  }))
}

function scoreAlterationLineWeights(
  alteration: AlterationSelection,
  plane: AnatomicalPlane,
): { scores: Map<MyofascialLineId, number>; rule?: AlterationRule } {
  if (plane === 'trasverso' && (!alteration.quantitative || !Number.isFinite(alteration.quantitative.value) || (!hasTransverseInferenceDirection(alteration.descriptor, alteration.direction) && !alteration.myersContext))) return { scores: new Map() }
  const config = getPlaneConfig(plane)
  const boostLines = new Set(config.primaryMyersLines)
  const effectiveSide = inferenceSide(alteration)
  const rule: AlterationRule | undefined = plane === 'trasverso' && alteration.myersContext && ['anteposizione', 'retroposizione'].includes(alteration.descriptor)
    ? { alterationIds: [alteration.alterationId], descriptors: [alteration.descriptor], planes: ['trasverso'], lines: { spiral_right: 2.5, spiral_left: 2.5, functional_back: 2.5 } }
    : resolveMyersRule(plane, alteration)
  const weight = (alteration.myersContext?.intensity ?? SEVERITY_WEIGHT[alteration.severity]) * (plane === 'trasverso' ? 0.5 : 1)
  const scores = new Map<MyofascialLineId, number>()

  const addWeights = (lines: LineWeight, multiplier = 1) => {
    for (const [lineId, pts] of Object.entries(lines) as [MyofascialLineId, number][]) {
      const target = lineId
      if (effectiveSide === 'destro' && /_(left|sx)$/.test(target)) continue
      if (effectiveSide === 'sinistro' && /_(right|dx)$/.test(target)) continue
      const bonus = boostLines.has(target) ? 1.25 : 1
      const lineScore = pts * weight * bonus * multiplier
      scores.set(target, (scores.get(target) ?? 0) + lineScore)
    }
  }

  if (rule) {
    addWeights(rule.lines)
  } else {
    const compatible = compatibleLines(plane, alteration.descriptor, effectiveSide)
    const fallback = Object.fromEntries(Object.entries(getFallbackLineWeights(alteration.descriptor)).filter(([id]) => alteration.descriptor === 'compenso' || compatible.has(id as MyofascialLineId)))
    addWeights(fallback, 0.85)
  }

  return { scores, rule }
}

export function inferMyersForAlteration(
  plane: AnatomicalPlane,
  alteration: AlterationSelection,
): AlterationMyersInference {
  const { scores, rule } = scoreAlterationLineWeights(alteration, plane)
  const effectiveSide = inferenceSide(alteration) ?? 'bilaterale'
  const lines: AlterationLineInference[] = []

  for (const [lineId, score] of scores) {
    if (score < MIN_INSTANCE_LINE_SCORE) continue
    const def = MYOFASCIAL_LINES[lineId]
    const side = sideFromLineId(lineId, effectiveSide)
    const confidence = Math.min(plane === 'trasverso' ? 0.55 : 1, alteration.myersContext?.confidence ?? computeInferenceConfidence(alteration, rule))
    lines.push({
      contextPatternIds: alteration.myersContext?.patternIds, distalEvidence: alteration.myersContext?.distalEvidence,
      ruleSpecificity: rule ? ruleSpecificity(rule) : 0, sourceDescriptor: alteration.descriptor, sourceDirection: alteration.direction, sourceRegion: alterationRegion(alteration),
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
        alteration,
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

  const seenContexts = new Set<string>()
  for (const alt of alterations) {
    if (alt.myersContext) {
      const key = [...alt.myersContext.patternIds].sort().join('|')
      if (seenContexts.has(key)) continue
      seenContexts.add(key)
    }
    const { scores } = scoreAlterationLineWeights(alt, plane)
    const effectiveSide = inferenceSide(alt)
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
      softTissues: [...new Set(alterations.flatMap(a => inferMyersForAlteration(plane, a).lines.filter(l => l.lineId === lineId).flatMap(l => l.tissues.map(t => t.name))))],
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
