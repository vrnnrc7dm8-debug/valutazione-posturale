// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AnthropometrySection } from '@/components/AnthropometrySection'
import { createEmptyPatient } from '@/utils/storage'
import type { Patient } from '@/types'

let root: Root
let host: HTMLDivElement
let patient: Patient
let changePatient: (p: Patient) => void
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove(); vi.unstubAllGlobals()
})
async function render(initial = { ...createEmptyPatient(), eta: 30 as number | '' }) {
  function Harness() {
    const [p, setPatient] = useState(initial)
    patient = p; changePatient = setPatient
    return createElement(AnthropometrySection, { patient: p, onChange: setPatient })
  }
  await act(async () => root.render(createElement(Harness)))
}
async function type(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>('#'+id)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
it('aggiorna immediatamente BMI con virgola italiana, senza attendere il salvataggio', async () => {
  await render()
  expect(host.querySelector('output')?.textContent).toBe('—')
  await type('pesoKg', '70,5'); await type('altezzaCm', '175,5')
  expect(patient.antropometria).toMatchObject({ pesoKg: 70.5, altezzaCm: 175.5 })
  expect(host.querySelector('output')?.textContent).toBe('22,9')
  expect(host.textContent).toContain('Normopeso')
  expect(host.querySelector<HTMLInputElement>('#pesoKg')?.value).toBe('70,5')
})
it('segnala input invalidi, BMI non disponibile e cancellazione dei dati', async () => {
  await render()
  await type('pesoKg', '70'); await type('altezzaCm', '0')
  expect(host.querySelector('#altezzaCm')?.getAttribute('aria-invalid')).toBe('true')
  expect(host.querySelector('output')?.textContent).toBe('—')
  await type('altezzaCm', 'abc')
  expect(host.querySelector('#altezzaCm')?.getAttribute('aria-invalid')).toBe('true')
  await type('altezzaCm', '')
  expect(patient.antropometria?.altezzaCm).toBeNull()
})
it('non classifica i minorenni e aggiorna le misure quando si cambia valutazione dello stesso paziente', async () => {
  await render({ ...createEmptyPatient(), eta: 17, dataValutazione: '2026-01-01', antropometria: { pesoKg: 60, altezzaCm: 170 } })
  expect(host.textContent).toContain('riferimenti per età e sesso')
  expect(host.textContent).not.toContain('Normopeso')
  await act(async () => changePatient({ ...patient, dataValutazione: '2025-01-01', antropometria: { pesoKg: 55, altezzaCm: 165 } }))
  expect(host.querySelector<HTMLInputElement>('#pesoKg')?.value).toBe('55')
  expect(host.textContent).toContain('2025-01-01')
})
