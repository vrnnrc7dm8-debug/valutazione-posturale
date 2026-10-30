import { expect, it } from 'vitest'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import type { PlacedLandmark } from '@/types'
import { analyzeTransverse } from '@/utils/transverseAnalysis'
import { computeAutoMeasurements, buildBiomechanicalAxes } from '@/utils/biomechanicsEngine'
import { observationsFromAutoMeasurements } from '@/utils/automaticObservations'
import { runClinicalPipeline } from '@/utils/clinicalPipeline'
import { synthposeToAutoProposals } from '@/utils/synthposeAdapter'
import { synthposeFixture } from '@/testFixtures/synthpose'

function point(id: string, x: number, y: number): PlacedLandmark {
  const entry = getLandmarksForPlane('trasverso').find(l => l.id === id)!
  return { ...entry, id: `placed:${id}`, landmarkId: id, position: { x, y }, detectionSource: 'manual', validationState: 'manuale_confermato', confidence: 1 }
}
const landmarks = () => [
  point('cranio_posteriore_trasv', .5, .3), point('cranio_anteriore_trasv', .55, .1),
  point('scapola_trasv_sx', .3, .4), point('scapola_trasv_dx', .7, .45),
  point('psis_trasv_sx', .3, .6), point('psis_trasv_dx', .7, .55),
  point('calcagno_trasv_dx', .6, .9), point('secondo_raggio_dx', .65, .8),
  point('calcagno_trasv_sx', .4, .9), point('secondo_raggio_sx', .35, .8),
]
it('catalogo trasverso specifico, senza repere frontali, conserva i cataloghi degli altri piani', () => {
  const catalog = getLandmarksForPlane('trasverso')
  expect(catalog).toHaveLength(12)
  expect(catalog.map(l => l.label).join(' ')).not.toMatch(/Pupilla|Acromion|Clavicola|Sterno|Rotula|SIAS|femoro/i)
  expect(catalog.every(l => l.plane === 'trasverso')).toBe(true)
  expect(getLandmarksForPlane('frontale_anteriore').some(l => l.id === 'acromion_dx')).toBe(true)
  expect(getLandmarksForPlane('frontale_posteriore').some(l => l.id === 'acromion_post_dx')).toBe(true)
  expect(getLandmarksForPlane('sagittale_destro').some(l => l.id === 'acromion_sagittale_destro')).toBe(true)
})
it('assenza, stima AI, punti coincidenti o obsoleti non generano valori fittizi', () => {
  const legacy = { ...point('psis_trasv_dx', .5, .5), landmarkId: 'sias_trasv_dx' }
  for (const points of [[], [legacy], landmarks().map(l => ({ ...l, validationState: 'automatico_stimato' as const })), landmarks().map(l => ({ ...l, position: { x: .5, y: .5 } }))]) {
    const result = analyzeTransverse(points)
    expect(result.measurements.every(m => m.numericValue === undefined)).toBe(true)
    expect(result.measurements.every(m => m.value.includes('non calcolabile'))).toBe(true)
    expect(observationsFromAutoMeasurements(result.measurements)).toEqual([])
  }
})
it('calcola assi e differenze relative firmate, senza dedurre direzioni anatomiche dal lato schermo', () => {
  const result = computeAutoMeasurements('trasverso', landmarks())
  expect(result).toHaveLength(11)
  expect(result.filter(m => !m.id.includes('scapola_') && m.id !== 'trasv_asimmetria_scapole').every(m => Number.isFinite(m.numericValue) && m.direction === undefined)).toBe(true)
  expect(result.find(m => m.id === 'trasv_torace_bacino')!.numericValue).toBeCloseTo(2 * Math.atan(.05 / .4) * 180 / Math.PI)
  expect(buildBiomechanicalAxes('trasverso', landmarks())).toHaveLength(5)
  const partial = computeAutoMeasurements('trasverso', landmarks().filter(l => !l.landmarkId.startsWith('psis')))
  expect(partial.find(m => m.id === 'trasv_torace_bacino')!.numericValue).toBeUndefined()
  expect(partial.find(m => m.id === 'trasv_torace')!.numericValue).toBeDefined()
})
it('misura gli assi scapolari solo con margini mediali confermati', () => {
  const points = [...landmarks(), point('margine_scapola_trasv_dx', .65, .35), point('margine_scapola_trasv_sx', .35, .3)]
  const result = analyzeTransverse(points)
  expect(result.measurements.find(m => m.id === 'trasv_asimmetria_scapole')!.numericValue).toBeDefined()
  expect(result.axes).toHaveLength(7)
  const unconfirmed = points.map(p => p.landmarkId.startsWith('margine') ? { ...p, validationState: 'automatico_stimato' as const } : p)
  expect(analyzeTransverse(unconfirmed).measurements.find(m => m.id === 'trasv_asimmetria_scapole')!.numericValue).toBeUndefined()
})
it('proposte separate da conferma e Myers: servono direzione e landmark correnti sufficienti', () => {
  const measurements = computeAutoMeasurements('trasverso', landmarks())
  const generated = observationsFromAutoMeasurements(measurements)
  expect(generated.length).toBeGreaterThan(0)
  expect(generated.every(o => o.status === 'suggested' && o.descriptor === 'rotation' && !o.direction)).toBe(true)
  expect(runClinicalPipeline([{ plane: 'trasverso', alterations: [] }], measurements).patterns).toEqual([])
  const observation = generated.find(o => o.phenomenon === 'rotazione_toracica')!
  const assessment = { plane: 'trasverso' as const, alterations: [], observations: [{ ...observation, status: 'confirmed' as const }] }
  expect(runClinicalPipeline([assessment], measurements).inferences).toEqual([])
  assessment.observations[0].direction = 'rotazione_sx'
  const inferred = runClinicalPipeline([assessment], measurements)
  expect(inferred.inferences).toHaveLength(1)
  expect(inferred.inferences[0].lines.every(l => l.confidence <= .55)).toBe(true)
  expect(inferred.inferences[0].lines.some(l => l.lineId === 'spiral_left')).toBe(true)
  expect(inferred.inferences[0].lines.some(l => l.lineId === 'spiral_right')).toBe(false)
  expect(inferred.tissues.some(t => /plantare|gastrocnemio|soleo/.test(t.name))).toBe(false)
  expect(runClinicalPipeline([assessment], []).inferences).toEqual([])
  expect(runClinicalPipeline([assessment], []).patterns).toHaveLength(1)
  expect(runClinicalPipeline([assessment], []).consolidatedPlanes[0].alterations).toHaveLength(1)
  expect(runClinicalPipeline([assessment], []).myersPlanes[0].alterations).toEqual([])
})
it('SynthPose non propone punti trasversi anche ad alta confidenza', () => {
  expect(synthposeToAutoProposals(synthposeFixture('trasverso'), 'trasverso')).toEqual([])
  expect(synthposeToAutoProposals(synthposeFixture(), 'frontale_anteriore').length).toBeGreaterThan(0)
})
