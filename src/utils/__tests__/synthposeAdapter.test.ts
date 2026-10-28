import { describe, expect, it } from 'vitest'
import { getLandmarksForPlane } from '@/data/anatomicalLandmarks'
import { SYNTHPOSE_LANDMARK_MAPPING } from '@/data/synthposeLandmarkMapping'
import { synthposeFixture } from '@/testFixtures/synthpose'
import { getSynthposeDisplayLandmarks, parseSynthposeResult, synthposeToAutoProposals, mergeSynthposeProposals, acceptReliableSynthposeProposals, acceptSynthposeProposal } from '../synthposeAdapter'
import { confirmAllProposals, createEmptyLandmarkCollection, getClinicalLandmarks, normalizeLandmarkCollection } from '../landmarkCollection'
import { getEffectiveConfidence, isReportEligibleLandmark } from '../landmarkValidation'
import { createEmptyAssessment, hydrateAssessment } from '../storage'

describe('SynthPose adapter: solo proposte', () => {
  it('parsa 52 marker con coordinate originali e normalizzate coerenti', () => {
    const fixture = synthposeFixture()
    expect(parseSynthposeResult(fixture, fixture.plane).keypoints).toHaveLength(52)
    expect(fixture.keypoints[28]).toMatchObject({ name: 'r_ASIS', xPx: 128, xNormalized: 0.32 })
    expect(() => parseSynthposeResult({ ...fixture, keypoints: fixture.keypoints.slice(1) }, fixture.plane)).toThrow()
    const duplicate = structuredClone(fixture)
    duplicate.keypoints[1] = duplicate.keypoints[0]
    expect(() => parseSynthposeResult(duplicate, fixture.plane)).toThrow()
    const wrong = structuredClone(fixture)
    wrong.keypoints[0].xNormalized = 1
    expect(() => parseSynthposeResult(wrong, fixture.plane)).toThrow()
  })
  it('DIRECT resta proposta, con confidence grezza e metadati persistenti', () => {
    const result = synthposeFixture()
    const proposal = synthposeToAutoProposals(result, result.plane).find(p => p.landmarkId === 'sias_dx')!
    expect(proposal.position).toEqual({ x: 0.32, y: 0.285 })
    expect(proposal.aiProposal).toMatchObject({ mappingType: 'direct', bulkEligible: true, reportEligibleByDefault: false })
    expect(proposal.validationState).toBe('automatico_stimato')
    expect(isReportEligibleLandmark(proposal)).toBe(false)
    const collection = mergeSynthposeProposals(createEmptyLandmarkCollection(), [proposal])
    expect(getClinicalLandmarks(collection)).toEqual([])
    expect(getSynthposeDisplayLandmarks(collection, 'manual', true)).toHaveLength(1)
    expect(getSynthposeDisplayLandmarks(collection, 'manual', false)).toHaveLength(0)
    const accepted = acceptSynthposeProposal(collection, proposal.id)
    expect(getSynthposeDisplayLandmarks(accepted, 'manual', false)).toHaveLength(1)
    const normalized = normalizeLandmarkCollection(collection, result.plane)
    expect(normalized.autoProposals[0].aiProposal).toEqual(proposal.aiProposal)
    expect(getEffectiveConfidence(normalized.autoProposals[0])).toBe(0.9)
  })
  it('APPROXIMATE non viene accettato in blocco; MANUAL_ONLY non viene proposto', () => {
    const result = synthposeFixture()
    const proposals = synthposeToAutoProposals(result, result.plane)
    const shoulder = proposals.find(p => p.landmarkId === 'acromion_dx')!
    expect(shoulder.aiProposal).toMatchObject({ mappingType: 'approximate', bulkEligible: false })
    expect(proposals.some(p => p.landmarkId === 'xifoide')).toBe(false)
    let collection = mergeSynthposeProposals(createEmptyLandmarkCollection(), proposals)
    expect(confirmAllProposals(collection).autoProposals).toContainEqual(shoulder)
    collection = acceptReliableSynthposeProposals(collection)
    expect(collection.autoProposals).toContainEqual(shoulder)
    expect(collection.confirmed.every(p => p.aiProposal?.mappingType === 'direct')).toBe(true)
    collection = acceptSynthposeProposal(collection, shoulder.id)
    expect(collection.confirmed.find(p => p.id === shoulder.id)?.validationState).toBe('manuale_confermato')
  })
  it('non sovrascrive mai punti confermati/manuali, anche dopo una richiesta in corso', () => {
    const result = synthposeFixture()
    const proposals = synthposeToAutoProposals(result, result.plane)
    const manual = { ...proposals.find(p => p.landmarkId === 'sias_dx')!, position: { x: 0.1, y: 0.1 }, detectionSource: 'manual' as const, validationState: 'manuale_confermato' as const }
    const original = { ...createEmptyLandmarkCollection(), manual: [manual] }
    const next = mergeSynthposeProposals(original, proposals)
    expect(next.manual).toEqual([manual])
    expect(next.autoProposals.some(p => p.landmarkId === 'sias_dx')).toBe(false)
    const adversarial = { ...original, autoProposals: [proposals.find(p => p.landmarkId === 'sias_dx')!] }
    expect(acceptSynthposeProposal(adversarial, adversarial.autoProposals[0].id)).toEqual(adversarial)
  })
  it('confidence bassa non diventa proposta, fascia intermedia richiede accettazione singola', () => {
    const result = synthposeFixture()
    result.keypoints[28].confidence = 0.49
    result.keypoints[29].confidence = 0.6
    const proposals = synthposeToAutoProposals(result, result.plane)
    expect(proposals.some(p => p.landmarkId === 'sias_dx')).toBe(false)
    const collection = acceptReliableSynthposeProposals(mergeSynthposeProposals(createEmptyLandmarkCollection(), proposals))
    expect(collection.autoProposals.find(p => p.landmarkId === 'sias_sx')).toBeTruthy()
    expect(collection.confirmed.some(p => p.landmarkId === 'sias_sx')).toBe(false)
    result.thresholds.minimum = 0.7
    expect(synthposeToAutoProposals(result, result.plane).some(p => p.landmarkId === 'sias_sx')).toBe(false)
  })
  it('mapping limitato ai cataloghi esistenti del piano; ignora punti esterni all’immagine', () => {
    for (const mapping of SYNTHPOSE_LANDMARK_MAPPING) expect(getLandmarksForPlane(mapping.plane).some(p => p.id === mapping.clinicalLandmarkId)).toBe(true)
    const result = synthposeFixture('frontale_posteriore')
    result.keypoints[48].xPx = -4
    result.keypoints[48].xNormalized = -0.01
    expect(synthposeToAutoProposals(result, result.plane).some(p => p.landmarkId === 'cervicale_c7')).toBe(false)
    expect(synthposeToAutoProposals(synthposeFixture('trasverso'), 'trasverso')).toEqual([])
  })
  it('continua a leggere assessment-v2 e envelope v3 senza alterare la pipeline clinica', () => {
    for (const schemaVersion of ['assessment-v2', 'assessment-v3'] as const) {
      const original = { ...createEmptyAssessment(), schemaVersion }
      expect(hydrateAssessment(original).schemaVersion).toBe(schemaVersion)
      expect(hydrateAssessment(original).planeAssessments).toEqual(original.planeAssessments)
    }
  })
})
