import { getClinicalThresholdsSnapshot } from '@/data/clinicalThresholds'
import type { Assessment, PhotoSlot } from '@/types'
import {
  PATIENT_EXPORT_VERSION,
  type PatientExportManifest,
} from '@/types/patientExport'
import {
  collectExportClinicalWarnings,
  type ExportClinicalWarning,
} from '@/utils/exportWarnings'
import { buildTextReportLines, saveBlobWithFilePicker } from '@/utils/export'
import { parseDataUrl } from '@/utils/imageDataUrl'
import { analyzeAllPlanes, inferMyersForAllPlanes } from '@/utils/myersEngine'
import { analyzeAllTissues, analyzeTissuesForPlane } from '@/utils/tissueAnalysis'
import { inferMyofascialAlterationsForPhotos } from '@/utils/myofascialInference'
import { countLandmarks } from '@/utils/landmarkCollection'
import { POSTURAL_THRESHOLDS } from '@/config/posturalThresholds'

interface ZipEntry {
  path: string
  data: Uint8Array
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function encodeJson(data: unknown): Uint8Array {
  return encodeText(JSON.stringify(data, null, 2))
}

function sanitizeFilenamePart(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return 'paziente'
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

function countAlterations(assessment: Assessment): number {
  return assessment.planeAssessments.reduce(
    (sum, pa) => sum + pa.alterations.length,
    0,
  )
}

function buildAnnotationExport(photo: PhotoSlot, photoPath: string | null) {
  let baselinePath: string | undefined
  if (photo.baseline?.dataUrl) {
    const { ext } = parseDataUrl(photo.baseline.dataUrl)
    baselinePath = `photos/${photo.plane}_baseline.${ext}`
  }

  return {
    plane: photo.plane,
    fileName: photo.fileName,
    note: photo.note,
    photoPath,
    baselinePhotoPath: baselinePath,
    annotations: photo.annotations,
    calibration: photo.calibration,
    baseline: photo.baseline
      ? {
          id: photo.baseline.id,
          fileName: photo.baseline.fileName,
          capturedAt: photo.baseline.capturedAt,
          label: photo.baseline.label,
          annotations: photo.baseline.annotations,
          photoPath: baselinePath,
        }
      : undefined,
  }
}

function addPhotoEntries(
  entries: ZipEntry[],
  files: string[],
  photo: PhotoSlot,
): { photoPath: string | null; exportedCount: number } {
  let exportedCount = 0
  let photoPath: string | null = null

  if (photo.dataUrl) {
    const { bytes, ext } = parseDataUrl(photo.dataUrl)
    photoPath = `photos/${photo.plane}.${ext}`
    entries.push({ path: photoPath, data: bytes })
    files.push(photoPath)
    exportedCount++
  }

  if (photo.baseline?.dataUrl) {
    const { bytes, ext } = parseDataUrl(photo.baseline.dataUrl)
    const baselinePath = `photos/${photo.plane}_baseline.${ext}`
    entries.push({ path: baselinePath, data: bytes })
    files.push(baselinePath)
    exportedCount++
  }

  return { photoPath, exportedCount }
}

function pushJsonEntry(
  entries: ZipEntry[],
  files: string[],
  path: string,
  data: unknown,
): void {
  entries.push({ path, data: encodeJson(data) })
  files.push(path)
}

export function getExportClinicalWarnings(assessment: Assessment): ExportClinicalWarning[] {
  return collectExportClinicalWarnings(assessment)
}

export async function buildPatientExportZip(assessment: Assessment): Promise<Blob> {
  const entries: ZipEntry[] = []
  const files: string[] = []
  const exportedAt = new Date().toISOString()
  const thresholds = getClinicalThresholdsSnapshot()
  const clinicalWarnings = collectExportClinicalWarnings(assessment)

  for (const file of assessment.importedFiles ?? []) {
    if (!file.path.startsWith('attachments/') || file.path.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Percorso allegato non valido.')
    entries.push({ path: file.path, data: Uint8Array.from(atob(file.base64), c => c.charCodeAt(0)) })
    files.push(file.path)
  }

  const hasStoredMyers = assessment.myofascialResults.length > 0
  const myofascialResults = hasStoredMyers
    ? assessment.myofascialResults
    : analyzeAllPlanes(assessment.planeAssessments)

  const myersByAlteration = inferMyersForAllPlanes(assessment.planeAssessments)
  const tissuesGlobal = analyzeAllTissues(assessment.planeAssessments)
  const tissuesByAlteration = assessment.planeAssessments.flatMap((pa) =>
    analyzeTissuesForPlane(pa.plane, pa.alterations),
  )

  pushJsonEntry(entries, files, 'patient.json', assessment.patient)

  pushJsonEntry(entries, files, 'assessment/assessment.json', {
    antropometriaSnapshot: assessment.antropometriaSnapshot,
    archiveKey: assessment.archiveKey,
    inputRevision: assessment.inputRevision,
    schemaVersion: assessment.schemaVersion,
    updatedAt: assessment.updatedAt,
    planeAssessments: assessment.planeAssessments,
    defaultSubjectHeightCm: assessment.defaultSubjectHeightCm,
  })

  pushJsonEntry(entries, files, 'clinical/myers.json', {
    source: hasStoredMyers ? 'assessment' : 'computed_at_export',
    results: myofascialResults,
  })

  pushJsonEntry(entries, files, 'clinical/myers-by-alteration.json', {
    computedAtExport: exportedAt,
    inferences: myersByAlteration,
  })

  pushJsonEntry(entries, files, 'clinical/tissues.json', {
    computedAtExport: exportedAt,
    rankedGlobal: tissuesGlobal,
    byAlteration: tissuesByAlteration,
    fromReport: Boolean(assessment.report?.rankedTissueFindings?.length),
  })

  pushJsonEntry(entries, files, 'clinical/thresholds.json', thresholds)
  pushJsonEntry(entries, files, 'clinical/postural-thresholds.json', POSTURAL_THRESHOLDS)
  pushJsonEntry(entries, files, 'clinical/quantitative-postural.json', {
    computedAtExport: exportedAt,
    defaultSubjectHeightCm: assessment.defaultSubjectHeightCm,
    findings: inferMyofascialAlterationsForPhotos(
      assessment.photos,
      assessment.defaultSubjectHeightCm,
    ),
    fromReport: Boolean(assessment.report?.quantitativePosturalFindings?.length),
  })
  pushJsonEntry(entries, files, 'clinical/warnings.json', {
    exportedAt,
    warnings: clinicalWarnings,
  })

  const hasReport = assessment.report !== null
  if (hasReport && assessment.report) {
    pushJsonEntry(entries, files, 'report/report.json', assessment.report)
    const reportLines = buildTextReportLines(assessment)
    if (reportLines) {
      const reportPath = 'report/report.txt'
      entries.push({ path: reportPath, data: encodeText(reportLines.join('\n')) })
      files.push(reportPath)
    }
  }

  let photoCount = 0
  let annotationCount = 0

  for (const photo of assessment.photos) {
    const { photoPath, exportedCount } = addPhotoEntries(entries, files, photo)
    photoCount += exportedCount

    const hasAnnotationContent =
      countLandmarks(photo.annotations.landmarks) > 0 ||
      photo.annotations.lines.length > 0 ||
      photo.annotations.angles.length > 0 ||
      photo.note.trim().length > 0 ||
      photo.baseline !== undefined

    if (photo.dataUrl || hasAnnotationContent) {
      const annotationPath = `annotations/${photo.plane}.json`
      pushJsonEntry(
        entries,
        files,
        annotationPath,
        buildAnnotationExport(photo, photoPath),
      )
      annotationCount++
    }
  }

  const patientName = [assessment.patient.cognome, assessment.patient.nome]
    .filter(Boolean)
    .join(' ')
    .trim()

  const manifest: PatientExportManifest = {
    exportVersion: PATIENT_EXPORT_VERSION,
    assessmentSchemaVersion: assessment.schemaVersion,
    clinicalThresholdsVersion: thresholds.version,
    exportedAt,
    patientId: assessment.patient.id,
    patientName: patientName || 'Paziente',
    evaluationDate: assessment.patient.dataValutazione || exportedAt.slice(0, 10),
    files: [...files].sort(),
    photoCount,
    annotationCount,
    alterationCount: countAlterations(assessment),
    hasReport,
    myersComputedAtExport: !hasStoredMyers,
    warningCount: clinicalWarnings.length,
  }

  pushJsonEntry(entries, files, 'manifest.json', {
    ...manifest,
    files: [...files, 'manifest.json'].sort(),
  })

  const zipFiles: Record<string, Uint8Array> = {}
  for (const entry of entries) {
    zipFiles[entry.path] = entry.data
  }

  const { zip } = await import('fflate')
  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(zipFiles, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

  const copy = new Uint8Array(zipped.length)
  copy.set(zipped)
  return new Blob([copy], { type: 'application/zip' })
}

export const PATIENT_ZIP_EXPORT_PICKER_ID = 'patient-zip-export'

export function buildPatientExportFilename(assessment: Assessment): string {
  const cognome = sanitizeFilenamePart(assessment.patient.cognome || 'paziente')
  const nome = sanitizeFilenamePart(assessment.patient.nome || 'paziente')
  const date = sanitizeFilenamePart(
    assessment.patient.dataValutazione || new Date().toISOString().slice(0, 10),
  )
  return `${PATIENT_EXPORT_VERSION}_${cognome}_${nome}_${date}.zip`
}

export async function exportPatientZip(
  assessment: Assessment,
): Promise<ExportClinicalWarning[]> {
  const warnings = collectExportClinicalWarnings(assessment)
  const blob = await buildPatientExportZip(assessment)
  const filename = buildPatientExportFilename(assessment)
  await saveBlobWithFilePicker(blob, filename, {
    pickerId: PATIENT_ZIP_EXPORT_PICKER_ID,
    mimeType: 'application/zip',
    extension: '.zip',
    description: 'Archivio paziente ZIP',
  })
  return warnings
}
