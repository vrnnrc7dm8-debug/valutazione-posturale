import type { Assessment, ClinicalReportData } from '@/types'
import type { StructuredPosturalFinding } from '@/types/landmarks'
import {
  inferMyofascialAlterationsForPhotos,
  filterReportEligibleFindings,
  formatStructuredFindingSummary,
} from '@/utils/myofascialInference'
import { isUpperLimbFinding } from '@/utils/frontalUpperLimbAnalysis'

export interface QuantitativeReportSection {
  title: string
  findings: StructuredPosturalFinding[]
  summaries: string[]
  warnings: string[]
}

export function buildQuantitativeReportSections(
  assessment: Assessment,
): QuantitativeReportSection[] {
  const allFindings = inferMyofascialAlterationsForPhotos(
    assessment.photos,
    assessment.defaultSubjectHeightCm,
  )
  const findings = filterReportEligibleFindings(allFindings)
  const upperLimbFindings = findings.filter(isUpperLimbFinding)
  const coreFindings = findings.filter((f) => !isUpperLimbFinding(f))

  const byPlane = new Map<string, StructuredPosturalFinding[]>()
  for (const f of coreFindings) {
    const key = f.anatomicalPlane
    const list = byPlane.get(key) ?? []
    list.push(f)
    byPlane.set(key, list)
  }

  const sections: QuantitativeReportSection[] = []
  for (const [plane, planeFindings] of byPlane) {
    const warnings = [
      ...new Set(planeFindings.flatMap((f) => f.warnings ?? [])),
    ]
    sections.push({
      title: `Misure quantitative — ${plane}`,
      findings: planeFindings,
      summaries: planeFindings.map(formatStructuredFindingSummary),
      warnings,
    })
  }

  if (upperLimbFindings.length > 0) {
    const warnings = [...new Set(upperLimbFindings.flatMap((f) => f.warnings ?? []))]
    sections.push({
      title: 'Arti superiori e linee del braccio',
      findings: upperLimbFindings,
      summaries: upperLimbFindings.map(formatStructuredFindingSummary),
      warnings,
    })
  }

  const preliminaryCount = allFindings.length - findings.length
  if (preliminaryCount > 0 && sections.length > 0) {
    sections[0].warnings.push(
      `${preliminaryCount} misura/e preliminare/i esclusa/e dal referto definitivo (landmark non validati o confidence insufficiente).`,
    )
  }

  return sections
}

/** Integra risultati quantitativi nel report esistente senza sostituirlo. */
export function enrichClinicalReportWithQuantitativeFindings(
  report: ClinicalReportData,
  assessment: Assessment,
): ClinicalReportData {
  const allFindings = inferMyofascialAlterationsForPhotos(
    assessment.photos,
    assessment.defaultSubjectHeightCm,
  )
  const findings = filterReportEligibleFindings(allFindings)
  const preliminaryCount = allFindings.length - findings.length

  const quantitativeNotes = findings.map((f) => f.interpretation)
  const calibrationWarnings = findings
    .flatMap((f) => f.warnings ?? [])
    .filter(Boolean)

  return {
    ...report,
    quantitativePosturalFindings: findings,
    integrationNotes: [
      report.integrationNotes,
      findings.length > 0
        ? `Inferenza quantitativa miofasciale: ${findings.length} reperto/i definitivo/i nel referto.`
        : 'Inferenza quantitativa: landmark insufficienti o non validati per misure strutturate definitive.',
      preliminaryCount > 0
        ? `${preliminaryCount} stima/e preliminare/i esclusa/e (landmark euristici non confermati).`
        : '',
      ...calibrationWarnings,
    ]
      .filter(Boolean)
      .join(' '),
    sections: report.sections.map((section) => {
      const planeFindings = findings.filter(
        (f) =>
          section.planeLabel.toLowerCase().includes(f.anatomicalPlane.replace(/_/g, ' ')) ||
          f.anatomicalPlane === section.plane,
      )
      if (planeFindings.length === 0) return section
      return {
        ...section,
        autoMeasurements: [
          ...section.autoMeasurements,
          ...planeFindings.map((f) =>
            `${f.referenceMode === 'absolute' ? 'Assoluto' : 'Relativo'}: ${f.segment} — ${f.operator} ${f.value.toFixed(1)}${f.unit === 'deg' ? '°' : f.unit} (${f.severity})`,
          ),
        ],
        compensationNotes: [
          ...section.compensationNotes,
          ...quantitativeNotes
            .filter((n) =>
              planeFindings.some((pf) => n.startsWith(pf.segment)),
            )
            .slice(0, 3),
        ],
      }
    }),
  }
}

export function formatQuantitativeFindingsText(
  findings: StructuredPosturalFinding[],
): string[] {
  return findings.map(
    (f) =>
      `${f.segment} | ${f.operator} ${f.referenceMode} | ${f.value.toFixed(1)}${f.unit === 'deg' ? '°' : f.unit} | ${f.direction} | ${f.severity}\n${f.interpretation}`,
  )
}
