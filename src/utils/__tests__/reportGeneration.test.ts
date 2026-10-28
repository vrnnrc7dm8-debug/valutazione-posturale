import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateAssessmentReport, isReportStale } from '@/utils/reportGeneration'
import { buildTextReportLines } from '@/utils/export'
import { reportAssessment } from '@/testFixtures/reportAssessment'
import { countLandmarks } from '@/utils/landmarkCollection'
import { createEmptyAssessment, hydrateAssessment } from '@/utils/storage'
import { PLANE_LABELS } from '@/types'
import { saveAssessmentToStorage } from '@/storage/clinicalStorage'
import { buildPatientExportZip } from '@/utils/patientExport'
import { parsePatientExportZip } from '@/utils/patientImport'

afterEach(() => vi.unstubAllGlobals())
describe('report della valutazione corrente', () => {
  it('elabora 5 foto, 67 landmark e 29 alterazioni senza modificare gli input', () => {
    const source = reportAssessment()
    const before = structuredClone(source)
    expect(source.photos.reduce((n, p) => n + countLandmarks(p.annotations.landmarks), 0)).toBe(67)
    expect(source.planeAssessments.reduce((n, p) => n + p.alterations.length, 0)).toBe(29)
    const generated = generateAssessmentReport(source)
    expect(source).toEqual(before)
    expect(generated.photos).toBe(source.photos)
    expect(generated.patient).toBe(source.patient)
    expect(generated.archiveKey).toBe(source.archiveKey)
    expect(generated.report?.sections.map(s => s.plane)).toEqual(source.photos.map(p => p.plane))
    expect(generated.report?.sections.flatMap(s => s.observedAlterations)).toHaveLength(27)
    expect(generated.report?.mainAlterations).toHaveLength(27)
    expect(generated.report?.sections.flatMap(s => s.autoMeasurements).length).toBeGreaterThan(0)
    expect(generated.report?.quantitativePosturalFindings?.every(f => Number.isFinite(f.value) && f.reportEligible !== false)).toBe(true)
    expect(generated.report?.antropometria).toMatchObject({ pesoKg: 70, altezzaCm: 175 })
  })
  it('produce cinque sezioni senza attribuire normalità o compensi a dati assenti', () => {
    const a = createEmptyAssessment()
    const generated = generateAssessmentReport(a)
    expect(generated.report?.sections).toHaveLength(5)
    expect(generated.report?.priorityEvaluable).toBe(false)
    expect(generated.report?.sections.every(s => s.autoMeasurements.length === 0 && s.myersLines.length === 0 && s.dataAvailability?.photoPresent === false)).toBe(true)
    expect(generated.report?.alteredMeridians).toEqual([])
    expect(generated.report?.primaryCompensationHypothesis).toContain('Dati insufficienti')
    const text = buildTextReportLines(generated)!.join('\n')
    for (const label of Object.values(PLANE_LABELS)) expect(text).toContain(label)
    expect(text).toContain('NON VALUTABILE')
    expect(text).not.toContain('NaN')
  })
  it('esclude proposte non confermate e coordinate non valide dalle misure definitive', () => {
    const a = reportAssessment()
    a.planeAssessments.forEach(pa => { pa.alterations = [] })
    a.photos.forEach(photo => {
      photo.annotations.landmarks.autoProposals = photo.annotations.landmarks.manual.map(lm => ({ ...lm, validationState: 'automatico_stimato', detectionSource: 'automatic', needsConfirmation: true }))
      photo.annotations.landmarks.manual = []
    })
    a.photos[0].annotations.landmarks.confirmed = [{ ...a.photos[0].annotations.landmarks.autoProposals[0], validationState: 'manuale_confermato', position: { x: NaN, y: 0.2 } }]
    const result = generateAssessmentReport(a).report!
    expect(result.sections.flatMap(s => s.autoMeasurements)).toEqual([])
    expect(result.quantitativePosturalFindings).toEqual([])
    expect(result.sections[0].dataAvailability?.excludedLandmarks).toBeGreaterThan(0)
  })
  it('include linee e angoli annotati solo con riferimenti validi e senza introdurre mm o diagnosi', () => {
    const a = reportAssessment()
    const photo = a.photos[4]
    const [first, vertex, last] = photo.annotations.landmarks.manual
    photo.annotations.lines.push({ id: 'test-line', landmarkAId: first.id, landmarkBId: vertex.id })
    photo.annotations.angles.push({ id: 'test-angle', landmarkAId: first.id, vertexLandmarkId: vertex.id, landmarkCId: last.id })
    photo.annotations.angles.push({ id: 'missing', landmarkAId: 'missing', vertexLandmarkId: vertex.id, landmarkCId: last.id })
    const generated = generateAssessmentReport(a)
    const section = generated.report!.sections[4]
    expect(section.autoMeasurements.some(m => m.startsWith('Linea annotata 1:'))).toBe(true)
    expect(section.autoMeasurements.some(m => m.startsWith('Angolo annotato 1:'))).toBe(true)
    expect(section.autoMeasurements.some(m => m.startsWith('Angolo annotato 2:'))).toBe(false)
    expect(section.autoMeasurements.join(' ')).toContain('coordinate normalizzate')
    expect(section.autoMeasurements.join(' ')).not.toContain('mm')
    expect(buildTextReportLines(generated)!.join('\n')).toContain(section.autoMeasurements.at(-1))
  })
  it('non usa landmark residui quando manca la fotografia e conserva le osservazioni registrate', () => {
    const a = reportAssessment()
    a.photos.forEach(p => { p.dataUrl = undefined })
    const report = generateAssessmentReport(a).report!
    expect(report.sections.flatMap(s => s.autoMeasurements)).toEqual([])
    expect(report.quantitativePosturalFindings).toEqual([])
    expect(report.sections.flatMap(s => s.observedAlterations)).toHaveLength(27)
  })
  it('rileva report non aggiornati e richiede rigenerazione prima del testo e ZIP', async () => {
    const a = generateAssessmentReport(reportAssessment())
    a.inputRevision = 1
    expect(isReportStale(a)).toBe(true)
    expect(() => buildTextReportLines(a)).toThrow('rigenera')
    await expect(buildPatientExportZip(a)).rejects.toThrow('rigenera')
    const regenerated = generateAssessmentReport(a)
    expect(isReportStale(regenerated)).toBe(false)
    expect(regenerated.report?.sourceRevision).toBe(1)
  })
  it('conserva lo stesso report visualizzato nel payload API, nella riapertura e nel testo', async () => {
    const a = generateAssessmentReport(reportAssessment())
    const report = structuredClone(a.report)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    vi.stubGlobal('fetch', fetchMock)
    await saveAssessmentToStorage(a)
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    // Wire payload shares current photo bytes; the backend returns complete photographs.
    expect(payload.report.photographs.every((photo: { reportSourcePlane?: string; dataUrl?: string }) => photo.reportSourcePlane && !photo.dataUrl)).toBe(true)
    const reopened = structuredClone(payload)
    reopened.report.photographs = report!.photographs
    expect(hydrateAssessment(reopened).report).toEqual(report)
    expect(payload.report.sections).toEqual(report!.sections)
    const lines = buildTextReportLines(a)!.join('\n')
    for (const section of report!.sections) {
      expect(lines).toContain(section.planeLabel)
      for (const metric of section.autoMeasurements) expect(lines).toContain(metric)
    }
    expect(lines).toContain('Peso: 70,0 kg')
    expect(buildTextReportLines(a)).toEqual(buildTextReportLines(a))
  })
  it('mantiene antropometria del report precedente durante una modifica non ancora rigenerata', async () => {
    const a = generateAssessmentReport(reportAssessment())
    a.patient = { ...a.patient, antropometria: { pesoKg: 90, altezzaCm: 180 } }
    a.inputRevision = 1
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    vi.stubGlobal('fetch', fetchMock)
    await saveAssessmentToStorage(a)
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.report.antropometria.pesoKg).toBe(70)
    expect(payload.patient.antropometria.pesoKg).toBe(90)
  })
  it('preserva revisione input e report nel ciclo ZIP con soli dati sintetici', async () => {
    const a = reportAssessment()
    a.photos.forEach(p => { p.dataUrl = undefined })
    a.inputRevision = 3
    const generated = generateAssessmentReport(a)
    const zip = await buildPatientExportZip(generated)
    const reopened = await parsePatientExportZip(new File([await zip.arrayBuffer()], 'report-test.zip'))
    expect(reopened.assessment.inputRevision).toBe(3)
    expect(reopened.assessment.report).toEqual(generated.report)
    expect(isReportStale(reopened.assessment)).toBe(false)
  })
})
