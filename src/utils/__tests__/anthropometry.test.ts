import { afterEach, describe, expect, it, vi } from 'vitest'
import { anthropometryReportLines, bmiClassification, calculateBmi, formatAnthropometric, parseItalianNumber, snapshotFromPatient, validMeasurement } from '@/utils/anthropometry'
import { createEmptyAssessment, hydrateAssessment } from '@/utils/storage'
import { loadAssessmentFromStorage, saveAssessmentToStorage } from '@/storage/clinicalStorage'
import { runFullAnalysis } from '@/utils/analysisEngine'
import { buildTextReportLines } from '@/utils/export'
import { buildPatientExportZip } from '@/utils/patientExport'
import { parsePatientExportZip } from '@/utils/patientImport'

afterEach(() => vi.unstubAllGlobals())

function measured() {
  const a = createEmptyAssessment()
  a.patient = { ...a.patient, nome: 'Sintetico', eta: 35, sesso: 'F', dataValutazione: '2026-01-10', antropometria: { pesoKg: 70.5, altezzaCm: 175.5 } }
  return a
}
describe('antropometria e BMI', () => {
  it('accetta virgola e punto italiani senza interpretare testo, notazione esponenziale o migliaia', () => {
    expect(parseItalianNumber(' 70,5 ')).toBe(70.5)
    expect(parseItalianNumber('175.5')).toBe(175.5)
    expect(parseItalianNumber('')).toBeNull()
    for (const bad of ['1,2,3', '1.000,5', '75kg', 'Infinity', '1e3', '-2']) expect(parseItalianNumber(bad)).toBeNaN()
  })
  it('calcola il BMI senza arrotondare le soglie e mostra una cifra decimale italiana', () => {
    expect(calculateBmi(70, 175)).toBeCloseTo(22.857142857)
    expect(formatAnthropometric(calculateBmi(70, 175))).toBe('22,9')
    expect(formatAnthropometric(null)).toBe('—')
    expect(bmiClassification(24.99, 30)).toBe('Normopeso')
  })
  it.each([[18.49, 'Sottopeso'], [18.5, 'Normopeso'], [24.9, 'Normopeso'], [25, 'Sovrappeso'], [29.99, 'Sovrappeso'], [30, 'Obesità']])('classifica BMI %s negli adulti', (bmi, label) => {
    expect(bmiClassification(Number(bmi), 18)).toBe(label)
  })
  it('esclude minori ed età ignota dalle soglie per adulti', () => {
    expect(bmiClassification(35, 17)).toContain('riferimenti per età e sesso')
    expect(bmiClassification(35, '')).toContain('classificazione adulti non applicata')
    expect(bmiClassification(35, null)).toContain('classificazione adulti non applicata')
    expect(bmiClassification(null, 30)).toBe('—')
  })
  it('valida intervalli plausibili ed evita zero, assenze e numeri non finiti', () => {
    for (const weight of [0, -1, NaN, Infinity, 501]) expect(calculateBmi(weight, 170)).toBeNull()
    for (const height of [0, -1, NaN, Infinity, 261]) expect(calculateBmi(70, height)).toBeNull()
    expect(calculateBmi(null, 170)).toBeNull()
    expect(calculateBmi(70, undefined)).toBeNull()
    expect(validMeasurement(0.3, 'pesoKg')).toBe(true)
    expect(validMeasurement(20, 'altezzaCm')).toBe(true)
  })
  it('trasmette misure e snapshot datato alle API e riapre conservando lo storico', async () => {
    const a = measured()
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) }).mockResolvedValueOnce({ ok: true, json: async () => a })
    vi.stubGlobal('fetch', fetchMock)
    await saveAssessmentToStorage(a)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.antropometriaSnapshot).toEqual({ pesoKg: 70.5, altezzaCm: 175.5, dataMisurazione: '2026-01-10', etaAnni: 35, sesso: 'F' })
    const reopened = await loadAssessmentFromStorage(a.patient.id, 1)
    expect(reopened.antropometriaSnapshot).toEqual(sent.antropometriaSnapshot)
    expect(reopened.patient.antropometria?.pesoKg).toBe(70.5)
    expect(hydrateAssessment(reopened).antropometriaSnapshot).toEqual(a.antropometriaSnapshot)
  })
  it('non invia valori invalidi e propaga il blocco migrazione senza fallback browser', async () => {
    const a = measured()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Antropometria non attivata: eseguire backup verificato e migrazione.' }) })
    vi.stubGlobal('fetch', fetchMock)
    a.patient.antropometria!.pesoKg = NaN
    await expect(saveAssessmentToStorage(a)).rejects.toThrow('non validi')
    expect(fetchMock).not.toHaveBeenCalled()
    a.patient.antropometria!.pesoKg = 70
    await expect(saveAssessmentToStorage(a)).rejects.toThrow('backup verificato')
  })
  it('integra misure e BMI nel report testuale e conserva i campi del report', () => {
    const a = measured()
    a.report = runFullAnalysis(a.planeAssessments, a.photos).report
    expect(buildTextReportLines(a)?.join('\n')).toContain('Peso: 70,5 kg')
    expect(buildTextReportLines(a)?.join('\n')).toContain('BMI: 22,9 kg/m²')
    expect(anthropometryReportLines(createEmptyAssessment())).toEqual([])
  })
  it('mantiene snapshot e misure nel ciclo ZIP export/import senza foto o dati reali', async () => {
    const a = measured()
    a.antropometriaSnapshot = snapshotFromPatient(a.patient)
    const zip = await buildPatientExportZip(a)
    const imported = await parsePatientExportZip(new File([await zip.arrayBuffer()], 'sintetico.zip', { type: 'application/zip' }))
    expect(imported.assessment.antropometriaSnapshot).toEqual(a.antropometriaSnapshot)
    expect(imported.assessment.patient.antropometria).toEqual(a.patient.antropometria)
  })
})
