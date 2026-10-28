import { beforeAll, afterAll, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { buildPatientExportZip } from '@/utils/patientExport'
import { parsePatientExportContents, parsePatientExportFolder } from '@/utils/patientImport'
import { reportAssessment } from '@/testFixtures/reportAssessment'

beforeAll(() => vi.stubGlobal('FileReader', class {
  result = ''; onload?: () => void; onerror?: () => void
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onload?.() }) }
}))
afterAll(() => vi.unstubAllGlobals())

async function fixture() {
  const assessment = reportAssessment()
  assessment.defaultSubjectHeightCm = 175
  assessment.photos[0].calibration = { mode: 'subject_height', subjectHeightCm: 175, status: 'estimated' }
  const zipped = await buildPatientExportZip(assessment)
  return { assessment, contents: unzipSync(new Uint8Array(await zipped.arrayBuffer())) }
}
it('importa cartella con immagini, landmark, calibrazione, antropometria e documenti originali senza inventare il report', async () => {
  const { assessment, contents } = await fixture()
  const files = Object.entries(contents).map(([name, bytes]) => {
    const file = new File([Uint8Array.from(bytes)], name.split('/').pop()!)
    Object.defineProperty(file, 'webkitRelativePath', { value: 'export-sintetico/' + name })
    return file
  })
  const imported = (await parsePatientExportFolder(files)).assessment
  expect(imported.patient).toEqual(assessment.patient)
  expect(imported.photos[0].calibration).toEqual(assessment.photos[0].calibration)
  expect(imported.photos.map(p => p.annotations.landmarks)).toEqual(assessment.photos.map(p => p.annotations.landmarks))
  expect(imported.defaultSubjectHeightCm).toBe(175)
  expect(imported.report).toBeNull()
  expect(imported.importedFiles?.some(f => f.path.endsWith('clinical/thresholds.json'))).toBe(true)
})
it('rifiuta file dichiarati mancanti, percorsi pericolosi e manifest ambigui', async () => {
  const { contents } = await fixture()
  const missing = { ...contents }; delete missing['patient.json']
  await expect(parsePatientExportContents(missing)).rejects.toThrow()
  await expect(parsePatientExportContents({ ...contents, '../unsafe': new Uint8Array() })).rejects.toThrow()
  await expect(parsePatientExportContents({ ...contents, 'other/manifest.json': contents['manifest.json'] })).rejects.toThrow()
})
it('riesporta e reimporta preservando i documenti senza collisioni con il manifest originale', async () => {
  const { contents } = await fixture()
  const first = (await parsePatientExportContents(contents)).assessment
  const zipped = await buildPatientExportZip(first)
  const second = (await parsePatientExportContents(unzipSync(new Uint8Array(await zipped.arrayBuffer())))).assessment
  for (const file of first.importedFiles ?? []) expect(second.importedFiles).toContainEqual(file)
  expect(second.photos.map(p => p.dataUrl)).toEqual(first.photos.map(p => p.dataUrl))
})
