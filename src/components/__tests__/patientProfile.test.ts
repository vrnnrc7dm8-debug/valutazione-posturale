// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { PatientArchive } from '@/components/PatientArchive'
import type { Assessment } from '@/types'
import { createEmptyAssessment } from '@/utils/storage'

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
afterEach(() => vi.unstubAllGlobals())

async function setup(archived = false) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let patient = { ...createEmptyAssessment().patient, id: 'TEST-001', nome: 'Ilaro', cognome: 'Giuseppe', sesso: 'M', noteCliniche: 'Originali', evaluationCount: 1, lastEvaluationDate: '2026-01-10', antropometria: { pesoKg: 70, altezzaCm: 175, dataMisurazione: '2026-01-10' } }
  let opened: Assessment | undefined
  let fail = false
  const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    if (options.method === 'PUT') {
      if (fail) return { ok: false, json: async () => ({ error: 'Lexar scollegato' }) }
      patient = { ...patient, ...JSON.parse(options.body as string), homonymCount: 1 }
    }
    return { ok: true, json: async () => url.includes('patient-directory') ? { patients: [patient], total: 1, offset: 0, limit: 25 } : url.includes('assessments?') ? [{ id: 7, date: '2026-01-10' }] : patient }
  })
  vi.stubGlobal('fetch', fetchMock)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const click = async (text: string) => { await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text))!.click()) }
  await act(async () => root.render(createElement(PatientArchive, { onOpen: async load => { opened = await load() }, activeCode: 'TEST-001' })))
  await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  if (archived) { await click('Pazienti archiviati'); await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
  await click('Giuseppe Ilaro')
  const edit = async (label: string, value: string) => {
    const input = [...host.querySelectorAll('label')].find(l => l.textContent?.startsWith(label))!.querySelector('input,select,textarea')!
    const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })) })
  }
  return { host, click, edit, fetchMock, opened: () => opened, fail: () => { fail = true }, cleanup: async () => { await act(async () => root.unmount()); host.remove() } }
}

it('visualizza e aggiorna il master, mantenendo codice, misure, storico e selezione', async () => {
  const s = await setup()
  try {
    expect(s.host.textContent).toContain('70 kg'); expect(s.host.textContent).toContain('175 cm')
    expect(s.host.textContent).toContain('2026-01-10')
    await s.click('Modifica dati paziente')
    expect(s.host.querySelector<HTMLInputElement>('input[readonly]')!.value).toBe('TEST-001')
    await s.edit('Nome', 'Illardo'); await s.edit('Cognome', 'Corretto'); await s.edit('Sesso', 'F'); await s.edit('Note cliniche', 'Nuove note')
    await s.click('Salva modifiche')
    const put = s.fetchMock.mock.calls.find(([, o]) => o.method === 'PUT')!
    expect(put[0]).toBe('/api/patients')
    expect(JSON.parse(put[1].body as string)).toEqual({ id: 'TEST-001', nome: 'Illardo', cognome: 'Corretto', sesso: 'F', noteCliniche: 'Nuove note' })
    expect(s.host.querySelector('[aria-label="Elenco pazienti"]')!.textContent).toContain('Corretto Illardo')
    expect(s.host.textContent).toContain('Dati paziente aggiornati'); expect(s.host.textContent).toContain('codici clinici restano distinti')
    expect(s.host.textContent).toContain('valutazione già aperta conserva'); expect(s.host.textContent).toContain('Apri valutazione 7')
    expect(s.host.textContent).toContain('70 kg'); expect(s.host.textContent).toContain('2026-01-10')
    await s.click('Nuova valutazione per questo paziente')
    expect(s.opened()?.patient).toMatchObject({ id: 'TEST-001', nome: 'Illardo', cognome: 'Corretto', sesso: 'F' })
    expect(s.host.textContent!.indexOf('SCHEDA PAZIENTE')).toBeLessThan(s.host.textContent!.indexOf('NUOVA VALUTAZIONE'))
    expect(s.host.textContent!.indexOf('Storico valutazioni')).toBeLessThan(s.host.textContent!.indexOf('GESTIONE PAZIENTE'))
  } finally { await s.cleanup() }
})

it('annulla senza PUT e conserva i dati originali dopo errore backend', async () => {
  const s = await setup()
  try {
    await s.click('Modifica dati paziente'); await s.edit('Nome', 'Da annullare'); await s.click('Annulla')
    expect(s.fetchMock.mock.calls.some(([, o]) => o.method === 'PUT')).toBe(false)
    await s.click('Modifica dati paziente'); await s.edit('Nome', 'Fallito'); s.fail(); await s.click('Salva modifiche')
    expect(s.host.textContent).toContain('Lexar scollegato')
    expect(s.host.querySelector('[aria-label="Elenco pazienti"]')!.textContent).toContain('Giuseppe Ilaro')
    await s.click('Annulla'); expect(s.host.textContent).not.toContain('Fallito')
  } finally { await s.cleanup() }
})

it('mostra il paziente archiviato in sola lettura', async () => {
  const s = await setup(true)
  try { expect(s.host.textContent).toContain('ripristinalo per modificare'); expect(s.host.textContent).not.toContain('Modifica dati paziente') }
  finally { await s.cleanup() }
})
