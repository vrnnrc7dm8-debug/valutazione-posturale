// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TransverseLandmarkOptions } from '@/components/TransverseLandmarkOptions'
import { AutomaticObservationsPanel } from '@/components/AutomaticObservationsPanel'
import type { ClinicalObservation } from '@/types'

it('dropdown trasverso raggruppa scapole, bacino, piedi e capo senza repere impropri', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  try {
    await act(async () => root.render(createElement(Select, { open: true },
      createElement(SelectTrigger, {}, createElement(SelectValue)),
      createElement(SelectContent, {}, createElement(TransverseLandmarkOptions)))))
    const list = document.querySelector('[role="listbox"]')!
    expect(list).toBeTruthy()
    const text = list.textContent!
    expect(text).toContain('SCAPOLE'); expect(text).toContain('BACINO'); expect(text).toContain('PIEDI'); expect(text).toContain('CAPO')
    expect(text).toContain('Scapulum DX'); expect(text).toContain('Ileo SX'); expect(text).toContain('Calcagno DX'); expect(text).toContain('Asse piede')
    expect(text).not.toMatch(/Pupilla|Acromion|Clavicola|Rotula|SIAS/)
    expect(list.querySelectorAll('[role="option"]')).toHaveLength(18)
  } finally { await act(async () => root.unmount()); host.remove(); if (scroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scroll); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); vi.unstubAllGlobals() }
})

it('UI conserva ante/retro e richiede direzione esplicita per una relazione', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'); const root = createRoot(host)
  const onDecision = vi.fn()
  const ap: ClinicalObservation = { id: 'ap', sourceIds: ['ap'], plane: 'trasverso', phenomenon: 'posizione_scapulum', district: 'cintura_scapolare', descriptor: 'anteposizione', direction: 'anteriore', side: 'destro', source: 'automatic_measurement', status: 'suggested', severity: 'lieve' }
  try {
    await act(async () => root.render(createElement(AutomaticObservationsPanel, { observations: [ap], onDecision })))
    expect(host.textContent).toContain('Anteposizione')
    const confirm = [...host.querySelectorAll('button')].find(b => b.textContent === 'Conferma')!
    expect(confirm.disabled).toBe(false)
    await act(async () => confirm.click())
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ descriptor: 'anteposizione', direction: 'anteriore', status: 'confirmed', side: 'destro' }))
    await act(async () => root.render(createElement(AutomaticObservationsPanel, { observations: [{ ...ap, id: 'relation', phenomenon: 'relazione_scapolo_pelvica', descriptor: 'dissociazione', direction: undefined }], onDecision })))
    expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Conferma')!.disabled).toBe(true)
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
