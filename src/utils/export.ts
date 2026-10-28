import { formatPattern, formatTissueState, observationSummaries, formatMyersEvidence, formatTissueSupport } from './clinicalPipeline'
import { isReportStale } from '@/utils/reportGeneration'
import { anthropometryReportLines } from '@/utils/anthropometry'
import { formatQuantitativeValue } from '@/data/clinicalThresholds'
import { formatDirectionLabel } from '@/data/directionalDescriptors'
import { getAlterationLabel } from '@/data/planes'
import { MYOFASCIAL_LINES } from '@/data/myofascialLines'
import type { Assessment } from '@/types'
import { DESCRIPTOR_LABELS, PLANE_LABELS, SEVERITY_LABELS, TISSUE_STATE_LABELS } from '@/types'
import { getReportLandmarks } from '@/utils/analysisEngine'

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export type SaveBlobResult = 'saved' | 'cancelled' | 'downloaded'

export interface SaveBlobWithFilePickerOptions {
  pickerId?: string
  mimeType?: string
  extension?: string
  description?: string
}

function getSaveFilePicker():
  | ((
      options?: SaveFilePickerOptions & {
        suggestedName?: string
        types?: Array<{
          description?: string
          accept: Record<string, string[]>
        }>
      },
    ) => Promise<FileSystemFileHandle>)
  | undefined {
  return window.showSaveFilePicker
}

/**
 * Salva un blob con "Salva con nome" (File System Access API) se disponibile,
 * altrimenti download automatico tradizionale.
 */
