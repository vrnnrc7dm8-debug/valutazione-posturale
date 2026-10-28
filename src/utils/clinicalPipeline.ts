import { observationDescriptor, formatOperatorDirection } from '@/data/clinicalOperators'
import { observationsFromAutoMeasurements, mergeAutomaticObservations } from './automaticObservations'
import type { AutoMeasurement } from './biomechanicsEngine'
import type { AlterationSelection, ClinicalObservation, PosturalPattern, TissueFunctionalState, PlaneAssessment, AlterationMyersInference } from '@/types'
import { getAlterationsForPlane } from '@/data/planes'
import { inferMyersForAlteration } from './myersEngine'
import { resolveTissueFunctionalState } from '@/data/myofascialLines'

/** Alias clinici, separati dagli alias di migrazione per non riscrivere l'archivio. */
export function canonicalPhenomenon(id: string): string {
  const normalized = id.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'rotazione_femorale_stimata') return 'rotazione_arto_inferiore'
  if (normalized === 'inclinazione_bipupillare') return 'inclinazione_linea_bipupillare'
  if (/^(forward_head(_posture)?|anteriorizzazione_(capo|testa))(_sx)?$/.test(normalized)) return 'anteriorizzazione_capo'
  if (/^(scoliosi_funzionale|deviazione_rachidea)(_|$)/.test(normalized)) return 'deviazione_rachidea'
  return normalized.replace(/_sx$/, '')
}

export function observationsFromAssessments(planes: PlaneAssessment[]): ClinicalObservation[] {
  return planes.flatMap(pa => pa.alterations.map(a => {
    const definition = getAlterationsForPlane(pa.plane).find(d => d.id === a.alterationId)
    const phenomenon = a.alterationId === 'asse_femoro_tibiale' && a.descriptor === 'rotation' ? 'rotazione_arto_inferiore' : canonicalPhenomenon(a.alterationId)
    const region = a.alterationId.match(/^deviazione_rachidea_(cervicale|toracica|lombare|lombosacrale)$/)?.[1] as NonNullable<PosturalPattern['anatomicalDetails']>['region']
    return {
      id: a.instanceId, plane: pa.plane, district: a.district ?? definition?.district ?? 'globale',
      phenomenon, descriptor: a.descriptor, side: a.side, direction: a.descriptor === 'compenso' ? undefined : a.direction, severity: a.severity,
      quantitative: a.quantitative, source: a.source === 'manual' || !a.source ? 'manual' : 'automatic_suggestion',
      sourceIds: [a.suggestionKey ?? a.instanceId], status: a.status ?? (a.source === 'suggested' ? 'suggested' : 'confirmed'),
      anatomicalDetails: phenomenon === 'deviazione_rachidea'
        ? { region: region ?? 'indeterminata', convexity: 'indeterminata', ...a.anatomicalDetails } : a.anatomicalDetails,
      patternId: a.patternId, notes: a.note,
    } satisfies ClinicalObservation
  }))
}

export function consolidateObservations(observations: ClinicalObservation[]): PosturalPattern[] {
  const groups = new Map<string, ClinicalObservation[]>()
  for (const o of observations) {
    if (o.status === 'excluded' || o.status === 'suggested') continue
    const details = o.anatomicalDetails
    const phenomenon = canonicalPhenomenon(o.phenomenon)
    const direction = phenomenon === 'anteriorizzazione_capo' && (!o.direction || o.direction === 'anteriore') ? 'anteriorizzazione'
      : ['dislivello_acromiale', 'dislivello_sias', 'inclinazione_linea_bipupillare'].includes(phenomenon) ? o.direction ?? (o.side === 'destro' ? 'dx' : o.side === 'sinistro' ? 'sx' : undefined) : o.direction
    const key = JSON.stringify([o.plane, observationDescriptor(phenomenon, o.plane, o.descriptor), o.patternId ?? [canonicalPhenomenon(o.phenomenon), o.district, o.side ?? '', direction ?? '',
      details?.region ?? 'indeterminata', details?.level ?? '', details?.apex ?? '', details?.convexity ?? 'indeterminata', details?.startLevel ?? '', details?.endLevel ?? '']])
    groups.set(key, [...(groups.get(key) ?? []), o])
  }
  return [...groups.entries()].map(([key, members]) => {
    // Le correzioni cliniche hanno priorità, senza sommare la severità dei duplicati.
    const selected = members.find(o => o.status === 'modified') ?? members.find(o => o.source === 'manual') ?? members[0]
    const sources = new Set(members.map(o => o.source))
    return {
      id: `pattern:${key}`, plane: selected.plane, district: selected.district,
      phenomenon: canonicalPhenomenon(selected.phenomenon), descriptor: observationDescriptor(selected.phenomenon, selected.plane, selected.descriptor), side: selected.side,
      direction: selected.descriptor === 'compenso' ? undefined : selected.direction, severity: selected.severity,
      observationIds: members.map(o => o.id), anatomicalDetails: selected.anatomicalDetails,
      source: sources.size > 1 ? 'mixed' : selected.source === 'manual' ? 'manual' : 'derived',
      status: selected.status, notes: selected.notes,
    }
  })
}

