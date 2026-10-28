import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeClinicalStorage, loadAssessmentFromStorage, saveAssessmentToStorage } from '@/storage/clinicalStorage'
import { createEmptyAssessment } from '@/utils/storage'

afterEach(() => vi.unstubAllGlobals())

describe('persistenza API clinica', () => {
  it('salva e riapre mantenendo chiave valutazione e landmark', async () => {
    const a = createEmptyAssessment()
    a.patient.nome = 'Sintetico'
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) }).mockResolvedValueOnce({ ok: true, json: async () => a })
    vi.stubGlobal('fetch', fetchMock)
    await saveAssessmentToStorage(a)
    const loaded = await loadAssessmentFromStorage(a.patient.id, 1)
    expect(loaded.archiveKey).toBe(a.archiveKey)
    expect(loaded.photos[0].annotations.landmarks).toEqual(a.photos[0].annotations.landmarks)
    expect(fetchMock.mock.calls[0][1].headers['X-Clinical-App']).toBe('1')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).patient.nome).toBe('Sintetico')
  })
  it('propaga indisponibilità Lexar senza fallback browser', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Lexar non collegato: accesso e scritture bloccati.' }) }))
    const a = createEmptyAssessment()
    a.patient.nome = 'Sintetico'
    await expect(saveAssessmentToStorage(a)).rejects.toThrow('Lexar non collegato')
    await expect(initializeClinicalStorage()).rejects.toThrow('Lexar non collegato')
  })
})

it('non trasforma una risposta incompleta o riferita ad altro paziente in una scheda vuota', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
  await expect(loadAssessmentFromStorage('TEST-SYNTHETIC', 5)).rejects.toThrow('Nessuna scheda vuota creata')
  const wrong = createEmptyAssessment()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => wrong }))
  await expect(loadAssessmentFromStorage('TEST-SYNTHETIC', 5)).rejects.toThrow('altro paziente')
})
