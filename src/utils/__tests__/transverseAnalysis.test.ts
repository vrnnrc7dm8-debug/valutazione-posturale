import { analyzeMyofascialLinesForPlane } from '@/utils/myersEngine'
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
  point('scapulum_trasv_sx', .3, .4), point('scapulum_trasv_dx', .7, .45),
  point('ileo_trasv_sx', .3, .6), point('ileo_trasv_dx', .7, .55),
  point('psis_trasv_sx', .3, .6), point('psis_trasv_dx', .7, .55),
  point('calcagno_trasv_dx', .6, .9), point('secondo_raggio_dx', .65, .8),
  point('calcagno_trasv_sx', .4, .9), point('secondo_raggio_sx', .35, .8),
]
it('catalogo trasverso specifico, senza repere frontali, conserva i cataloghi degli altri piani', () => {
  const catalog = getLandmarksForPlane('trasverso')
  expect(catalog).toHaveLength(18)
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
  expect(result).toHaveLength(34)
  expect(result.find(m => m.id === 'trasv_torace')!.numericValue).toBeDefined()
  expect(result.every(m => m.direction === undefined)).toBe(true)
  expect(result.find(m => m.id === 'trasv_torace_bacino')!.numericValue).toBeCloseTo(2 * Math.atan(.05 / .4) * 180 / Math.PI)
  expect(buildBiomechanicalAxes('trasverso', landmarks())).toHaveLength(6)
  const partial = computeAutoMeasurements('trasverso', landmarks().filter(l => !l.landmarkId.startsWith('ileo')))
  expect(partial.find(m => m.id === 'trasv_torace_bacino')!.numericValue).toBeUndefined()
  expect(partial.find(m => m.id === 'trasv_torace')!.numericValue).toBeDefined()
})
it('misura gli assi scapolari solo con margini mediali confermati', () => {
  const points = [...landmarks(), point('margine_scapola_trasv_dx', .65, .35), point('margine_scapola_trasv_sx', .35, .3)]
  const result = analyzeTransverse(points)
  expect(result.measurements.find(m => m.id === 'trasv_asimmetria_scapole')!.numericValue).toBeDefined()
  expect(result.axes).toHaveLength(8)
  const unconfirmed = points.map(p => p.landmarkId.startsWith('margine') ? { ...p, validationState: 'automatico_stimato' as const } : p)
  expect(analyzeTransverse(unconfirmed).measurements.find(m => m.id === 'trasv_asimmetria_scapole')!.numericValue).toBeUndefined()
})
it('proposte separate da conferma e Myers: servono direzione e landmark correnti sufficienti', () => {
  const measurements = computeAutoMeasurements('trasverso', landmarks())
  const generated = observationsFromAutoMeasurements(measurements)
  expect(generated.length).toBeGreaterThan(0)
  expect(generated.every(o => o.status === 'suggested')).toBe(true)
  expect(generated.filter(o => o.descriptor === 'rotation').every(o => !o.direction)).toBe(true)
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


it('ante/retro relative conservano operatore e lato per scapulum e ileo, senza rotazioni derivate', () => {
  const measurements = analyzeTransverse(landmarks()).measurements
  const proposals = observationsFromAutoMeasurements(measurements)
  const ap = proposals.filter(o => ['posizione_scapulum', 'posizione_ileo'].includes(o.phenomenon))
  expect(ap).toHaveLength(4)
  expect(ap.filter(o => o.phenomenon === 'posizione_scapulum').map(o => o.descriptor).sort()).toEqual(['anteposizione', 'retroposizione'])
  expect(ap.filter(o => o.phenomenon === 'posizione_ileo').map(o => o.descriptor).sort()).toEqual(['anteposizione', 'retroposizione'])
  expect(ap.every(o => o.side && ['anteriore', 'posteriore'].includes(o.direction!))).toBe(true)
  const pipeline = runClinicalPipeline([{ plane: 'trasverso', alterations: [], observations: ap.map(o => ({ ...o, status: 'confirmed' })) }], measurements)
  expect(pipeline.patterns).toHaveLength(4)
  expect(pipeline.patterns.every(p => p.descriptor !== 'rotation')).toBe(true)
  expect(pipeline.inferences).toEqual([])
  const missingAnterior = analyzeTransverse(landmarks().filter(l => l.landmarkId !== 'cranio_anteriore_trasv')).measurements
  expect(missingAnterior.filter(m => m.id.startsWith('trasv_ap_')).every(m => m.numericValue === undefined)).toBe(true)
})

it('misura relazioni omolaterali, crociate e podaliche e limita le inferenze alle relazioni confermate', () => {
  const measurements = analyzeTransverse(landmarks()).measurements
  for (const id of ['trasv_relazione_dx_dx', 'trasv_relazione_sx_sx', 'trasv_relazione_dx_sx', 'trasv_relazione_sx_dx', 'trasv_pelvico_piede_dx', 'trasv_pelvico_piede_sx', 'trasv_scapolare_piede_dx', 'trasv_scapolare_piede_sx', 'trasv_taglio_proiettivo', 'trasv_apertura_piedi']) {
    expect(measurements.find(m => m.id === id)?.numericValue, id).toBeDefined()
  }
  const generated = observationsFromAutoMeasurements(measurements)
  const relation = generated.find(o => o.phenomenon === 'relazione_scapolo_pelvica' && o.descriptor === 'dissociazione')!
  expect(relation.direction).toBeUndefined()
  const observation = { ...relation, status: 'confirmed' as const, direction: undefined, transverseRelation: { ...relation.transverseRelation!, orientation: 'sx_anteposto' as const } }
  const assessment = { plane: 'trasverso' as const, alterations: [], observations: [observation] }
  const pipeline = runClinicalPipeline([assessment], measurements)
  expect(pipeline.patterns[0].descriptor).toBe('dissociazione')
  expect(pipeline.inferences[0].lines.some(l => l.lineId === 'spiral_left')).toBe(true)
  expect(pipeline.inferences[0].lines.every(l => l.lineId !== 'spiral_right' && l.confidence <= .55)).toBe(true)
  expect(pipeline.tissues.some(t => /plantare|gastrocnemio|soleo/.test(t.name))).toBe(false)
  expect(runClinicalPipeline([assessment], []).inferences).toEqual([])
  const noFoot = analyzeTransverse(landmarks().filter(l => !l.landmarkId.startsWith('calcagno'))).measurements
  expect(noFoot.filter(m => /trasv_(pelvico|scapolare)_piede/.test(m.id)).every(m => m.numericValue === undefined)).toBe(true)
})

it('il contesto scapolo-pelvico alimenta Myers e il riscontro calcaneare opzionale modula solo la confidence', () => {
  const measurements = analyzeTransverse(landmarks()).measurements
  const proposals = observationsFromAutoMeasurements(measurements)
  const ap = proposals.filter(o => ['posizione_scapulum', 'posizione_ileo'].includes(o.phenomenon)).map(o => ({ ...o, status: 'confirmed' as const }))
  const rawGirdles = proposals.find(o => o.phenomenon === 'relazione_scapolo_pelvica' && o.descriptor === 'dissociazione')!
  const girdles = { ...rawGirdles, status: 'confirmed' as const, direction: undefined, transverseRelation: { ...rawGirdles.transverseRelation!, orientation: 'sx_anteposto' as const, orientationSource: 'manual' as const } }
  const rawFoot = proposals.find(o => o.phenomenon === 'relazione_pelvi_calcagni')!
  const foot = { ...rawFoot, status: 'confirmed' as const, direction: undefined, transverseRelation: { ...rawFoot.transverseRelation!, orientation: 'sx_anteposto' as const, orientationSource: 'manual' as const } }
  const run = (observations: import('@/types').ClinicalObservation[]) => runClinicalPipeline([{ plane: 'trasverso', alterations: [], observations }], measurements)
  const result = run([...ap, girdles, foot])
  const apInferences = result.inferences.filter(i => ['posizione_scapulum', 'posizione_ileo'].includes(i.alterationId))
  expect(apInferences).toHaveLength(4)
  const contextual = result.myersPlanes[0].alterations.filter(a => a.myersContext)
  expect(analyzeMyofascialLinesForPlane('trasverso', contextual).map(l => [l.lineId, l.score, l.prevalentSide])).toEqual(analyzeMyofascialLinesForPlane('trasverso', contextual.slice(0, 1)).map(l => [l.lineId, l.score, l.prevalentSide]))
  for (const inference of apInferences) {
    expect(inference.lines.some(l => l.lineId === 'spiral_left')).toBe(true)
    expect(inference.lines.some(l => l.lineId === 'functional_back')).toBe(true)
    expect(inference.lines.every(l => l.lineId !== 'spiral_right' && l.contextPatternIds?.length === 2)).toBe(true)
    expect(inference.lines.every(l => ['anteposizione', 'retroposizione'].includes(l.sourceDescriptor!))).toBe(true)
  }
  const changedSeverity = run([...ap.map(o => ({ ...o, severity: 'severo' as const })), girdles, foot])
  expect(changedSeverity.inferences.filter(i => ['posizione_scapulum', 'posizione_ileo'].includes(i.alterationId)).map(i => i.lines.map(l => l.score))).toEqual(apInferences.map(i => i.lines.map(l => l.score)))
  const primary = run([...ap, girdles]).inferences.filter(i => ['posizione_scapulum', 'posizione_ileo'].includes(i.alterationId))
  const discordant = run([...ap, girdles, { ...foot, transverseRelation: { ...foot.transverseRelation, orientation: 'dx_anteposto' } }]).inferences.filter(i => ['posizione_scapulum', 'posizione_ileo'].includes(i.alterationId))
  expect(primary).toHaveLength(4); expect(discordant).toHaveLength(4)
  expect(primary.map(i => i.lines.map(l => [l.side, l.score]))).toEqual(apInferences.map(i => i.lines.map(l => [l.side, l.score])))
  expect(discordant.map(i => i.lines.map(l => [l.side, l.score]))).toEqual(primary.map(i => i.lines.map(l => [l.side, l.score])))
  expect(apInferences[0].lines[0].confidence).toBeGreaterThan(primary[0].lines[0].confidence)
  expect(discordant[0].lines[0].confidence).toBeLessThan(primary[0].lines[0].confidence)
  expect(discordant[0].lines[0].distalEvidence).toBe('discordant')
  expect(run(ap).inferences).toEqual([])
  const unconfirmed = run([...ap, girdles, { ...foot, status: 'suggested' as const }])
  expect(unconfirmed.inferences.filter(i => ['posizione_scapulum', 'posizione_ileo'].includes(i.alterationId))).toEqual(primary)
  const girdleConfidence = (pipeline: ReturnType<typeof run>) => pipeline.inferences.find(i => i.alterationId === 'relazione_scapolo_pelvica')!.lines[0].confidence
  expect(girdleConfidence(result)).toBeGreaterThan(girdleConfidence(run([...ap, girdles])))
  const incomplete = analyzeTransverse(landmarks().filter(l => !l.landmarkId.startsWith('calcagno'))).measurements
  expect(runClinicalPipeline([{ plane: 'trasverso', alterations: [], observations: [...ap, girdles, foot] }], incomplete).inferences.filter(i => ['posizione_scapulum', 'posizione_ileo'].includes(i.alterationId))).toEqual(primary)
})
