// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { PlaneClinicalPanel } from '@/components/PlaneClinicalPanel'
import { frontal21Landmarks } from '@/testFixtures/frontalLandmarks'
import type { PlaneAssessment } from '@/types'
import { runClinicalPipeline } from '@/utils/clinicalPipeline'
import { computeAutoMeasurements } from '@/utils/biomechanicsEngine'

it('mostra tutte le misure e richiede conferma; preserva modifiche, esclusioni e conferme al ricalcolo', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'), root = createRoot(host)
  const landmarks = frontal21Landmarks()
  let assessment: PlaneAssessment
  function Harness() {
    const [state, setState] = useState<PlaneAssessment>({ plane: 'frontale_anteriore', alterations: [] })
    assessment = state
    return createElement(PlaneClinicalPanel, { plane: state.plane, assessment: state, landmarks, onAssessmentChange: setState })
  }
  const measurements = computeAutoMeasurements('frontale_anteriore', landmarks)
  try {
    await act(async () => root.render(createElement(Harness)))
    for (const text of ['Asse femoro-tibiale DX', 'Asse femoro-tibiale SX', 'Rotazione arto inferiore DX', 'Rotazione arto inferiore SX']) expect(host.textContent).toContain(text)
    expect(host.textContent).toContain('Inclinazione linea bipupillare: 0°')
    expect(runClinicalPipeline([assessment!], measurements).patterns).toHaveLength(0)
    const region = host.querySelector('[aria-label="Osservazioni automatiche da confermare"]')!
    const proposedCard = [...region.children].find(el => el.textContent?.includes('dislivello acromiale'))!
    const button = (text: string) => [...proposedCard.querySelectorAll('button')].find(b => b.textContent === text)!
    await act(async () => button('Modifica').click())
    const note = proposedCard.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(note, 'correzione clinica manuale')
      note.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(runClinicalPipeline([assessment!], measurements).patterns).toHaveLength(0)
    await act(async () => button('Conferma').click())
    expect(runClinicalPipeline([assessment!], measurements).patterns[0].notes).toBe('correzione clinica manuale')
    // A rerender/recalculation never creates a second observation for the same measurement.
    await act(async () => root.render(createElement(Harness)))
    expect(assessment!.observations).toHaveLength(1)
    expect(runClinicalPipeline([assessment!], measurements).patterns).toHaveLength(1)
    const confirmedCard = [...region.children].find(el => el.textContent?.includes('dislivello acromiale'))!
    await act(async () => [...confirmedCard.querySelectorAll('button')].find(b => b.textContent === 'Escludi')!.click())
    expect(runClinicalPipeline([assessment!], measurements).patterns).toHaveLength(0)
    expect(assessment!.observations![0].status).toBe('excluded')
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
