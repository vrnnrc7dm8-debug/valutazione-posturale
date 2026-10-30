import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ClinicalObservation, PosturalPattern, AlterationMyersInference } from '@/types'
import { FunctionalNetworkPanel } from '@/components/FunctionalNetworkPanel'
import { buildFunctionalModel } from '../functionalNetworkEngine'
import { consolidateObservations, runClinicalPipeline } from '../clinicalPipeline'
import { functionalModelToLines } from '../functionalFormat'
import type { AutoMeasurement } from '../biomechanicsEngine'

const obs = (id: string, patch: Partial<ClinicalObservation> = {}): ClinicalObservation => ({
  id, plane: 'sagittale_sinistro', district: 'arto_inferiore', phenomenon: 'recurvatum', side: 'sinistro', descriptor: 'bend',
  severity: 'moderato', source: 'manual', sourceIds: [id], status: 'confirmed', quantitative: { value: 14.8, unit: 'gradi' }, ...patch,
})
const inference = (p: PosturalPattern): AlterationMyersInference => ({
  instanceId: p.id, plane: p.plane, alterationId: p.phenomenon, lines: [{ lineId: 'superficial_back', lineName: 'LSP', severity: 'moderato', functionalState: 'compenso', score: 2, side: p.side ?? 'bilaterale', confidence: .5, tissues: [] }],
})
function model(observations: ClinicalObservation[], measurements: AutoMeasurement[] = []) {
  const patterns = consolidateObservations(observations)
  return buildFunctionalModel(observations, patterns, [], patterns.map(inference), measurements)
}
const kneeLeft = obs('left')
const kneeRight = obs('right', { side: 'destro', phenomenon: 'flessione_ginocchio', plane: 'sagittale_destro' })
const pelvis = obs('pelvis', { district: 'pelvico', phenomenon: 'posizione_ileo', plane: 'trasverso', descriptor: 'retroposizione', side: 'sinistro' })
const scapula = obs('scapula', { district: 'cintura_scapolare', phenomenon: 'posizione_scapulum', plane: 'trasverso', descriptor: 'anteposizione', side: 'destro' })
const relation = obs('relation', { district: 'globale', phenomenon: 'relazione_scapolo_pelvica', plane: 'trasverso', descriptor: 'compenso_crociato', side: 'destro', transverseRelation: { relationType: 'compenso_crociato', reference: 'scapulum_ileo', referenceSide: 'sx', orientation: 'dx_anteposto', orientationSource: 'manual' } })

