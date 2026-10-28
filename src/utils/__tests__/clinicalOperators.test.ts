import { describe, expect, it, vi } from 'vitest'
import { getAllowedDirections, getDirectionsForDescriptor, buildAlterationUpdatePatch, formatAlterationInstanceSummary } from '@/data/directionalDescriptors'
import { getAlterationsForPlane } from '@/data/planes'
import { consolidateObservations, runClinicalPipeline, patternSelection } from '../clinicalPipeline'
import * as myers from '../myersEngine'
import { createEmptyAssessment, hydrateAssessment } from '../storage'
import { generateAssessmentReport } from '../reportGeneration'
import { buildTextReportLines } from '../export'
import type { PlaneAssessment } from '@/types'

function cervical(): PlaneAssessment {
  return { plane: 'frontale_posteriore', alterations: [
    { instanceId: 'shift-cervicale', alterationId: 'deviazione_rachidea_cervicale', descriptor: 'shift', direction: 'dx', severity: 'moderato', source: 'confirmed' },
    { instanceId: 'rotazione-cervicale', alterationId: 'deviazione_rachidea_cervicale', descriptor: 'rotation', direction: 'rotazione_sx', severity: 'moderato', source: 'confirmed' },
  ] }
}

describe('componenti cinematiche indipendenti', () => {
  it('rotation frontale ammette solo rotazione_dx/rotazione_sx anche con override di catalogo', () => {
    for (const plane of ['frontale_anteriore', 'frontale_posteriore'] as const) {
      expect(getDirectionsForDescriptor(plane, 'rotation')).toEqual(['rotazione_dx', 'rotazione_sx'])
      for (const alteration of getAlterationsForPlane(plane)) expect(getAllowedDirections(plane, alteration.id, 'rotation')).toEqual(['rotazione_dx', 'rotazione_sx'])
      expect(getAllowedDirections(plane, 'deviazione_rachidea_cervicale', 'shift')).toEqual(['dx', 'sx'])
      expect(getAllowedDirections(plane, 'tilt_capo', 'tilt')).toEqual(['dx', 'sx'])
      expect(getAllowedDirections(plane, 'tilt_capo', 'compenso')).toEqual([])
    }
  })
  it('conserva shift DX e rotation SX fino a Myers senza tilt o bend automatici', () => {
    const spy = vi.spyOn(myers, 'inferMyersForAlteration')
    try {
      const original = cervical()
      const before = structuredClone(original)
      const result = runClinicalPipeline([original])
      expect(original).toEqual(before)
      expect(result.observations.map(o => o.descriptor)).toEqual(['shift', 'rotation'])
      expect(result.patterns).toHaveLength(2)
      expect(result.patterns.map(patternSelection).map(p => [p.descriptor, p.direction])).toEqual([['shift', 'dx'], ['rotation', 'rotazione_sx']])
      expect(spy.mock.calls.map(([, selection]) => [selection.descriptor, selection.direction])).toEqual([['shift', 'dx'], ['rotation', 'rotazione_sx']])
      expect(result.inferences).toHaveLength(2)
      expect(result.patterns.some(p => p.descriptor === 'tilt' || p.descriptor === 'bend')).toBe(false)
      expect(consolidateObservations(result.observations.map(o => ({ ...o, patternId: 'gruppo-cervicale', direction: 'dx' })))).toHaveLength(2)
      const sameDirection = result.observations.map(o => ({ ...o, direction: 'dx' as const }))
      expect(consolidateObservations(sameDirection)).toHaveLength(2)
    } finally { spy.mockRestore() }
  })
  it('preserva bend esplicito e deduplica solo componenti equivalenti', () => {
    const plane = cervical()
    plane.alterations.push({ ...plane.alterations[0], instanceId: 'bend', descriptor: 'bend' })
    plane.alterations.push({ ...plane.alterations[0], instanceId: 'shift-duplicato' })
    const result = runClinicalPipeline([plane])
    expect(result.patterns).toHaveLength(3)
    expect(result.patterns.map(patternSelection).map(p => p.descriptor)).toEqual(['shift', 'rotation', 'bend'])
  })
  it('report e riapertura mantengono Shift DX e Rotazione SX distinti e senza tilt', () => {
    const a = createEmptyAssessment()
    a.planeAssessments = [cervical()]
    const restored = hydrateAssessment(a)
    expect(restored.planeAssessments[0].alterations).toEqual(a.planeAssessments[0].alterations)
    const generated = generateAssessmentReport(restored)
    const text = buildTextReportLines(generated)!.join('\n')
    expect(text).toContain('Deviazione cervicale — Shift DX')
    expect(text).toContain('Deviazione cervicale — Rotazione SX')
    expect(text).not.toContain('Tilt')
    expect(text).not.toContain('Bend')
    expect(generated.report!.clinicalPipeline!.patterns).toHaveLength(2)
    expect(formatAlterationInstanceSummary(cervical().alterations[0])).toContain('Shift DX')
    expect(formatAlterationInstanceSummary(cervical().alterations[1])).toContain('Rotazione SX')
  })
  it('non trasferisce la direzione dello shift quando si seleziona rotation', () => {
    const selection = cervical().alterations[0]
    expect(buildAlterationUpdatePatch('frontale_posteriore', selection.alterationId, selection, { descriptor: 'rotation' }).direction).toBeUndefined()
    expect(buildAlterationUpdatePatch('frontale_posteriore', selection.alterationId, selection, { descriptor: 'rotation', direction: 'rotazione_sx' }).direction).toBe('rotazione_sx')
    expect(buildAlterationUpdatePatch('frontale_posteriore', selection.alterationId, selection, { descriptor: 'rotation', direction: 'sx' }).direction).toBeUndefined()
  })
  it('capo ha componenti indipendenti nei due cataloghi frontali; cervicale conserva bend', () => {
    for (const plane of ['frontale_anteriore', 'frontale_posteriore'] as const) {
      for (const id of ['tilt_capo', 'shift_capo', 'rotazione_capo']) expect(getAlterationsForPlane(plane).some(a => a.id === id)).toBe(true)
    }
    expect(getAlterationsForPlane('frontale_posteriore').find(a => a.id === 'deviazione_rachidea_cervicale')!.suggestedDescriptors).toEqual(['shift', 'bend', 'rotation'])
  })
})
