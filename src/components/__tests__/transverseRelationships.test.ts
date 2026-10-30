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

it('UI conserva ante/retro e permette di registrare una relazione con orientamento non determinabile', async () => {
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
    expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Conferma')!.disabled).toBe(false)
    expect(host.textContent).toContain('non attribuisce un lato a Myers')
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})

it('modifica una dissociazione con orientamento e riferimento espliciti, senza menu Direzione DX/SX', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const { useState } = await import('react')
  const host = document.createElement('div'); const root = createRoot(host)
  const decision = vi.fn()
  function Harness() {
    const [observation, setObservation] = useState<ClinicalObservation>({ id: 'legacy', sourceIds: ['legacy'], plane: 'trasverso', phenomenon: 'relazione_scapolo_pelvica', district: 'toraco_lombare', descriptor: 'dissociazione', direction: 'sx', source: 'manual', status: 'suggested', severity: 'moderato' })
    return createElement(AutomaticObservationsPanel, { observations: [observation], onDecision: o => { decision(o); setObservation(o) } })
  }
  const click = async (text: string) => act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === text)!.click())
  const select = async (text: string, value: string) => act(async () => {
    const input = [...host.querySelectorAll('label')].find(l => l.textContent?.startsWith(text))!.querySelector('select')!
    input.value = value; input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  try {
    await act(async () => root.render(createElement(Harness)))
    await click('Modifica')
    expect([...host.querySelectorAll('label')].some(l => l.textContent?.startsWith('Direzione'))).toBe(false)
    expect(host.textContent).toContain('Lato SX anteposto')
    expect(host.textContent).toContain('Cingolo pelvico ↔ linea bicalcaneare')
    await select('Riferimento', 'pelvico_bicalcaneare')
    await select('Orientamento anatomico', 'sx_anteposto')
    await click('Conferma')
    expect(decision).toHaveBeenLastCalledWith(expect.objectContaining({ direction: undefined, status: 'confirmed', descriptor: 'dissociazione', transverseRelation: expect.objectContaining({ orientation: 'sx_anteposto', reference: 'pelvico_bicalcaneare', legacyDirection: 'sx' }) }))
    expect(host.textContent).toContain('Ileo SX anteposto rispetto alla linea bicalcaneare')
    expect(host.textContent).not.toMatch(/Dissociazione[ ·—–]+SX/)
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
