// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import * as engine from '@/utils/analysisEngine'
import type { PhotoSlot, Assessment } from '@/types'
import { createEmptyAssessment } from '@/utils/storage'
import { generateAssessmentReport } from '@/utils/reportGeneration'
import { buildTextReportLines } from '@/utils/export'
import { PLANE_LABELS } from '@/types'
import { initializeClinicalStorage, saveAssessmentToStorage } from '@/storage/clinicalStorage'
import { reportAssessment } from '@/testFixtures/reportAssessment'

vi.mock('@/storage/clinicalStorage', async original => ({ ...await original<typeof import('@/storage/clinicalStorage')>(), initializeClinicalStorage: vi.fn(), saveAssessmentToStorage: vi.fn() }))
vi.mock('@/components/SummarySidebar', () => ({ SummarySidebar: () => null }))
vi.mock('@/components/PatientArchive', () => ({ PatientArchive: () => null }))
vi.mock('@/components/PhotoUploadPanel', () => ({ PhotoUploadPanel: ({ photos, onChange }: { photos: PhotoSlot[]; onChange: (next: PhotoSlot[]) => void }) => createElement('button', { onClick: () => {
  const next = structuredClone(photos)
  const lm = next[0].annotations.landmarks.manual.find(l => l.landmarkId === 'acromion_sx')!
  lm.position.y += 0.05
  onChange(next)
} }, 'Modifica landmark sintetico') }))
let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('alert', vi.fn())
  vi.mocked(initializeClinicalStorage).mockResolvedValue(reportAssessment())
  vi.mocked(saveAssessmentToStorage).mockResolvedValue()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals()
})
it('mostra il report calcolato dal pulsante e salva lo stesso contenuto visualizzato', async () => {
  await act(async () => root.render(createElement(App)))
  const generate = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Genera report')!
  await act(async () => { generate.click(); await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(host.textContent).toContain('Scheda ipotesi funzionale posturale e miofasciale')
  expect(host.textContent).not.toContain('Genera il report per visualizzare')
  expect(vi.mocked(saveAssessmentToStorage).mock.calls.at(-1)?.[0].report).toBeTruthy()
})

function button(text: string) {
  const found = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(text))
  if (!found) throw new Error('Missing button: '+text)
  return found
}
async function generate() {
  const btn = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Genera report' || b.textContent === 'Rigenera report')!
  await act(async () => { btn.click(); await new Promise(resolve => setTimeout(resolve, 10)) })
}
async function tab(text: string) {
  const trigger = Array.from(host.querySelectorAll('[role="tab"]')).find(b => b.textContent === text)!
  await act(async () => { trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })) })
}
function saved(): Assessment { return vi.mocked(saveAssessmentToStorage).mock.calls.at(-1)![0] }

it('mostra caricamento e blocca clic duplicati mentre il motore sta per elaborare', async () => {
  await act(async () => root.render(createElement(App)))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await act(async () => { button('Genera report').click() })
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Elaborazione')
  expect(button('Generazione…').disabled).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(host.textContent).toContain('Scheda ipotesi funzionale')
})

it.each(['incompleta', 'senza foto'] as const)('genera e visualizza una valutazione %s senza inventare valori', async kind => {
  const a = createEmptyAssessment(); a.patient.nome = 'Sintetico'
  if (kind === 'incompleta') {
    const sample = reportAssessment(); a.photos[0] = sample.photos[0]
  }
  vi.mocked(initializeClinicalStorage).mockResolvedValue(a)
  await act(async () => root.render(createElement(App)))
  await generate()
  for (const label of Object.values(PLANE_LABELS)) expect(host.textContent).toContain(label)
  expect(host.textContent).toContain('Fotografia non disponibile')
  expect(host.textContent).not.toContain('NaN')
  expect(host.textContent).not.toContain('Genera il report per visualizzare')
  if (kind === 'senza foto') expect(host.textContent).toContain('Priorità non valutabile')
})