/** Adattatore alle regole Myers esistenti: una sola istanza per pattern. */
export function patternSelection(p: PosturalPattern): AlterationSelection {
  const regionalId = p.phenomenon === 'deviazione_rachidea'
    ? `deviazione_rachidea_${p.anatomicalDetails?.region ?? 'indeterminata'}` : p.phenomenon
  const compatibleId = p.phenomenon === 'inclinazione_linea_bipupillare' ? 'inclinazione_bipupillare' : p.phenomenon === 'rotazione_arto_inferiore' ? 'rotazione_femorale_stimata' : regionalId
  const alterationId = getAlterationsForPlane(p.plane).some(a => a.id === compatibleId) ? compatibleId
    : p.phenomenon === 'deviazione_rachidea' ? 'scoliosi_funzionale' : p.phenomenon
  return {
    instanceId: p.id, alterationId, descriptor: observationDescriptor(p.phenomenon, p.plane, p.descriptor),
    side: p.side, direction: p.descriptor === 'compenso' ? undefined : p.direction, severity: p.severity ?? 'lieve',
    source: p.source === 'manual' ? 'manual' : 'confirmed', status: p.status,
    district: p.district, anatomicalDetails: p.anatomicalDetails, note: p.notes,
  }
}

export function inferMyersFromPatterns(patterns: PosturalPattern[]): AlterationMyersInference[] {
  return patterns.filter(p => p.status !== 'excluded' && p.status !== 'suggested')
    .map(p => inferMyersForAlteration(p.plane, patternSelection(p)))
}

