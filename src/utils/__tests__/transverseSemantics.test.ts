import { generateClinicalReport } from '@/utils/analysisEngine'
import { expect, it } from 'vitest'
import { formatOperatorDirection } from '@/data/clinicalOperators'
import { getAllowedDirections, formatAlterationInstanceSummary } from '@/data/directionalDescriptors'
import { formatTransverseRelation, normalizeTransverseRelation, transverseRelationSide } from '@/data/transverseRelations'
import { analyzeTransverse } from '@/utils/transverseAnalysis'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import { observationsFromAutoMeasurements } from '@/utils/automaticObservations'
import { runClinicalPipeline, formatPattern } from '@/utils/clinicalPipeline'
import { createEmptyAssessment, hydrateAssessment } from '@/utils/storage'
import type { PlacedLandmark } from '@/types'

function lm(id: string, x: number, y: number): PlacedLandmark {
  return { ...getLandmarksForPlane('trasverso').find(l => l.id === id)!, id, landmarkId: id, position: { x, y }, confidence: 1, detectionSource: 'manual', validationState: 'manuale_confermato' }
}
const points = () => [lm('cranio_posteriore_trasv', .5, .3), lm('cranio_anteriore_trasv', .5, .1),
  lm('scapulum_trasv_sx', .3, .4), lm('scapulum_trasv_dx', .7, .35),
  lm('ileo_trasv_sx', .3, .6), lm('ileo_trasv_dx', .7, .65),
  lm('calcagno_trasv_sx', .35, .9), lm('calcagno_trasv_dx', .65, .9)]