describe('rete funzionale: scenari sintetici, non regole cliniche', () => {
  it('A: SX isolato, DX normale misurato; nessuna falsa simmetria o propagazione', () => {
    const left = obs('left', { phenomenon: 'asse_femoro_tibiale', direction: 'valgo', plane: 'frontale_anteriore' })
    const normal = { id: 'asse_femoro_tibiale_destro', plane: 'frontale_anteriore', side: 'destro', severity: 'normale', numericValue: 176, unit: 'gradi', label: 'Asse DX' } as AutoMeasurement
    const result = model([left], [normal])
    expect(result.localPatterns).toHaveLength(1)
    expect(result.comparisons[0]).toMatchObject({ relation: 'greater_left', normalSide: 'destro' })
    expect(result.globalPatterns).toEqual([])
    expect(model([left]).comparisons[0].relation).toBe('not_comparable')
    expect(result.lines.every(l => l.segments.filter(s => s.side === 'destro').every(s => s.index === null))).toBe(true)
  })
  it('B: opposti sagittali bilaterali sono un contrasto locale, non una Spirale globale', () => {
    const result = model([kneeLeft, kneeRight])
    expect(result.comparisons[0].relation).toBe('opposite')
    expect(result.edges.some(e => e.kind === 'opposition')).toBe(true)
    expect(result.globalPatterns).toEqual([])
  })
  it('C/D: una relazione pelvica confermata abilita il crociato, la scapola completa il pattern globale', () => {
    const c = model([kneeLeft, kneeRight, pelvis, relation])
    expect(c.globalPatterns.some(g => g.kind === 'torsional' && g.direction === 'DX→SX')).toBe(true)
    const d = model([kneeLeft, kneeRight, pelvis, scapula, relation])
    const global = d.globalPatterns.find(g => g.kind === 'global_tensegrity')!
    expect(global).toBeDefined()
    expect(global.direction).toBe('DX→SX')
    expect(global.index).toBeGreaterThan(model([kneeLeft]).localPatterns[0].index!)
    expect(global.sourceObservationIds).toEqual(expect.arrayContaining(['left', 'right', 'pelvis', 'scapula', 'relation']))
    expect(model([kneeLeft, kneeRight, pelvis, scapula, { ...relation, status: 'suggested' }]).globalPatterns).toEqual([])
  })
  it('E: reperti discordanti sullo stesso lato non sono sintetizzati forzatamente', () => {
    const result = model([kneeLeft, { ...kneeRight, side: 'sinistro' }, pelvis, relation])
    expect(result.conflicts.length).toBeGreaterThan(0)
    expect(result.globalPatterns).toEqual([])
  })
  it('F: severità monotona senza conversione della geometria in lunghezza muscolare', () => {
    const values = (['lieve', 'moderato', 'severo'] as const).map(severity => model([{ ...kneeLeft, severity }]).localPatterns[0].index!)
    expect(values[0]).toBeLessThan(values[1]); expect(values[1]).toBeLessThan(values[2])
    expect(model([{ ...kneeLeft, quantitative: { value: 165.4, unit: 'gradi' } }]).localPatterns[0].index).toBe(values[1])
  })
  it('G: supporto indipendente su 1/2/3 piani aumenta la coerenza, senza contare duplicati', () => {
    const a = obs('a', { phenomenon: 'anteriorizzazione_capo', district: 'cranio_cervicale', descriptor: 'shift', direction: 'anteriore' })
    const b = { ...a, id: 'b', plane: 'frontale_posteriore' as const, sourceIds: ['b'] }
    const c = { ...a, id: 'c', plane: 'trasverso' as const, sourceIds: ['c'] }
    const results = [[a], [a,b], [a,b,c]].map(items => model(items).localPatterns[0])
    expect(results.map(r => r.planes.length)).toEqual([1,2,3])
    expect(results[0].index!).toBeLessThan(results[1].index!); expect(results[1].index!).toBeLessThan(results[2].index!)
    expect(model([a, { ...a, id: 'duplicate' }]).localPatterns[0].index).toBe(results[0].index)
    const reused = { ...b, sourceIds: ['automatic_measurement:shared'] }
    expect(model([{ ...a, sourceIds: reused.sourceIds }, reused]).localPatterns[0].planes).toHaveLength(1)
  })
  it('mantiene geometria, provenienza risolvibile, indici finiti e snapshot JSON; rende UI e testo', () => {
    const observations = [kneeLeft, kneeRight, pelvis, scapula, relation], before = structuredClone(observations)
    const result = model(observations)
    expect(observations).toEqual(before)
    expect(result.measurements.find(m => m.id === 'recorded_measurement:left')?.value).toBe(14.8)
    const patterns = consolidateObservations(observations), mids = new Set(result.measurements.map(m => m.id))
    for (const value of [...result.localPatterns, ...result.comparisons, ...result.edges, ...result.lines, ...result.tissues, ...result.globalPatterns]) {
      expect(value.sourceObservationIds.every(id => observations.some(o => o.id === id))).toBe(true)
      expect(value.sourceMeasurementIds.every(id => mids.has(id))).toBe(true)
      expect(value.sourcePatternIds.every(id => patterns.some(p => p.id === id))).toBe(true)
    }
    for (const line of result.lines) {
      expect(line.segments.reduce((s,v) => s + v.weight,0)).toBeCloseTo(1)
      expect(line.coverage).toBeLessThanOrEqual(100)
      expect(line.globalIndex === null || Number.isFinite(line.globalIndex) && line.globalIndex >= 0 && line.globalIndex <= 100).toBe(true)
    }
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    const html = renderToStaticMarkup(createElement(FunctionalNetworkPanel, { model: result }))
    expect(html).toContain('PATTERN GLOBALI'); expect(html).toContain('sourceObservationIds')
    expect(functionalModelToLines(result).join('\n')).toContain('non misura di forza')
  })
  it('un recurvatum isolato non determina automaticamente lo stato dei tessuti né tessuti cervicali', () => {
    const result = runClinicalPipeline([{ plane: 'sagittale_sinistro', alterations: [], observations: [kneeLeft] }]).functionalModel
    expect(result.tissues.every(t => t.state === 'undetermined')).toBe(true)
    expect(result.tissues.every(t => t.segment !== 'cervical')).toBe(true)
    expect(result.globalPatterns).toEqual([])
  })
})

