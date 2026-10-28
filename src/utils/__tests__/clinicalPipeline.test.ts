import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClinicalReport } from '@/components/ClinicalReport'
import { reportAssessment } from '@/testFixtures/reportAssessment'
import { describe, expect, it } from 'vitest'
import type { ClinicalObservation, PlaneAssessment, TissueFunctionalState } from '@/types'
import { canonicalPhenomenon, consolidateObservations, consolidateTissueEvidence, inferMyersFromPatterns, runClinicalPipeline } from '../clinicalPipeline'
import { createEmptyAssessment, hydrateAssessment } from '../storage'
import { generateAssessmentReport } from '../reportGeneration'
import { buildTextReportLines } from '../export'

const observation = (id: string, patch: Partial<ClinicalObservation> = {}): ClinicalObservation => ({
  id, plane: 'sagittale_destro', district: 'cranio_cervicale', phenomenon: 'anteriorizzazione_capo',
  severity: 'moderato', source: 'manual', sourceIds: [id], status: 'confirmed', ...patch,
})
const tissue = (id: string, patch: Partial<TissueFunctionalState> = {}): TissueFunctionalState => ({
  tissueId: 'ischiocrurali', name: 'Ischiocrurali', side: 'sinistro', lengthState: 'shortened',
  mobilityState: 'restricted', functionalRole: 'compensatory', evidence: [id], observationIds: [id],
  sourceLineIds: ['superficial_back'], confidence: 0.72, conflict: false, conflictingEvidence: [], ...patch,
})
const plane = (patch: Partial<PlaneAssessment['alterations'][number]> = {}): PlaneAssessment => ({
  plane: 'sagittale_destro', alterations: [{ instanceId: 'head', alterationId: 'anteriorizzazione_capo',
    descriptor: 'shift', severity: 'moderato', source: 'confirmed', ...patch }],
})