it('mostra errori di calcolo e consente di riprovare senza alterare gli input', async () => {
  const input = reportAssessment()
  vi.mocked(initializeClinicalStorage).mockResolvedValue(input)
  vi.spyOn(engine, 'runFullAnalysis').mockImplementationOnce(() => { throw new Error('Errore geometrico sintetico') })
  await act(async () => root.render(createElement(App)))
  await generate()
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Errore geometrico sintetico')
  expect(vi.mocked(saveAssessmentToStorage)).not.toHaveBeenCalled()
  expect(input.report).toBeNull()
  expect(input.photos.reduce((n, p) => n + p.annotations.landmarks.manual.length, 0)).toBe(67)
  await generate()
  expect(host.textContent).toContain('Scheda ipotesi funzionale')
  expect(host.textContent).not.toContain('Errore geometrico sintetico')
})

it('mantiene visibile il report se il Lexar non salva e permette di ritentare il salvataggio', async () => {
  vi.mocked(saveAssessmentToStorage).mockRejectedValueOnce(new Error('Lexar non collegato'))
  await act(async () => root.render(createElement(App)))
  await generate()
  expect(host.textContent).toContain('Report generato e visibile, ma non salvato sul Lexar')
  expect(host.textContent).toContain('Scheda ipotesi funzionale')
  const report = structuredClone(saved().report)
  await act(async () => { button('Riprova salvataggio').click() })
  expect(saved().report).toEqual(report)
  expect(host.textContent).not.toContain('ma non salvato sul Lexar')
})

it('conserva report precedente e revisioni se una rigenerazione fallisce', async () => {
  await act(async () => root.render(createElement(App)))
  await generate()
  const report = structuredClone(saved().report)
  vi.spyOn(engine, 'runFullAnalysis').mockImplementationOnce(() => { throw new Error('Calcolo non disponibile') })
  await generate()
  expect(host.textContent).toContain('Calcolo non disponibile')
  expect(host.textContent).toContain('Scheda ipotesi funzionale')
  expect(saved().report).toEqual(report)
})

it('aggiorna ref e stato: salva il report anche dopo cambio scheda, modifica landmark e rigenerazione', async () => {
  await act(async () => root.render(createElement(App)))
  await generate()
  const originalMetrics = saved().report!.sections[0].autoMeasurements
  await tab('Fotografie')
  expect(saved().report).not.toBeNull()
  await act(async () => { button('Modifica landmark sintetico').click() })
  expect(button('Esporta report testuale').disabled).toBe(true)
  await generate()
  expect(saved().report!.sections[0].autoMeasurements).not.toEqual(originalMetrics)
  expect(saved().report!.sourceRevision).toBe(saved().inputRevision)
  expect(buildTextReportLines(saved())!.join('\n')).toContain(saved().report!.sections[0].autoMeasurements[0])
  expect(saved().photos.reduce((n, p) => n + p.annotations.landmarks.manual.length, 0)).toBe(67)
  expect(saved().planeAssessments.reduce((n, p) => n + p.alterations.length, 0)).toBe(29)
})

it('usa la valutazione caricata anche dopo un accesso iniziale fallito', async () => {
  vi.mocked(initializeClinicalStorage).mockRejectedValueOnce(new Error('Sessione richiesta'))
  await act(async () => root.render(createElement(App)))
  await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await generate()
  expect(saved().patient.nome).toBe('Sintetico')
  expect(saved().report!.sections.flatMap(s => s.observedAlterations)).toHaveLength(29)
})

it('non rimpiazza con dati vecchi un report visibile quando si completa un salvataggio precedente', async () => {
  let finish!: () => void
  vi.mocked(saveAssessmentToStorage).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  await act(async () => root.render(createElement(App)))
  await tab('Fotografie')
  await act(async () => { button('Modifica landmark sintetico').click() })
  await tab('Report') // flushes the modified assessment with report:null
  await generate()
  expect(host.textContent).toContain('Scheda ipotesi funzionale')
  await act(async () => { finish() })
  expect(saved().report).toBeTruthy()
  expect(host.textContent).not.toContain('Genera il report per visualizzare')
})

it('visualizza un report archiviato senza rigenerarlo e preserva il contenuto nel flush', async () => {
  const a = generateAssessmentReport(reportAssessment())
  vi.mocked(initializeClinicalStorage).mockResolvedValue(a)
  await act(async () => root.render(createElement(App)))
  // The renderer receives the existing report; opening its tab only flushes the same assessment.
  await tab('Report')
  expect(host.textContent).toContain('Scheda ipotesi funzionale')
  expect(vi.mocked(saveAssessmentToStorage)).not.toHaveBeenCalled()
})