it('valuta ogni tessuto separatamente, senza copiare stato o lato dalla linea', () => {
  const assessed = obs('assessment', { functionalTissueFindings: [
    { tissueName: 'gastrocnemio', side: 'sinistro', state: 'concentric', method: 'esame clinico dedicato' },
    { tissueName: 'soleo', side: 'sinistro', state: 'eccentric', method: 'esame clinico dedicato' },
    { tissueName: 'tibiale anteriore', side: 'sinistro', state: 'neutral', method: 'esame clinico dedicato' },
    { tissueName: 'suboccipitali', side: 'sinistro', state: 'concentric', method: 'fuori distretto' },
  ] })
  const result = model([assessed])
  expect(result.tissues.find(t => t.name === 'gastrocnemio')?.state).toBe('concentric')
  expect(result.tissues.find(t => t.name === 'soleo')?.state).toBe('eccentric')
  expect(result.tissues.find(t => t.name === 'tibiale anteriore')?.localIndex).toBe(0)
  expect(result.tissues.some(t => t.name === 'suboccipitali' || t.side === 'destro')).toBe(false)
  expect(result.tissues.every(t => t.contralateral === 'not_comparable')).toBe(true)
  const conflict = { ...assessed, id: 'contradiction', functionalTissueFindings: [{ tissueName: 'gastrocnemio', side: 'sinistro' as const, state: 'eccentric' as const, method: 'secondo riscontro' }] }
  expect(model([assessed, conflict]).tissues.find(t => t.name === 'gastrocnemio')?.state).toBe('undetermined')
  const noMethod = { ...assessed, functionalTissueFindings: assessed.functionalTissueFindings!.map(f => ({ ...f, method: '' })) }
  expect(model([noMethod]).tissues).toEqual([])
})

it('una Spirale locale rimane distinta dalla Spirale globale e le direzioni discordanti la sospendono', () => {
  const observations = [kneeLeft, kneeRight, pelvis, scapula, relation]
  const patterns = consolidateObservations(observations)
  const inferences = patterns.map(p => ({ ...inference(p), lines: inference(p).lines.map(l => ({ ...l, lineId: 'spiral_right' as const })) }))
  const local = buildFunctionalModel([kneeLeft], patterns.filter(p => p.observationIds.includes('left')), [], inferences, [])
  expect(local.lines.find(l => l.lineId === 'spiral_right')?.globalIndex).toBeNull()
  const global = buildFunctionalModel(observations, patterns, [], inferences, [])
  expect(global.globalPatterns.some(g => g.lineIds.includes('spiral_right'))).toBe(true)
  const reversed = { ...relation, id: 'reverse', transverseRelation: { ...relation.transverseRelation!, orientation: 'sx_anteposto' as const } }
  const conflict = model([...observations, reversed])
  expect(conflict.globalPatterns).toEqual([])
  expect(conflict.conflicts.some(c => c.message.includes('orientamenti discordanti'))).toBe(true)
})
