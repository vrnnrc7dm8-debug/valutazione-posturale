import { describe, expect, it } from 'vitest'
import type { AlterationSelection, PlaneAssessment, PosturalPattern } from '@/types'
import { inferMyersForAlteration, resolveMyersRule, type AlterationRule } from '../myersEngine'
import { runClinicalPipeline, formatPattern, patternSelection } from '../clinicalPipeline'
import { tissueProximity } from '@/data/tissueDistricts'
import { supportedTissueEvidence } from '../tissueEvidence'
import { createEmptyAssessment, hydrateAssessment } from '../storage'
import { generateAssessmentReport } from '../reportGeneration'
import { buildTextReportLines } from '../export'

function selection(id: string, patch: Partial<AlterationSelection> = {}): AlterationSelection {
  return { instanceId: id, alterationId: 'deviazione_rachidea_cervicale', descriptor: 'shift',
    direction: 'dx', severity: 'moderato', source: 'confirmed', status: 'confirmed',
    anatomicalDetails: { region: 'cervicale' }, ...patch }
}
function realCase(): PlaneAssessment {
  return { plane: 'frontale_posteriore', alterations: [selection('A'),
    selection('B', { descriptor: 'rotation', direction: 'rotazione_sx' }),
    selection('C', { alterationId: 'deviazione_rachidea_lombosacrale', descriptor: 'bend', direction: 'sx', anatomicalDetails: { region: 'lombosacrale', convexity: 'dx' } }),
  ] }
}