export async function saveBlobWithFilePicker(
  blob: Blob,
  filename: string,
  options: SaveBlobWithFilePickerOptions = {},
): Promise<SaveBlobResult> {
  const mimeType =
    options.mimeType ?? (blob.type || 'application/octet-stream')
  const extension = options.extension ?? ''
  const description = options.description ?? 'File'

  const showSaveFilePicker = getSaveFilePicker()
  if (showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({
        suggestedName: filename,
        id: options.pickerId,
        types: [
          {
            description,
            accept: {
              [mimeType]: extension ? [extension] : [],
            },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      void error
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}

export function buildTextReportLines(assessment: Assessment): string[] | null {
  const { patient, report, planeAssessments } = assessment
  if (!report) return null
  if (isReportStale(assessment)) throw new Error('La valutazione è cambiata: rigenera il report prima di esportarlo.')

  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    '  SCHEDA IPOTESI FUNZIONALE POSTURALE E MIOFASCIALE',
    '═══════════════════════════════════════════════════════',
    '',
    '⚠ NOTA: Documento a scopo di ipotesi funzionale. Non è diagnosi medica.',
    '',
    '── DATI PAZIENTE ──',
    `Paziente: ${patient.nome} ${patient.cognome}`,
    `Età: ${patient.eta}`,
    `Sesso: ${patient.sesso}`,
    `Data valutazione: ${patient.dataValutazione}`,
    `Operatore: ${patient.operatore}`,
    `Note cliniche: ${patient.noteCliniche || '—'}`,
    ...anthropometryReportLines(assessment),
    '',
    '── PIANI ANALIZZATI ──',
    ...report.analyzedPlanes.map((p) => `• ${p}`),
    '',
    '── ALTERAZIONI BIOMECCANICHE PRINCIPALI ──',
    ...report.mainAlterations.map((a) => `• ${a}`),
    '',
  ]

  if (report.clinicalPipeline) {
    // Il report nuovo usa soltanto lo snapshot generato, mai le alterazioni correnti.
    const header = lines.slice(0, lines.indexOf('── PIANI ANALIZZATI ──'))
    const pipeline = report.clinicalPipeline
    header.push('A. MISURE OGGETTIVE')
    for (const section of report.sections) {
      header.push(section.planeLabel, section.dataAvailability?.note ?? '',
        ...section.autoMeasurements, ...(section.recordedMeasurements ?? []))
    }
    for (const finding of report.quantitativePosturalFindings ?? []) {
      if (finding.observationType !== 'inferenza_miofasciale') header.push(`${finding.segment}: ${finding.value.toFixed(1)} ${finding.unit} · ${finding.operator} ${finding.referenceMode}`)
    }
    header.push('B. OSSERVAZIONI POSTURALI')
    header.push(...observationSummaries(pipeline.observations))
    header.push('C. PATTERN CONSOLIDATI', ...pipeline.patterns.map(formatPattern))
    header.push('D. IPOTESI MYOFASCIALI', ...(pipeline.inferences ? formatMyersEvidence(pipeline.patterns, pipeline.inferences) : report.alteredMeridians.map(m => `${MYOFASCIAL_LINES[m.lineId].name} (${m.prevalentSide})`)))
    header.push('E. TESSUTI CORRELATI')
    for (const tissue of pipeline.tissues) {
      header.push(formatTissueState(tissue), ...formatTissueSupport(tissue, pipeline.patterns), `Linee: ${tissue.sourceLineIds.map(id => MYOFASCIAL_LINES[id].name).join(', ')}`,
        `Evidenze: ${tissue.evidence.map(id => { const p = pipeline.patterns.find(p => p.id === id); return p ? formatPattern(p) : id }).join('; ')}`)
    }
    header.push(report.priorityEvaluable === false ? 'Priorità: NON VALUTABILE' : `Priorità: ${report.therapeuticPriority}`, report.disclaimer)
    return header
  }
  if (report.sections?.length) {
    lines.push('── REPORT PER PIANO ANATOMICO ──')
    for (const sec of report.sections) {
      lines.push(`\n### ${sec.planeLabel}`)
      if (sec.dataAvailability) {
        lines.push(sec.dataAvailability.note)
        lines.push(`Landmark validati disponibili: ${sec.dataAvailability.clinicalLandmarks}. Esclusi o non utilizzabili: ${sec.dataAvailability.excludedLandmarks}.`)
      }
      if (sec.recordedMeasurements?.length) lines.push('Misure registrate:', ...sec.recordedMeasurements.map(m => `  • ${m}`))
      lines.push(`Ipotesi di pattern: ${sec.dominantPattern}`)
      lines.push(`Priorità: ${sec.priorityEvaluable === false ? 'non valutabile' : sec.therapeuticPriority}`)
      sec.observedAlterations.forEach((a) => lines.push(`  • ${a}`))
      if (sec.autoMeasurements.length) lines.push('Misure e indici derivati da landmark validati:')
      sec.autoMeasurements.forEach((m) => lines.push(`  • ${m}`))
      sec.structuredFindings?.forEach((f) => lines.push(`  • Ipotesi interpretativa: ${f.narrative}`))
      sec.myersLines.forEach((m) =>
        lines.push(`  • Myers: ${m.name} (${m.severity})`),
      )
    }
    lines.push('')
  }
  if (report.quantitativePosturalFindings?.length) {
    lines.push('── REPERTI DERIVATI: MISURE, INDICI E IPOTESI ──')
    for (const f of report.quantitativePosturalFindings) {
      const kind = f.observationType === 'inferenza_miofasciale' ? 'Ipotesi miofasciale' : f.observationType === 'osservazione_diretta' ? 'Osservazione geometrica' : 'Indice biomeccanico derivato'
      lines.push(`[${kind}] ${f.segment}: ${f.operator} ${f.referenceMode} ${f.value.toFixed(1)}${f.unit === 'deg' ? '°' : f.unit} · ${f.severity}`, f.interpretation)
    }
  }

  if (report.structuredFindings?.length) {
    lines.push('── REPERTI CLINICI INTEGRATI ──')
    for (const f of report.structuredFindings) {
      lines.push(`\n[${f.planeLabel}] ${f.alterationLabel} (${SEVERITY_LABELS[f.severity]})`)
      lines.push(`  ${f.narrative}`)
      if (f.myersSummary !== 'Nessuna linea Myers sopra soglia.') {
        lines.push(`  Myers: ${f.myersSummary}`)
      }
      if (f.topTissues.length > 0) {
        lines.push(`  Tessuti: ${f.tissueSummary}`)
      }
    }
    lines.push('')
  }

  lines.push('── DETTAGLIO PER PIANO ──')

  for (const pa of planeAssessments) {
    if (pa.alterations.length === 0) continue
    lines.push(`\n${PLANE_LABELS[pa.plane]}:`)
    for (const a of pa.alterations) {
      const directionLabel = formatDirectionLabel(a.direction)
      const quantitativeLabel = formatQuantitativeValue(a.quantitative)
      lines.push(
        `  - ${getAlterationLabel(pa.plane, a.alterationId)} | ${DESCRIPTOR_LABELS[a.descriptor]}${directionLabel ? ` ${directionLabel}` : ''}${quantitativeLabel ? ` | ${quantitativeLabel}` : ''} | ${SEVERITY_LABELS[a.severity]}${a.side ? ` | ${a.side}` : ''}`,
      )
    }
  }

  lines.push('', '── MERIDIANI MIOFASCIALI (Myers) ──')
  for (const m of report.alteredMeridians) {
    const def = MYOFASCIAL_LINES[m.lineId]
    lines.push(`\n${def.name}`)
    lines.push(`  Grado: ${SEVERITY_LABELS[m.severity]} | Lato: ${m.prevalentSide}`)
    lines.push(`  Stato ipotizzato: ${m.possibleState}`)
    lines.push(`  Distretti: ${m.involvedDistricts.join(', ')}`)
    lines.push(`  Tessuti: ${m.softTissues.join(', ')}`)
  }

  lines.push('', '── TESSUTI MOLLI PIÙ COINVOLTI ──')
  if (report.rankedTissueFindings?.length) {
    for (const t of report.rankedTissueFindings) {
      lines.push(
        `  • ${t.name} (${t.side}, ${TISSUE_STATE_LABELS[t.functionalState]}, conf. ${Math.round(t.confidence * 100)}%)`,
      )
    }
  } else {
    lines.push(report.topSoftTissues.join(', '))
  }

  lines.push('', '── IPOTESI DI COMPENSO ──')
  lines.push(`Primario: ${report.primaryCompensationHypothesis}`)
  lines.push('Secondari:')
  for (const s of report.secondaryCompensationHypotheses) {
    lines.push(`  • ${s}`)
  }

  lines.push('', `── PRIORITÀ TERAPEUTICA: ${report.priorityEvaluable === false ? 'NON VALUTABILE: DATI INSUFFICIENTI' : report.therapeuticPriority.toUpperCase()} ──`)
  lines.push('', '── ANNOTAZIONI FOTOGRAFICHE ──')
  for (const photo of assessment.photos) {
    if (!photo.dataUrl) continue
    const { lines: drawnLines, angles } = photo.annotations
    const landmarks = getReportLandmarks(photo)
    if (landmarks.length + drawnLines.length + angles.length === 0) continue
    lines.push(`\n${PLANE_LABELS[photo.plane]}:`)
    for (const lm of landmarks) {
      lines.push(
        `  Landmark ${lm.type}${lm.side ? ` (${lm.side})` : ''} @ (${(lm.position.x * 100).toFixed(1)}%, ${(lm.position.y * 100).toFixed(1)}%)`,
      )
    }
    drawnLines.forEach((_, i) => lines.push(`  Linea ${i + 1}`))
    angles.forEach((_, i) => lines.push(`  Angolo ${i + 1}`))
  }

  lines.push('', '── INTEGRAZIONI FUTURE ──')
  lines.push(report.integrationNotes)
  lines.push('', report.disclaimer)
  lines.push('', `Generato: ${report.generatedAt ?? 'data non disponibile (report precedente)'}`)

  return lines
}

export function exportAssessmentJson(assessment: Assessment): void {
  const blob = new Blob([JSON.stringify(assessment, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(
    blob,
    `valutazione-posturale-${assessment.patient.cognome || 'paziente'}-${assessment.patient.dataValutazione}.json`,
  )
}

export function exportTextReport(assessment: Assessment): void {
  const lines = buildTextReportLines(assessment)
  if (!lines) return

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  downloadBlob(
    blob,
    `report-posturale-${assessment.patient.cognome || 'paziente'}-${assessment.patient.dataValutazione}.txt`,
  )
}
