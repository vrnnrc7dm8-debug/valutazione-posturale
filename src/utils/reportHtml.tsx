import { renderToStaticMarkup } from 'react-dom/server'
import type { Assessment } from '@/types'
import { ClinicalReport } from '@/components/ClinicalReport'
import type { ReportImageSize } from '@/components/ReportPhotograph'
import { isReportStale } from '@/utils/reportGeneration'
import { saveBlobWithFilePicker } from '@/utils/export'

function decodeSize(dataUrl: string): Promise<ReportImageSize> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => image.naturalWidth && image.naturalHeight ? resolve({ width: image.naturalWidth, height: image.naturalHeight }) : reject(new Error('Dimensioni della fotografia non valide.'))
    image.onerror = () => reject(new Error('Una fotografia del report non è leggibile. Nessun documento incompleto esportato.'))
    image.src = dataUrl
  })
}

/** Self-contained local document: no scripts, remote fonts, URLs or local-file paths. */
export async function buildReportHtml(assessment: Assessment): Promise<string> {
  if (!assessment.report) throw new Error('Genera prima il report.')
  if (isReportStale(assessment)) throw new Error('La valutazione è cambiata: rigenera il report prima di esportarlo.')
  const photos = assessment.report.photographs ?? assessment.photos.filter(p => p.dataUrl)
  const photoSizes: Record<string, ReportImageSize> = {}
  for (const photo of photos) {
    if (!photo.dataUrl?.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/)) throw new Error('Fotografia del report non incorporata o in formato non supportato.')
    photoSizes[photo.plane] = await decodeSize(photo.dataUrl)
  }
  const markup = renderToStaticMarkup(<ClinicalReport assessment={assessment} photoSizes={photoSizes} />)
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Report clinico — Valutazione Posturale</title><style>
    *{box-sizing:border-box}body{font:14px/1.5 system-ui,sans-serif;color:#172554;background:white;margin:0 auto;padding:24px;max-width:1000px}h1,h2,h3,h4{line-height:1.25;break-after:avoid}h3{font-size:20px}section{margin:20px 0;padding:16px;border:1px solid #cbd5e1;border-radius:8px}p{margin:8px 0}li{margin:4px 0}svg{overflow:hidden}svg svg{width:100%;height:100%}svg.lucide{width:20px;height:20px}.report-photograph{margin:16px auto;max-width:740px;break-inside:avoid;border:1px solid #cbd5e1;padding:12px}.report-landmark-legend{columns:2;font-size:11px;padding-left:0;list-style:none}figcaption{font-size:12px;color:#475569}img[hidden]{display:none}ul,ol{padding-left:20px}.report-landmark-legend li{break-inside:avoid}.text-xs{font-size:12px}.font-semibold,.font-medium{font-weight:600}
    @page{size:A4;margin:15mm}@media print{body{max-width:none;padding:0;font-size:11pt}section{border:0;padding:0;margin:10mm 0}section:has(>.report-photograph){break-before:page}.report-photograph{max-width:165mm}.report-photograph>svg{max-height:185mm!important}h3,h4,figcaption{break-after:avoid}p,li{orphans:3;widows:3}}
  </style></head><body>${markup}</body></html>`
}

export async function exportReportHtml(assessment: Assessment): Promise<void> {
  const html = await buildReportHtml(assessment)
  await saveBlobWithFilePicker(new Blob([html], { type: 'text/html;charset=utf-8' }), `report-posturale-${assessment.patient.id}-${assessment.patient.dataValutazione}.html`, { mimeType: 'text/html', extension: '.html', description: 'Report clinico con fotografie annotate', pickerId: 'clinical-report-html' })
}