it('relazione distinta dall’orientamento: niente direzioni DX/SX per dissociazione', () => {
  expect(getAllowedDirections('trasverso', 'relazione_scapolo_pelvica', 'dissociazione')).toEqual([])
  expect(formatOperatorDirection('dissociazione', 'sx')).toBe('Dissociazione')
  const relation = { relationType: 'dissociazione' as const, reference: 'scapulum_ileo' as const, orientation: 'dx_anteposto' as const, referenceSide: 'dx' as const }
  expect(formatTransverseRelation(relation, { value: 7, unit: 'gradi' })).toContain('Scapulum DX anteposto rispetto all’ileo DX')
  expect(formatTransverseRelation({ ...relation, orientation: 'sx_retroposto', referenceSide: 'sx' })).toContain('Scapulum SX retroposto rispetto all’ileo SX')
  expect(formatTransverseRelation({ ...relation, reference: 'scapulum_controlaterale', orientation: 'sx_retroposto' })).toContain('Asimmetria scapolare trasversa')
  expect(transverseRelationSide({ ...relation, orientation: 'sx_retroposto' })).toBe('destro')
})
it('linea bicalcaneare disponibile senza assi completi dei piedi: orientamento pelvico SX anteposto', () => {
  const analysis = analyzeTransverse(points())
  const measurement = analysis.measurements.find(m => m.id === 'trasv_pelvi_bicalcaneare')!
  expect(measurement.numericValue).toBeDefined()
  expect(measurement.clinicalSuggestion!.transverseRelation).toMatchObject({ reference: 'pelvico_bicalcaneare', orientation: 'sx_anteposto' })
  expect(analysis.measurements.find(m => m.id === 'trasv_scapole_bicalcaneare')!.numericValue).toBeDefined()
  expect(analysis.measurements.find(m => m.id === 'trasv_pelvico_piede_dx')!.numericValue).toBeUndefined()
  const proposal = observationsFromAutoMeasurements(analysis.measurements).find(o => o.phenomenon === 'relazione_pelvi_calcagni')!
  expect(proposal.direction).toBeUndefined()
  const confirmed = { ...proposal, status: 'confirmed' as const }
  const pipeline = runClinicalPipeline([{ plane: 'trasverso', alterations: [], observations: [confirmed] }], analysis.measurements)
  const text = formatPattern(pipeline.patterns[0])
  expect(text).toContain('Cingolo pelvico–linea bicalcaneare')
  expect(text).toContain('Ileo SX anteposto rispetto alla linea bicalcaneare')
  expect(text).not.toMatch(/Dissociazione[ ·—–]+SX/)
  expect(pipeline.inferences[0].lines[0].sourceTransverseRelation).toMatchObject({ reference: 'pelvico_bicalcaneare', orientation: 'sx_anteposto' })
  expect(pipeline.inferences[0].lines[0].sourceDirection).toBeUndefined()
  expect(pipeline.inferences[0].lines.every(l => l.lineId !== 'spiral_right')).toBe(true)
  const report = generateClinicalReport([{ plane: 'trasverso', alterations: [], observations: [confirmed] }], [], [])
  const output = report.sections.flatMap(s => s.observedAlterations).join(' ')
  expect(output).toContain('Ileo SX anteposto rispetto alla linea bicalcaneare')
  expect(output).not.toMatch(/Dissociazione[ ·—–]+SX/)
})
it('migrazione legacy lossless senza inventare un orientamento o riscrivere report storici', () => {
  const a = createEmptyAssessment()
  a.planeAssessments = [{ plane: 'trasverso', alterations: [{ instanceId: 'legacy', alterationId: 'relazione_scapolo_pelvica', descriptor: 'dissociazione', direction: 'sx', severity: 'moderato' }] }]
  a.report = generateClinicalReport([], [], [])
  const before = JSON.stringify(a)
  const loaded = hydrateAssessment(a)
  const migrated = loaded.planeAssessments[0].alterations[0]
  expect(migrated.direction).toBeUndefined()
  expect(migrated.transverseRelation).toMatchObject({ reference: 'scapolare_pelvico', orientation: 'indeterminabile', legacyDirection: 'sx' })
  expect(JSON.stringify(a)).toBe(before)
  expect(loaded.report).toBe(a.report)
  const text = formatAlterationInstanceSummary(migrated)
  expect(text).toContain('Orientamento non determinabile')
  expect(text).toContain('Direzione legacy SX conservata')
  expect(text).not.toMatch(/Dissociazione[ ·—–]+SX/)
  expect(runClinicalPipeline(loaded.planeAssessments).inferences).toEqual([])
  const two = runClinicalPipeline([{ plane: 'trasverso', alterations: [a.planeAssessments[0].alterations[0], { ...a.planeAssessments[0].alterations[0], instanceId: 'opposite-legacy', direction: 'dx' }] }])
  expect(two.patterns).toHaveLength(2)
  expect(two.patterns.map(p => p.transverseRelation?.legacyDirection).sort()).toEqual(['dx', 'sx'])
  const frontal = { descriptor: 'tilt' as const, direction: 'dx' as const }
  expect(normalizeTransverseRelation(frontal, 'frontale_anteriore', 'tilt_capo')).toBe(frontal)
})

it('la coppia scapulum DX–ileo DX conserva riferimento e retroposizione fino a Myers', () => {
  const shifted = points().map(p => p.landmarkId === 'scapulum_trasv_dx' ? { ...p, position: { x: .75, y: .35 } } : p)
  const measurements = analyzeTransverse(shifted).measurements
  const proposal = observationsFromAutoMeasurements(measurements).find(o => o.id.endsWith('trasv_relazione_dx_dx'))!
  expect(proposal.transverseRelation).toMatchObject({ reference: 'scapulum_ileo', referenceSide: 'dx', orientation: 'indeterminabile' })
  const confirmed = { ...proposal, status: 'confirmed' as const, transverseRelation: { ...proposal.transverseRelation!, orientation: 'dx_retroposto' as const, orientationSource: 'manual' as const } }
  const pipeline = runClinicalPipeline([{ plane: 'trasverso', alterations: [], observations: [confirmed] }], measurements)
  expect(formatPattern(pipeline.patterns[0])).toContain('Scapulum DX retroposto rispetto all’ileo DX')
  expect(pipeline.inferences[0].lines[0].sourceTransverseRelation).toMatchObject({ reference: 'scapulum_ileo', referenceSide: 'dx', orientation: 'dx_retroposto' })
  expect(pipeline.inferences[0].lines[0].sourceDescriptor).toBe('dissociazione')
  expect(pipeline.inferences[0].lines[0].sourceDirection).toBeUndefined()
})