describe('pipeline clinica consolidata', () => {
  it('due osservazioni equivalenti sostengono un solo pattern e una sola inferenza', () => {
    const patterns = consolidateObservations([observation('a'), observation('b')])
    expect(patterns).toHaveLength(1)
    expect(patterns[0].observationIds).toEqual(['a', 'b'])
    expect(inferMyersFromPatterns(patterns)).toHaveLength(1)
  })
  it('normalizza alias italiani e forward head senza amplificare lo score', () => {
    expect(canonicalPhenomenon('Anteriorizzazione testa')).toBe('anteriorizzazione_capo')
    const single = runClinicalPipeline([plane()])
    const double = plane()
    double.alterations.push({ ...double.alterations[0], instanceId: 'alias', alterationId: 'forward_head_posture', direction: 'anteriorizzazione' })
    const result = runClinicalPipeline([double])
    expect(result.patterns).toHaveLength(1)
    expect(result.inferences[0].lines.map(l => l.score)).toEqual(single.inferences[0].lines.map(l => l.score))
  })
  it('tre pattern danno una sola voce tessutale con tutte le evidenze e dimensioni indipendenti', () => {
    const result = consolidateTissueEvidence([tissue('a'), tissue('b'), tissue('c')])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ lengthState: 'shortened', mobilityState: 'restricted', functionalRole: 'compensatory', evidence: ['a', 'b', 'c'], confidence: 0.72, conflict: false })
  })
  it('accorciamento e allungamento producono conflitto indipendentemente dall’ordine o confidenza', () => {
    const evidence = [tissue('a'), tissue('b', { lengthState: 'lengthened', confidence: 0.9 })]
    for (const items of [evidence, [...evidence].reverse()]) {
      const [result] = consolidateTissueEvidence(items)
      expect(result.lengthState).toBe('unknown')
      expect(result.conflict).toBe(true)
      expect(result.conflictingEvidence.sort()).toEqual(['a', 'b'])
    }
  })
  it('correzioni manuali hanno priorità sui duplicati automatici', () => {
    const corrected = observation('manual', { status: 'modified', severity: 'lieve', notes: 'corretto' })
    const patterns = consolidateObservations([observation('auto', { source: 'automatic_suggestion', severity: 'severo' }), corrected])
    expect(patterns[0]).toMatchObject({ severity: 'lieve', notes: 'corretto', status: 'modified' })
  })
  it('esclusione e suggerimenti non confermati non entrano in Myers e nel report', () => {
    for (const status of ['excluded', 'suggested'] as const) {
      const a = createEmptyAssessment()
      a.planeAssessments = [plane({ status })]
      const generated = generateAssessmentReport(a)
      expect(generated.report!.clinicalPipeline!.patterns).toEqual([])
      expect(generated.report!.clinicalPipeline!.tissues).toEqual([])
      expect(generated.report!.alteredMeridians).toEqual([])
      expect(buildTextReportLines(generated)!.join('\n')).not.toContain('anteriorizzazione_capo')
    }
  })
  it('mantiene regione toracica e apice T7 nel report ed export, senza inventare dettagli assenti', () => {
    const a = createEmptyAssessment()
    a.planeAssessments = [{ plane: 'frontale_posteriore', alterations: [{ ...plane().alterations[0], alterationId: 'scoliosi_funzionale', anatomicalDetails: { region: 'toracica', convexity: 'dx', apex: 'T7', startLevel: 'T3', endLevel: 'T11' } }] }]
    const generated = generateAssessmentReport(a)
    expect(generated.report!.clinicalPipeline!.patterns[0].anatomicalDetails).toEqual(a.planeAssessments[0].alterations[0].anatomicalDetails)
    const text = buildTextReportLines(generated)!.join('\n')
    expect(text).toContain('Regione: toracica')
    expect(text).toContain('Apice: T7')
    const absent = runClinicalPipeline([{ plane: 'frontale_posteriore', alterations: [{ ...plane().alterations[0], alterationId: 'scoliosi_funzionale' }] }])
    expect(absent.patterns[0].anatomicalDetails).toEqual({ region: 'indeterminata', convexity: 'indeterminata' })
  })
  it('legge assessment-v2 senza mutare originale, fotografie, landmark e report storico', () => {
    const a = reportAssessment()
    a.report = generateAssessmentReport(a).report
    delete a.report!.clinicalPipeline
    a.schemaVersion = 'assessment-v2'
    a.planeAssessments = [plane({ status: 'modified', anatomicalDetails: { apex: 'T7' }, note: 'persistita' })]
    const snapshot = structuredClone(a)
    const restored = hydrateAssessment(a)
    expect(a).toEqual(snapshot)
    expect(restored.schemaVersion).toBe('assessment-v2')
    expect(restored.planeAssessments).toEqual(a.planeAssessments)
    expect(restored.photos).toMatchObject(a.photos)
    expect(restored.report).toEqual(a.report)
    expect(runClinicalPipeline(restored.planeAssessments).patterns).toHaveLength(1)
  })
  it('non fonde lati, direzioni o curve con apici diversi; permette un collegamento clinico esplicito', () => {
    expect(consolidateObservations([observation('a', { side: 'destro' }), observation('b', { side: 'sinistro' })])).toHaveLength(2)
    expect(consolidateObservations([observation('a', { anatomicalDetails: { apex: 'T7' } }), observation('b', { anatomicalDetails: { apex: 'L2' } })])).toHaveLength(2)
    expect(consolidateObservations([observation('a', { patternId: 'tronco' }), observation('b', { phenomenon: 'triangoli_taglia', patternId: 'tronco' })])).toHaveLength(1)
  })
})

it('mostra evidenza discordante nel report HTML e nel testo, senza affermare una lunghezza', () => {
  const a = generateAssessmentReport(createEmptyAssessment())
  a.report!.clinicalPipeline!.tissues = consolidateTissueEvidence([tissue('a'), tissue('b', { lengthState: 'lengthened' })])
  const html = renderToStaticMarkup(createElement(ClinicalReport, { assessment: a }))
  const text = buildTextReportLines(a)!.join('\n')
  for (const content of [html, text]) {
    expect(content).toContain('evidenza discordante')
    expect(content).toContain('Lunghezza: indeterminato')
    expect(content).not.toContain('Lunghezza: accorciamento')
  }
})
