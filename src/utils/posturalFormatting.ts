import type { StructuredPosturalFinding } from '@/types/landmarks'

const DIRECTION_LABELS: Record<string, string> = {
  dx: 'destro',
  sx: 'sinistro',
  anterior: 'anteriore',
  posterior: 'posteriore',
  superior: 'superiore',
  inferior: 'inferiore',
  medial: 'mediale',
  lateral: 'laterale',
  intrarotazione: 'intrarotazione',
  extrarotazione: 'extrarotazione',
  medializzazione: 'medializzazione',
  lateralizzazione: 'lateralizzazione',
}

const OPERATOR_LABELS: Record<string, string> = {
  tilt: 'Tilt',
  shift: 'Shift',
  bend: 'Bend',
  rotation: 'Rotazione',
  alignment: 'Allineamento',
}

const CATEGORY_LABELS: Record<string, string> = {
  'alterazione assoluta': 'Assoluta',
  'alterazione relativa': 'Relativa',
  'compenso sovrasegmentario': 'Compenso ↑',
  'compenso sottosegmentario': 'Compenso ↓',
}

export function formatDirectionLabel(direction: string): string {
  return DIRECTION_LABELS[direction] ?? direction
}

export function formatOperatorLabel(operator: string): string {
  return OPERATOR_LABELS[operator] ?? operator
}

export function formatCategoryLabel(category?: string): string {
  if (!category) return ''
  return CATEGORY_LABELS[category] ?? category
}

export function formatQuantitativeValue(finding: StructuredPosturalFinding): string {
  if (finding.unit === 'deg') {
    return `${finding.value.toFixed(1)}°`
  }
  if (finding.unit === 'cm') {
    return `${finding.value.toFixed(1)} cm`
  }
  if (finding.unit === 'px') {
    return `${finding.value.toFixed(1)}% imm.`
  }
  return `${finding.value.toFixed(1)} px`
}

export function formatReferenceLabel(finding: StructuredPosturalFinding): string {
  const mode =
    finding.referenceMode === 'absolute'
      ? 'Rif. assoluto'
      : 'Rif. relativo'
  return `${mode}: ${finding.referenceTarget}`
}

export function sortPosturalFindings(
  findings: StructuredPosturalFinding[],
): StructuredPosturalFinding[] {
  const order = (f: StructuredPosturalFinding) => {
    if (f.referenceMode === 'absolute') return 0
    if (f.clinicalCategory?.includes('compenso')) return 2
    return 1
  }
  const opOrder = { tilt: 0, rotation: 1, alignment: 1, shift: 2, bend: 3 }
  return [...findings].sort((a, b) => {
    const modeDiff = order(a) - order(b)
    if (modeDiff !== 0) return modeDiff
    const opDiff =
      (opOrder[a.operator as keyof typeof opOrder] ?? 9) -
      (opOrder[b.operator as keyof typeof opOrder] ?? 9)
    if (opDiff !== 0) return opDiff
    return a.segment.localeCompare(b.segment, 'it')
  })
}

export function groupFindingsByReferenceMode(findings: StructuredPosturalFinding[]): {
  absolute: StructuredPosturalFinding[]
  relative: StructuredPosturalFinding[]
} {
  const sorted = sortPosturalFindings(findings)
  return {
    absolute: sorted.filter((f) => f.referenceMode === 'absolute'),
    relative: sorted.filter((f) => f.referenceMode === 'relative'),
  }
}

export function groupFindingsByReportEligibility(findings: StructuredPosturalFinding[]): {
  definitive: StructuredPosturalFinding[]
  preliminary: StructuredPosturalFinding[]
} {
  const sorted = sortPosturalFindings(findings)
  return {
    definitive: sorted.filter((f) => f.reportEligible !== false),
    preliminary: sorted.filter((f) => f.reportEligible === false),
  }
}

export function groupFindingsByObservationType(
  findings: StructuredPosturalFinding[],
): Record<
  'osservazione_diretta' | 'stima_biomeccanica' | 'inferenza_miofasciale',
  StructuredPosturalFinding[]
> {
  const groups = {
    osservazione_diretta: [] as StructuredPosturalFinding[],
    stima_biomeccanica: [] as StructuredPosturalFinding[],
    inferenza_miofasciale: [] as StructuredPosturalFinding[],
  }
  for (const f of findings) {
    const key = f.observationType ?? 'osservazione_diretta'
    if (key in groups) {
      groups[key as keyof typeof groups].push(f)
    }
  }
  return groups
}
