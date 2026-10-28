import { formatQuantitativeValue } from '@/data/clinicalThresholds'
import { getAlterationLabel } from '@/data/planes'
import type {
  AlterationSelection,
  AnatomicalPlane,
  Assessment,
  PhotoSlot,
} from '@/types'
import type { ExportClinicalWarning } from '@/types/patientExport'
export type { ExportClinicalWarning, ExportWarningCode } from '@/types/patientExport'
import { PLANE_LABELS } from '@/types'
import { countLandmarks, getAllLandmarks } from '@/utils/landmarkCollection'
import type { PlacedLandmark } from '@/types'

function normalizeLandmarkId(lm: PlacedLandmark): string {
  return lm.landmarkId ?? (lm as { type?: string }).type ?? ''
}

function collectLandmarkWarnings(
  photo: PhotoSlot,
  warnings: ExportClinicalWarning[],
): void {
  const byId = new Map<string, number>()
  for (const lm of getAllLandmarks(photo.annotations.landmarks)) {
    const id = normalizeLandmarkId(lm)
    if (!id) continue
    byId.set(id, (byId.get(id) ?? 0) + 1)
  }

  for (const [landmarkId, count] of byId) {
    if (count > 1) {
      warnings.push({
        code: 'duplicate_landmark',
        severity: 'warning',
        plane: photo.plane,
        landmarkId,
        message: `${PLANE_LABELS[photo.plane]}: landmark "${landmarkId}" presente ${count} volte nelle annotazioni.`,
      })
    }
  }

  if (byId.has('occipite') && byId.has('linea_nucale')) {
    warnings.push({
      code: 'redundant_occipital_landmarks',
      severity: 'info',
      plane: photo.plane,
      message: `${PLANE_LABELS[photo.plane]}: occipite e linea nucale entrambi annotati — verificare possibile ridondanza clinica.`,
    })
  }
}

function collectAlterationWarnings(
  plane: AnatomicalPlane,
  alt: AlterationSelection,
  warnings: ExportClinicalWarning[],
): void {
  const label = getAlterationLabel(plane, alt.alterationId)
  const hasSide = Boolean(alt.side || alt.direction)

  if (!hasSide) {
    warnings.push({
      code: 'alteration_missing_side',
      severity: 'warning',
      plane,
      instanceId: alt.instanceId,
      alterationId: alt.alterationId,
      message: `${label} (${PLANE_LABELS[plane]}): lato/direzione non specificati.`,
    })
  }

  if (!alt.quantitative) {
    warnings.push({
      code: 'alteration_missing_value',
      severity: 'info',
      plane,
      instanceId: alt.instanceId,
      alterationId: alt.alterationId,
      message: `${label} (${PLANE_LABELS[plane]}): valore quantitativo assente${hasSide ? '' : ' · side assente'}.`,
    })
  } else if (!formatQuantitativeValue(alt.quantitative)) {
    warnings.push({
      code: 'alteration_missing_value',
      severity: 'warning',
      plane,
      instanceId: alt.instanceId,
      alterationId: alt.alterationId,
      message: `${label} (${PLANE_LABELS[plane]}): valore quantitativo non formattabile.`,
    })
  }
}

export function collectExportClinicalWarnings(
  assessment: Assessment,
): ExportClinicalWarning[] {
  const warnings: ExportClinicalWarning[] = []

  if (!assessment.report) {
    warnings.push({
      code: 'report_absent',
      severity: 'warning',
      message:
        'Report clinico non generato: export senza report/report.json. Generare il report prima dell\'export per continuità clinica completa.',
    })
  }

  for (const pa of assessment.planeAssessments) {
    for (const alt of pa.alterations) {
      collectAlterationWarnings(pa.plane, alt, warnings)
    }
  }

  for (const photo of assessment.photos) {
    if (countLandmarks(photo.annotations.landmarks) === 0) continue
    collectLandmarkWarnings(photo, warnings)
  }

  return warnings
}

export function formatExportWarningsSummary(warnings: ExportClinicalWarning[]): string {
  if (warnings.length === 0) return ''
  return warnings.map((w) => `• ${w.message}`).join('\n')
}
