// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { PlaneAssessment } from '@/types'
import { usePlaneAlterations } from '@/hooks/usePlaneAlterations'
import { runClinicalPipeline } from '@/utils/clinicalPipeline'

it('preserva correzioni e esclusioni quando il suggerimento viene riproposto', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  let api!: ReturnType<typeof usePlaneAlterations>
  let assessment: PlaneAssessment
  function Harness() {
    const [value, setValue] = useState<PlaneAssessment>({ plane: 'sagittale_destro', alterations: [] })
    assessment = value
    api = usePlaneAlterations(value.plane, value, setValue)
    return null
  }
  try {
    await act(async () => root.render(createElement(Harness)))
    await act(async () => api.confirmSuggestion('anteriorizzazione_capo', { side: 'destro', severity: 'severo' }))
    const id = assessment!.alterations[0].instanceId
    await act(async () => api.updateAlteration(id, { side: 'sinistro', severity: 'lieve', note: 'correzione manuale' }))
    await act(async () => api.confirmSuggestion('anteriorizzazione_capo', { side: 'destro', severity: 'severo' }))
    expect(assessment!.alterations).toHaveLength(1)
    expect(assessment!.alterations[0]).toMatchObject({ side: 'sinistro', severity: 'lieve', note: 'correzione manuale', status: 'modified' })
    await act(async () => api.updateAlteration(id, { status: 'excluded' }))
    await act(async () => api.confirmSuggestion('anteriorizzazione_capo', { side: 'destro' }))
    expect(assessment!.alterations[0].status).toBe('excluded')
    expect(runClinicalPipeline([assessment!]).patterns).toHaveLength(0)
    await act(async () => api.removeSuggestedAlteration('forward_head_posture'))
    expect(assessment!.alterations[1].status).toBe('excluded')
    await act(async () => api.confirmSuggestion('forward_head_posture'))
    expect(assessment!.alterations).toHaveLength(2)
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})

it('permette di modificare ed escludere insieme le osservazioni di un pattern', async () => {
  const { PlaneClinicalPanel } = await import('@/components/PlaneClinicalPanel')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  let assessment: PlaneAssessment
  function Harness() {
    const [value, setValue] = useState<PlaneAssessment>({ plane: 'sagittale_destro', alterations: [
      { instanceId: 'a', alterationId: 'anteriorizzazione_capo', descriptor: 'shift', severity: 'moderato', source: 'confirmed' },
      { instanceId: 'b', alterationId: 'forward_head_posture', descriptor: 'shift', severity: 'moderato', source: 'confirmed' },
    ] })
    assessment = value
    return createElement(PlaneClinicalPanel, { plane: value.plane, assessment: value, landmarks: [], onAssessmentChange: setValue })
  }
  try {
    await act(async () => root.render(createElement(Harness)))
    expect(host.textContent).toContain('2 osservazioni')
    const edit = [...host.querySelectorAll('button')].find(b => b.textContent === 'Modifica')!
    await act(async () => edit.click())
    const note = host.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(note, 'annotazione di pattern')
      note.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(assessment!.alterations.every(a => a.note === 'annotazione di pattern' && a.status === 'modified')).toBe(true)
    const exclude = [...host.querySelectorAll('button')].find(b => b.textContent === 'Escludi')!
    await act(async () => exclude.click())
    expect(assessment!.alterations.every(a => a.status === 'excluded')).toBe(true)
    expect(runClinicalPipeline([assessment!]).patterns).toEqual([])
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})

it('rappresenta due istanze cervicali indipendenti: Shift DX e Rotazione SX', async () => {
  const { PlaneClinicalPanel } = await import('@/components/PlaneClinicalPanel')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  let api!: ReturnType<typeof usePlaneAlterations>
  let assessment: PlaneAssessment
  function Harness() {
    const [value, setValue] = useState<PlaneAssessment>({ plane: 'frontale_posteriore', alterations: [] })
    assessment = value
    api = usePlaneAlterations(value.plane, value, setValue)
    return createElement(PlaneClinicalPanel, { plane: value.plane, assessment: value, landmarks: [], onAssessmentChange: setValue })
  }
  try {
    await act(async () => root.render(createElement(Harness)))
    await act(async () => api.addAlteration('deviazione_rachidea_cervicale', { descriptor: 'shift', direction: 'dx' }))
    await act(async () => api.addAlteration('deviazione_rachidea_cervicale', { descriptor: 'rotation', direction: 'rotazione_sx' }))
    expect(assessment!.alterations.map(a => [a.descriptor, a.direction])).toEqual([['shift', 'dx'], ['rotation', 'rotazione_sx']])
    expect(runClinicalPipeline([assessment!]).patterns).toHaveLength(2)
    expect(host.textContent).toContain('Deviazione cervicale — Shift DX')
    expect(host.textContent).toContain('Deviazione cervicale — Rotazione SX')
    expect(host.textContent).not.toContain('Tilt DX')
    expect(host.textContent).not.toContain('Bend DX')
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
