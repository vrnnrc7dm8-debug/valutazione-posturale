import { describe, expect, it } from 'vitest'
import type { PlaneAssessment } from '@/types'
import { normalizeLineTiltDegrees, segmentTiltDegrees } from '../angleCalculations'
import { computeRelativeTilt, horizontalTilt } from '../landmarkGeometry'
import { computeAutoMeasurements } from '../biomechanicsEngine'
import { observationsFromAutoMeasurements } from '../automaticObservations'
import { runClinicalPipeline } from '../clinicalPipeline'
import { frontal21Landmarks } from '@/testFixtures/frontalLandmarks'
import { createEmptyAssessment, hydrateAssessment } from '../storage'
import { generateAssessmentReport } from '../reportGeneration'

describe('linee anatomiche non orientate', () => {
  it.each([[178.6, -1.4], [-178.6, 1.4], [0, 0], [5, 5], [-5, -5]])('%s° diventa %s°', (raw, expected) => {
    expect(normalizeLineTiltDegrees(raw)).toBeCloseTo(expected, 8)
    const a = { x: 0, y: 0 }, b = { x: Math.cos(raw * Math.PI / 180), y: Math.sin(raw * Math.PI / 180) }
    expect(segmentTiltDegrees(a, b)).toBeCloseTo(expected, 8)
    expect(segmentTiltDegrees(b, a)).toBeCloseTo(expected, 8)
  })
  it('linee di livello e tilt relativo sono indipendenti dal verso', () => {
    const a = { x: 0, y: 0 }, b = { x: 1, y: .01 }
    expect(horizontalTilt(a, b).degrees).toBeCloseTo(horizontalTilt(b, a).degrees, 10)
    expect(horizontalTilt(a, b).severity).toBe(horizontalTilt(b, a).severity)
    const fromAngle = (angle: number) => ({ from: a, to: { x: Math.cos(angle * Math.PI / 180), y: Math.sin(angle * Math.PI / 180) } })
    expect(computeRelativeTilt(fromAngle(89), fromAngle(91)).degrees).toBeCloseTo(2)
  })
  it('bipupillare quasi orizzontale non diventa severa per ordine dei punti', () => {
    const landmarks = frontal21Landmarks(false)
    landmarks.find(l => l.landmarkId === 'bipupillare_dx')!.position = { x: .55, y: .12 }
    landmarks.find(l => l.landmarkId === 'bipupillare_sx')!.position = { x: .45, y: .12 + .1 * Math.tan(1.4 * Math.PI / 180) }
    const measurement = computeAutoMeasurements('frontale_anteriore', landmarks).find(m => m.id === 'bipupillare_tilt')!
    expect(measurement.numericValue).toBeCloseTo(-1.4, 1)
    expect(measurement.severity).not.toBe('severo')
  })
})

describe('21 landmark → misure → proposte → pattern', () => {
  it('calcola sette misure frontali e conserva direzioni, SIAS/rotule/malleoli e alluce', () => {
    const landmarks = frontal21Landmarks()
    expect(landmarks).toHaveLength(21)
    const measurements = computeAutoMeasurements('frontale_anteriore', landmarks)
    for (const id of ['dislivello_acromiale_auto', 'dislivello_sias_auto', 'bipupillare_tilt', 'asse_femoro_tibiale_destro', 'asse_femoro_tibiale_sinistro', 'rotazione_arto_inferiore_destro', 'rotazione_arto_inferiore_sinistro']) expect(measurements.find(m => m.id === id)?.numericValue).toEqual(expect.any(Number))
    expect(measurements.find(m => m.id === 'dislivello_acromiale_auto')).toMatchObject({ side: 'destro', direction: 'dx' })
    const rotation = measurements.find(m => m.id === 'rotazione_arto_inferiore_destro')!
    expect(rotation.direction).toBe('intrarotazione')
    expect(computeAutoMeasurements('frontale_anteriore', landmarks.filter(l => !l.landmarkId.startsWith('alluce'))).find(m => m.id === rotation.id)?.numericValue).not.toBe(rotation.numericValue)
  })
  it('misure normali visibili non producono osservazioni patologiche', () => {
    const measurements = computeAutoMeasurements('frontale_anteriore', frontal21Landmarks(false))
    expect(measurements.find(m => m.id === 'dislivello_sias_auto')).toMatchObject({ numericValue: 0, severity: 'normale' })
    expect(observationsFromAutoMeasurements(measurements)).toEqual([])
  })
  it('soltanto conferma esplicita abilita pattern/Myers/report; esclusione e correzione persistono', () => {
    const measurements = computeAutoMeasurements('frontale_anteriore', frontal21Landmarks())
    const plane: PlaneAssessment = { plane: 'frontale_anteriore', alterations: [] }
    const suggested = runClinicalPipeline([plane], measurements)
    expect(suggested.observations.length).toBeGreaterThan(0)
    expect(suggested.observations.every(o => o.source === 'automatic_measurement' && o.status === 'suggested')).toBe(true)
    expect(suggested.patterns).toEqual([])
    expect(suggested.inferences).toEqual([])
    const chosen = suggested.observations.find(o => o.phenomenon === 'dislivello_sias')!
    plane.observations = [{ ...chosen, status: 'confirmed' }]
    const confirmed = runClinicalPipeline([plane], measurements)
    expect(confirmed.patterns).toHaveLength(1)
    expect(confirmed.inferences[0].lines.length).toBeGreaterThan(0)
    plane.observations = [{ ...chosen, status: 'modified', side: 'sinistro', direction: 'sx', severity: 'lieve', notes: 'correzione clinica' }]
    const modified = runClinicalPipeline([plane], [...measurements, ...measurements])
    expect(modified.observations.filter(o => o.sourceIds.includes(chosen.id))).toHaveLength(1)
    expect(modified.patterns[0]).toMatchObject({ side: 'sinistro', severity: 'lieve', notes: 'correzione clinica' })
    const assessment = createEmptyAssessment()
    assessment.planeAssessments = [plane]
    const reopened = hydrateAssessment(assessment)
    expect(reopened.planeAssessments[0].observations).toEqual(plane.observations)
    expect(generateAssessmentReport(reopened).report!.clinicalPipeline!.patterns).toHaveLength(1)
    plane.observations = [{ ...chosen, status: 'excluded' }]
    assessment.planeAssessments = [plane]
    expect(runClinicalPipeline([plane], measurements).patterns).toEqual([])
    expect(generateAssessmentReport(assessment).report!.clinicalPipeline!.patterns).toEqual([])
  })
  it('vecchia selezione equivalente e osservazione confermata sostengono un solo pattern', () => {
    const measurement = observationsFromAutoMeasurements(computeAutoMeasurements('frontale_anteriore', frontal21Landmarks())).find(o => o.phenomenon === 'dislivello_acromiale')!
    const plane: PlaneAssessment = { plane: measurement.plane, alterations: [{ instanceId: 'manual', alterationId: measurement.phenomenon, side: measurement.side, descriptor: 'tilt', severity: 'lieve', source: 'manual' }], observations: [{ ...measurement, status: 'confirmed' }] }
    expect(runClinicalPipeline([plane]).patterns).toHaveLength(1)
    const pending = runClinicalPipeline([plane], computeAutoMeasurements('frontale_anteriore', frontal21Landmarks())).observations.filter(o => o.phenomenon === measurement.phenomenon && o.status === 'suggested')
    expect(pending).toEqual([])
  })
})
