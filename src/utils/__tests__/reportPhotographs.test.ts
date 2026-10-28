import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { reportAssessment } from '@/testFixtures/reportAssessment'
import { generateAssessmentReport } from '@/utils/reportGeneration'
import { buildReportHtml } from '@/utils/reportHtml'
import { ClinicalReport } from '@/components/ClinicalReport'

afterEach(() => vi.unstubAllGlobals())
function imageDecoder(fail = false) {
  vi.stubGlobal('Image', class {
    naturalWidth = 400; naturalHeight = 800; onload?: () => void; onerror?: () => void
    set src(_value: string) { queueMicrotask(() => fail ? this.onerror?.() : this.onload?.()) }
  })
}
it('fotografie e landmark nel report sono snapshot isolati dagli input successivi', () => {
  const source = reportAssessment()
  const generated = generateAssessmentReport(source)
  const before = structuredClone(generated.report!.photographs)
  source.photos[0].dataUrl = undefined
  source.photos[0].annotations.landmarks.manual[0].position.x = 0.99
  expect(generated.report!.photographs).toEqual(before)
  const html = renderToStaticMarkup(createElement(ClinicalReport, { assessment: generated }))
  expect(html.match(/data-report-landmark=/g)).toHaveLength(67)
  expect(html.match(/Fotografia annotata:/g)).toHaveLength(5)
})
it('HTML incorpora cinque fotografie, landmark, misure e dati clinici senza dipendenze esterne', async () => {
  imageDecoder()
  const a = generateAssessmentReport(reportAssessment())
  const html = await buildReportHtml(a)
  expect(html.match(/<image href="data:image\/png;base64,/g)).toHaveLength(5)
  expect(html.match(/data-report-landmark=/g)).toHaveLength(67)
  expect(html).toContain('70,0 kg')
  expect(html).toContain('22,9')
  expect(html).toContain('Misure')
  expect(html).toContain('@page{size:A4')
  expect(html).not.toMatch(/<script|<link|file:\/\/|src="https?:|href="https?:/)
})
it('report senza fotografie resta esportabile e un report precedente conserva la compatibilità', async () => {
  imageDecoder()
  const source = reportAssessment(); source.photos.forEach(p => { p.dataUrl = undefined })
  expect(await buildReportHtml(generateAssessmentReport(source))).not.toContain('<image ')
  const legacy = generateAssessmentReport(reportAssessment()); delete legacy.report!.photographs
  expect(await buildReportHtml(legacy)).toContain('<image href="data:image/')
})
it('esportazione bloccata per report assente, non aggiornato o fotografia illeggibile', async () => {
  const a = reportAssessment()
  await expect(buildReportHtml(a)).rejects.toThrow('Genera prima')
  const generated = generateAssessmentReport(a); generated.inputRevision = 99
  await expect(buildReportHtml(generated)).rejects.toThrow('rigenera')
  generated.inputRevision = 0
  imageDecoder(true)
  await expect(buildReportHtml(generated)).rejects.toThrow('non è leggibile')
})