export function consolidateTissueEvidence(evidence: TissueFunctionalState[]): TissueFunctionalState[] {
  const groups = new Map<string, TissueFunctionalState[]>()
  for (const e of evidence) {
    const key = `${e.tissueId.trim().toLocaleLowerCase('it')}::${e.side}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  return [...groups.values()].map(items => {
    const unique = <T,>(values: T[]) => [...new Set(values)]
    const lengths = unique(items.map(e => e.lengthState).filter(s => s !== 'unknown'))
    const conflict = items.some(e => e.conflict) || lengths.length > 1
    const mobility = unique(items.map(e => e.mobilityState).filter(s => s !== 'unknown'))
    const roles = unique(items.map(e => e.functionalRole).filter(s => s !== 'unknown'))
    return {
      ...items[0], lengthState: conflict ? 'unknown' : lengths[0] ?? 'unknown',
      mobilityState: mobility.length === 1 ? mobility[0] : 'unknown',
      functionalRole: roles.length === 1 ? roles[0] : 'unknown',
      evidence: unique(items.flatMap(e => e.evidence)), observationIds: unique(items.flatMap(e => e.observationIds)),
      sourceLineIds: unique(items.flatMap(e => e.sourceLineIds)),
      // Le fonti correlate non sono prove statisticamente indipendenti.
      confidence: Math.max(...items.map(e => e.confidence)), conflict,
      conflictingEvidence: conflict ? unique(items.flatMap(e => [...e.evidence, ...e.conflictingEvidence])) : [],
    }
  })
}

export function runClinicalPipeline(planes: PlaneAssessment[], measurements: AutoMeasurement[] = []) {
  const observations = mergeAutomaticObservations([
    ...observationsFromAssessments(planes), ...planes.flatMap(p => p.observations ?? []),
  ], observationsFromAutoMeasurements(measurements))
  const patterns = consolidateObservations(observations)
  const inferences = inferMyersFromPatterns(patterns)
  const tissues = consolidateTissueEvidence(inferences.flatMap(inference => {
    const pattern = patterns.find(p => p.id === inference.instanceId)!
    return inference.lines.flatMap(line => line.tissues.map(t => {
      const state = resolveTissueFunctionalState(t.name, line.score, undefined, inference.alterationId, t.functionalState)
      return {
        tissueId: t.name.trim().toLowerCase(), name: t.name, side: t.side,
        lengthState: state === 'accorciamento' ? 'shortened' : state === 'allungamento' ? 'lengthened' : 'unknown',
        mobilityState: state === 'fissazione' ? 'fixed' : 'unknown',
        functionalRole: state === 'compenso' ? 'compensatory' : 'unknown',
        evidence: [pattern.id], observationIds: pattern.observationIds,
        sourceLineIds: [line.lineId], confidence: t.confidence, conflict: false, conflictingEvidence: [],
      } satisfies TissueFunctionalState
    }))
  }))
  const consolidatedPlanes = planes.map(pa => ({ plane: pa.plane, alterations: patterns.filter(p => p.plane === pa.plane).map(patternSelection) }))
  return { observations, patterns, inferences, tissues, consolidatedPlanes }
}

export function formatPattern(p: PosturalPattern): string {
  const d = p.anatomicalDetails
  const label = ['tilt_capo', 'shift_capo', 'rotazione_capo'].includes(p.phenomenon) ? 'Capo' : p.phenomenon === 'deviazione_rachidea' && d?.region === 'cervicale' ? 'Deviazione cervicale' : p.phenomenon.replaceAll('_', ' ')
  return [`${label} — ${formatOperatorDirection(observationDescriptor(p.phenomenon, p.plane, p.descriptor), p.direction)}`, p.side, p.severity,
    d && `Regione: ${d.region ?? 'indeterminata'} · Convessità: ${d.convexity ?? 'indeterminata'}`,
    d?.apex && `Apice: ${d.apex}`, d?.level && `Livello: ${d.level}`,
    d?.startLevel && `Inizio: ${d.startLevel}`, d?.endLevel && `Fine: ${d.endLevel}`, p.notes].filter(Boolean).join(' · ')
}

export function formatTissueState(t: TissueFunctionalState): string {
  const length = { shortened: 'accorciamento', lengthened: 'allungamento', neutral: 'neutro', unknown: 'indeterminato' }
  const mobility = { fixed: 'fissazione', restricted: 'possibile restrizione', mobile: 'mobile', unknown: 'indeterminata' }
  const role = { primary: 'primario', compensatory: 'compensatorio', associated: 'associato', unknown: 'indeterminato' }
  return `${t.name} ${t.side} · Lunghezza: ${length[t.lengthState]}${t.conflict ? ' — evidenza discordante' : ''} · Mobilità: ${mobility[t.mobilityState]} · Ruolo: ${role[t.functionalRole]} · ${t.observationIds.length} osservazioni · conf. ${Math.round(t.confidence * 100)}%`
}

/** Conserva l'identità del suggerimento anche dopo una correzione del lato. */
export function applyClinicalEdit(a: AlterationSelection, patch: Partial<AlterationSelection>): AlterationSelection {
  return {
    ...a, ...patch, instanceId: a.instanceId,
    status: patch.status ?? (patch.source === 'confirmed' ? 'confirmed' : 'modified'),
    suggestionKey: a.suggestionKey ?? (a.source && a.source !== 'manual' ? `${a.alterationId}:${a.side ?? 'none'}` : undefined),
  }
}

/** Mantiene le osservazioni sorgente, evitando di ripetere gli alias nella presentazione. */
export function observationSummaries(observations: ClinicalObservation[]): string[] {
  return [...new Set(observations.filter(o => o.status !== 'excluded' && o.status !== 'suggested').map(o =>
    `${o.plane.replaceAll('_', ' ')}: ${canonicalPhenomenon(o.phenomenon).replaceAll('_', ' ')} · ${o.side ?? 'lato indeterminato'} · ${formatOperatorDirection(observationDescriptor(o.phenomenon, o.plane, o.descriptor), o.direction)} · ${o.severity ?? 'grado indeterminato'}${o.quantitative ? ` · ${o.quantitative.value} ${o.quantitative.unit}` : ''}`,
  ))]
}
