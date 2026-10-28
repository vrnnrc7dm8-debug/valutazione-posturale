import type { Assessment } from '@/types'
import { buildReportHtml } from '@/utils/reportHtml'
import { saveBlobWithFilePicker } from '@/utils/export'

/** Render the same self-contained SVG shown in the report, including all editor overlays. */
async function rasterize(svg: SVGSVGElement): Promise<{ data: string; ratio: number }> {
  const box = svg.getAttribute('viewBox')!.split(' ').map(Number)
  const width = 1600
  const height = Math.max(1, Math.round(width * box[3] / box[2]))
  if (height > 12000) throw new Error('Fotografia troppo allungata per il PDF. Esporta il report HTML.')
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('width', String(width)); copy.setAttribute('height', String(height)); copy.removeAttribute('style')
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = 'svg svg{width:100%;height:100%}'
  copy.prepend(style)
  const data = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(copy))))
  const image = new Image()
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Impossibile renderizzare una fotografia annotata. Nessun PDF incompleto scaricato.')); image.src = data })
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Rendering PDF non disponibile nel browser.')
  context.fillStyle = 'white'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0)
  const result = canvas.toDataURL('image/jpeg', 0.94)
  canvas.width = canvas.height = 0
  return { data: result, ratio: box[2] / box[3] }
}

// Built-in PDF font uses WinAnsi. Preserve Italian accents and express unsupported scientific glyphs in words.
export function pdfText(value: string): string {
  return value.replace(/[–—−]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/Δ/g, 'Delta ').replace(/θ/g, 'theta ').replace(/→/g, ' -> ').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~').replace(/•/g, '-').replace(/[^\x20-\xff\n]/g, '').replace(/[ \t]+/g, ' ').trim()
}

export async function buildReportPdf(assessment: Assessment): Promise<Blob> {
  const html = await buildReportHtml(assessment)
  const documentHtml = new DOMParser().parseFromString(html, 'text/html')
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: 'Valutazione Posturale - Report clinico', creator: 'Valutazione Posturale locale' })
  let y = 18
  const page = () => { pdf.addPage(); y = 18 }
  function text(value: string, heading = false) {
    const clean = pdfText(value)
    if (!clean) return
    pdf.setFont('helvetica', heading ? 'bold' : 'normal'); pdf.setFontSize(heading ? 13 : 10)
    const lines = pdf.splitTextToSize(clean, 178) as string[]
    for (const line of lines) { if (y > 274) page(); pdf.text(line, 16, y); y += heading ? 6 : 4.7 }
    y += 2
  }
  async function visit(element: Element): Promise<void> {
    if (element.tagName.toLowerCase() === 'svg' || element.tagName.toLowerCase() === 'img') return
    if (element.tagName.toLowerCase() === 'figure') {
      const svg = element.querySelector('svg') as SVGSVGElement | null
      if (!svg) throw new Error('Fotografia annotata del report non disponibile.')
      const rendered = await rasterize(svg)
      const height = Math.min(160, 178 / rendered.ratio)
      const width = height * rendered.ratio
      if (y + height > 274) page()
      pdf.addImage(rendered.data, 'JPEG', (210-width)/2, y, width, height)
      y += height + 4
      for (const child of element.children) if (child !== svg) await visit(child)
      return
    }
    if (element.getAttribute('aria-label')?.startsWith('Report piano') && y > 30) page()
    const tag = element.tagName.toLowerCase()
    if (['p','li','h1','h2','h3','h4','figcaption'].includes(tag)) {
      text(element.textContent || '', tag.startsWith('h')); return
    }
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text(child.textContent || '')
      else if (child.nodeType === Node.ELEMENT_NODE) await visit(child as Element)
    }
  }
  await visit(documentHtml.body)
  const count = pdf.getNumberOfPages()
  for (let index=1; index<=count; index++) { pdf.setPage(index); pdf.setFontSize(8); pdf.setTextColor(71,85,105); pdf.text(`Valutazione ${assessment.evaluationId ?? assessment.patient.dataValutazione} - Pagina ${index}/${count}`, 16, 287) }
  return pdf.output('blob')
}

export async function exportReportPdf(assessment: Assessment): Promise<void> {
  const blob = await buildReportPdf(assessment)
  const version = assessment.report?.generatedAt?.replace(/[^0-9A-Za-z]/g, '') || assessment.loadedRevision || String(Date.now())
  await saveBlobWithFilePicker(blob, `report-posturale-${assessment.patient.id}-${assessment.patient.dataValutazione}-${version}.pdf`, { mimeType: 'application/pdf', extension: '.pdf', description: 'Report clinico con fotografie annotate', pickerId: 'clinical-report-pdf' })
}