describe('Myers per operatore, direzione, regione e convessità', () => {
  it('mantiene i tre pattern e produce firme differenziate senza due spirali forti automatiche', () => {
    const source = realCase(), before = structuredClone(source)
    const result = runClinicalPipeline([source])
    expect(source).toEqual(before)
    expect(result.patterns).toHaveLength(3)
    expect(result.observations).toHaveLength(3)
    expect(result.patterns.every(p => p.side === undefined)).toBe(true)
    const [shift, rotation, bend] = result.inferences
    expect(shift.lines.map(l => l.lineId)).toEqual(['lateral_right'])
    expect(rotation.lines.map(l => l.lineId)).toEqual(['spiral_left'])
    expect(bend.lines.map(l => l.lineId)).toContain('superficial_back')
    expect(bend.lines.some(l => l.sourceRegion !== 'lombosacrale')).toBe(false)
    expect(bend.lines.map(l => l.lineId)).toContain('spiral_right')
    expect(bend.lines.some(l => l.lineId === 'spiral_left')).toBe(false)
    expect(formatPattern(result.patterns[2])).toContain('Bend SX')
    expect(formatPattern(result.patterns[2])).toContain('Convessità: DX')
    expect(formatPattern(result.patterns[2])).not.toContain(' · destro')
  })
  it('sceglie solo la regola più specifica senza sommare genericità e fallback', () => {
    const rules: AlterationRule[] = [
      { alterationIds: ['deviazione_rachidea_cervicale'], lines: { superficial_back: 99 } },
      { alterationIds: ['deviazione_rachidea_cervicale'], descriptors: ['shift'], lines: { lateral_left: 99 } },
      { alterationIds: ['deviazione_rachidea_cervicale'], descriptors: ['shift'], directions: ['dx'], regions: ['cervicale'], lines: { lateral_right: 2 } },
    ]
    expect(resolveMyersRule('frontale_posteriore', selection('A'), rules)).toBe(rules[2])
    expect(inferMyersForAlteration('frontale_posteriore', selection('A')).lines.map(l => l.lineId)).toEqual(['lateral_right'])
    expect(resolveMyersRule('frontale_posteriore', selection('B', { descriptor: 'rotation', direction: 'rotazione_sx' }))!.descriptors).toEqual(['rotation'])
  })
  it('bend SX/convessità DX non coincide con bend DX/convessità SX; la proposta derivata non sovrascrive il manuale', () => {
    const a = realCase().alterations[2]
    const b = { ...a, direction: 'dx' as const, anatomicalDetails: { region: 'lombosacrale' as const, convexity: 'sx' as const } }
    expect(inferMyersForAlteration('frontale_posteriore', a).lines.map(l => l.lineId)).not.toEqual(inferMyersForAlteration('frontale_posteriore', b).lines.map(l => l.lineId))
    const missing = { ...a, anatomicalDetails: { region: 'lombosacrale' as const } }
    const result = runClinicalPipeline([{ plane: 'frontale_posteriore', alterations: [missing] }])
    expect(result.patterns[0].anatomicalDetails).toMatchObject({ convexity: 'indeterminata', proposedConvexity: 'dx' })
    expect(result.inferences[0].lines.some(l => l.lineId.startsWith('spiral_'))).toBe(false)
    expect(formatPattern(result.patterns[0])).toContain('derivata, da confermare')
    expect(runClinicalPipeline([realCase()]).patterns[2].anatomicalDetails?.convexity).toBe('dx')
  })
  it('una cervicale isolata dà tessuti locali e non fascia plantare, gastrocnemio o soleo', () => {
    for (const a of [selection('shift'), selection('rotation', { descriptor: 'rotation', direction: 'rotazione_sx' }), selection('bend', { descriptor: 'bend', direction: 'sx' })]) {
      const result = runClinicalPipeline([{ plane: 'frontale_posteriore', alterations: [a] }])
      expect(result.tissues.length).toBeGreaterThan(0)
      for (const tissue of result.tissues) {
        expect(tissueProximity(tissue.name, 'cervicale')).toBe('local')
        expect(tissue.support!.every(s => s.proximity === 'local')).toBe(true)
      }
      expect(result.tissues.some(t => /plantare|gastrocnemio|soleo|ischiocrurali/.test(t.name))).toBe(false)
      expect(result.tissues.every(t => t.lengthState === 'unknown')).toBe(true)
    }
    expect(tissueProximity('romboidi', 'cervicale')).toBe('adjacent')
    expect(tissueProximity('fascia plantare', 'cervicale')).toBe('remote')
    expect(tissueProximity('suboccipitali', 'cervicale')).toBe('local')
  })
  it('la regione modifica la distribuzione della stessa linea; le sette regioni sono distinte', () => {
    const tissues = (region: NonNullable<AlterationSelection['anatomicalDetails']>['region']) => inferMyersForAlteration('frontale_posteriore', selection('bend', { descriptor: 'bend', direction: 'sx', anatomicalDetails: { region } })).lines.flatMap(l => l.tissues.map(t => t.name))
    expect(tissues('cervicale')).toContain('suboccipitali')
    expect(tissues('lombosacrale')).toContain('fascia toracolombare')
    expect(tissues('lombosacrale')).not.toContain('suboccipitali')
    for (const region of ['cervicale', 'cervico_dorsale', 'toracica', 'toraco_lombare', 'lombare', 'lombosacrale', 'sacrale'] as const) {
      expect(resolveMyersRule('frontale_posteriore', selection('test', { anatomicalDetails: { region } }))?.regions).toEqual([region])
    }
  })
  it('un tessuto remoto riceve evidenza cervicale solo con supporto locale indipendente della stessa linea', () => {
    const neck = selection('neck', { descriptor: 'bend', direction: 'sx' })
    const foot = selection('foot', { alterationId: 'asse_calcaneare_post', descriptor: 'tilt', direction: 'varo', side: 'sinistro', district: 'arto_inferiore', anatomicalDetails: undefined })
    const run = (alterations: AlterationSelection[]) => runClinicalPipeline([{ plane: 'frontale_posteriore', alterations }])
    expect(run([neck]).tissues.find(t => t.name === 'fascia plantare')).toBeUndefined()
    const localOnly = run([foot]).tissues.find(t => t.name === 'fascia plantare')!
    expect(localOnly).toBeTruthy()
    const combined = run([neck, foot])
    const tissue = combined.tissues.find(t => t.name === 'fascia plantare')!
    expect(tissue.support!.some(s => s.proximity === 'local')).toBe(true)
    expect(tissue.support!.some(s => s.proximity === 'remote' && !!s.corroboratingPatternIds?.length)).toBe(true)
    expect(tissue.confidence).toBeGreaterThan(localOnly.confidence)
    expect(combined.tissues.filter(t => t.name === tissue.name && t.side === tissue.side)).toHaveLength(1)
    const cloned = combined.patterns.map(p => ({ ...p, observationIds: ['same-source'] })) as PosturalPattern[]
    expect(supportedTissueEvidence(cloned, combined.inferences).some(t => t.support?.some(s => s.proximity === 'remote'))).toBe(false)
    const excluded = run([neck, { ...foot, status: 'excluded' }])
    expect(excluded.tissues.find(t => t.name === 'fascia plantare')).toBeUndefined()
  })
  it('la confidenza dipende dal match e dalla misura, non dalla severità', () => {
    const confidence = (a: AlterationSelection) => inferMyersForAlteration('frontale_posteriore', a).lines[0].confidence
    expect(confidence(selection('lieve', { severity: 'lieve' }))).toBe(confidence(selection('severo', { severity: 'severo' })))
    expect(confidence(selection('quant', { quantitative: { value: 3, unit: 'percentuale' } }))).toBeGreaterThan(confidence(selection('base')))
    const generic = selection('generic', { anatomicalDetails: { region: 'indeterminata' }, alterationId: 'deviazione_rachidea' })
    expect(confidence(selection('specific'))).toBeGreaterThan(confidence(generic))
    const uncertain = selection('unknown', { direction: undefined, severity: 'severo' })
    expect(confidence(uncertain)).toBeLessThan(confidence(selection('specific')))
    expect(inferMyersForAlteration('frontale_posteriore', uncertain).lines.every(l => l.confidence < 0.6)).toBe(true)
    const result = runClinicalPipeline([realCase()])
    expect(patternSelection(result.patterns[0]).side).toBeUndefined()
  })
  it('report espone origine e confidenza; il caricamento v2 conserva snapshot e dati originali', () => {
    const assessment = createEmptyAssessment()
    assessment.planeAssessments = [realCase()]
    const original = structuredClone(assessment)
    const generated = generateAssessmentReport(assessment)
    expect(assessment).toEqual(original)
    const text = buildTextReportLines(generated)!.join('\n')
    expect(text).toContain('Origine: Deviazione cervicale — Shift DX')
    expect(text).toContain('Origine: Deviazione cervicale — Rotazione SX')
    expect(text).toContain('Confidenza:')
    expect(text).toContain('STATI FUNZIONALI TESSUTALI PRESUNTI')
    expect(text).toContain('Indice locale:')
    expect(hydrateAssessment(generated).report).toEqual(generated.report)
  })
})

it('duplicati dello stesso fenomeno non alzano la confidenza; la regione indeterminata non localizza tessuti', () => {
  const single = runClinicalPipeline([{ plane: 'frontale_posteriore', alterations: [selection('A')] }])
  const double = runClinicalPipeline([{ plane: 'frontale_posteriore', alterations: [selection('A'), selection('duplicate')] }])
  expect(double.patterns).toHaveLength(1)
  expect(double.inferences[0].lines.map(l => l.confidence)).toEqual(single.inferences[0].lines.map(l => l.confidence))
  expect(double.tissues.map(t => t.confidence)).toEqual(single.tissues.map(t => t.confidence))
  const unknown = inferMyersForAlteration('frontale_posteriore', selection('unknown', { anatomicalDetails: { region: 'indeterminata' } }))
  expect(unknown.lines.every(l => l.tissues.length === 0)).toBe(true)
})
