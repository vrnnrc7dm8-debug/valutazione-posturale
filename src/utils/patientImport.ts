import type {
  AnatomicalPlane,
  Assessment,
  ClinicalReportData,
  MyofascialLineResult,
  Patient,
  PhotoSlot,
  RankedTissueFinding,
} from '@/types'
import {
  createDefaultImageView,
  createDefaultOverlay,
  createEmptyAnnotations,
  PLANE_LABELS,
} from '@/types'
import {
  PATIENT_EXPORT_VERSION,
  type ExportClinicalWarning,
  type PatientExportManifest,
  type PatientImportResult,
} from '@/types/patientExport'
import {
  blobToDataUrl,
  detectImageExtension,
  mimeFromExtension,
  normalizePhotoUrlFields,
} from '@/utils/imageDataUrl'
import {
  createEmptyPhotos,
  createEmptyPlaneAssessments,
  hydrateAssessment,
} from '@/utils/storage'
import {
  getZipEntry,
  normalizeZipContents,
  requireZipEntry,
  type ZipContents,
} from '@/utils/zipContents'

const ZIP_IMAGE_PATH_RE = /^photos\/.+\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/i

type ImagePathSource = {
  path?: string | null
  filePath?: string | null
  filename?: string | null
  fileName?: string | null
  name?: string | null
  imagePath?: string | null
  originalPath?: string | null
  photoPath?: string | null
}

function listZipImageFiles(contents: ZipContents): string[] {
  return Object.keys(contents).filter((name) => ZIP_IMAGE_PATH_RE.test(name))
}

function findImageFilePath(
  contents: ZipContents,
  imageFiles: string[],
  photo: ImagePathSource,
): string | undefined {
  const candidates = [
    photo.path,
    photo.filePath,
    photo.filename,
    photo.fileName,
    photo.name,
    photo.imagePath,
    photo.originalPath,
    photo.photoPath,
  ]
    .filter((value): value is string => Boolean(value))
    .map(String)

  for (const candidate of candidates) {
    const normalized = candidate.replace(/^\/+/, '')
    if (getZipEntry(contents, normalized)) {
      return normalized
    }

    const basename = normalized.split('/').pop()
    if (basename) {
      const inPhotos = `photos/${basename}`
      if (getZipEntry(contents, inPhotos)) {
        return inPhotos
      }
    }
  }

  return imageFiles.find((filePath) => {
    const name = filePath.split('/').pop()
    return name ? candidates.some((candidate) => candidate.includes(name)) : false
  })
}

function countImportedPhotosWithData(photos: PhotoSlot[]): number {
  return photos.filter(
    (photo) =>
      photo.dataUrl?.startsWith('data:') || photo.imageUrl?.startsWith('data:'),
  ).length
}

function planeFromImagePath(filePath: string): AnatomicalPlane | undefined {
  const stem = filePath
    .replace(/^photos\//, '')
    .replace(/_baseline$/i, '')
    .replace(/\.[^.]+$/, '')
  const planes = Object.keys(PLANE_LABELS) as AnatomicalPlane[]
  return planes.find((plane) => stem === plane || stem.startsWith(`${plane}_`))
}

async function importRawPhotosFromImageFiles(
  contents: ZipContents,
  imageFiles: string[],
  basePhotos: PhotoSlot[],
): Promise<PhotoSlot[]> {
  const photos = basePhotos.map((slot) => ({ ...slot }))
  const planes = Object.keys(PLANE_LABELS) as AnatomicalPlane[]
  const unusedPlanes = [...planes]

  for (const filePath of imageFiles.filter((path) => !path.includes('_baseline.'))) {
    const dataUrl = await loadPhotoDataUrl(contents, filePath)
    if (!dataUrl) continue

    const targetPlane = planeFromImagePath(filePath)
    if (targetPlane) {
      unusedPlanes.splice(unusedPlanes.indexOf(targetPlane), 1)
    } else {
      throw new Error('Fotografia senza un piano riconoscibile: indicare il piano nel nome del file o nel relativo JSON di annotazione.')
    }
    if (!targetPlane) break

    const slotIndex = photos.findIndex((slot) => slot.plane === targetPlane)
    if (slotIndex === -1) continue

    photos[slotIndex] = applyImportedPhotoUrls(
      {
        ...photos[slotIndex],
        fileName: filePath.split('/').pop(),
        note: photos[slotIndex].note || filePath.split('/').pop() || '',
      },
      dataUrl,
      filePath,
    )
  }

  return photos
}

interface AnnotationExportFile {
  plane: AnatomicalPlane
  fileName?: string
  note?: string
  photoPath?: string | null
  baselinePhotoPath?: string
  annotations: PhotoSlot['annotations']
  calibration?: PhotoSlot['calibration']
  baseline?: {
    id: string
    fileName?: string
    capturedAt: string
    label: string
    annotations: PhotoSlot['annotations']
    photoPath?: string
  }
}

interface AssessmentExportFile {
  inputRevision?: number
  antropometriaSnapshot?: Assessment['antropometriaSnapshot']
  archiveKey?: string
  defaultSubjectHeightCm?: number
  schemaVersion: Assessment['schemaVersion']
  updatedAt: string
  planeAssessments: Assessment['planeAssessments']
}

interface MyersExportFile {
  source?: string
  results: MyofascialLineResult[]
}

interface TissuesExportFile {
  computedAtExport?: string
  rankedGlobal: RankedTissueFinding[]
  byAlteration?: unknown[]
  fromReport?: boolean
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function decodeJson<T>(bytes: Uint8Array): T {
  return JSON.parse(decodeText(bytes)) as T
}

function parseOptionalJson<T>(contents: ZipContents, path: string): T | undefined {
  const entry = getZipEntry(contents, path)
  return entry ? decodeJson<T>(entry) : undefined
}

function extensionFromPath(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? 'jpg'
}

function applyImportedPhotoUrls(
  photo: PhotoSlot,
  dataUrl: string | undefined,
  zipPath?: string,
): PhotoSlot {
  if (!dataUrl) return photo
  return normalizePhotoUrlFields({
    ...photo,
    dataUrl,
    originalPath: zipPath ?? photo.originalPath,
  })
}

function applyImportedSnapshotUrls(
  snapshot: NonNullable<PhotoSlot['baseline']>,
  dataUrl: string,
  zipPath?: string,
): NonNullable<PhotoSlot['baseline']> {
  return {
    ...normalizePhotoUrlFields({
      ...snapshot,
      dataUrl,
      originalPath: zipPath ?? snapshot.originalPath,
    }),
    dataUrl,
  }
}

function loadPhotoDataUrl(
  contents: ZipContents,
  path?: string | null,
): Promise<string | undefined> {
  if (!path) return Promise.resolve(undefined)
  const entry = getZipEntry(contents, path)
  if (!entry) return Promise.resolve(undefined)

  const pathExt = extensionFromPath(path)
  const ext =
    pathExt === 'bin' ? detectImageExtension(entry, undefined, path) : pathExt
  const mime = mimeFromExtension(ext)
  const blob = new Blob([Uint8Array.from(entry)], { type: mime })
  return blobToDataUrl(blob)
}

function findPhotoPath(
  contents: ZipContents,
  plane: AnatomicalPlane,
  kind: 'main' | 'baseline',
): string | undefined {
  const paths = Object.keys(contents).filter((p) => p.startsWith('photos/'))
  if (kind === 'baseline') {
    return paths.find((p) => p.startsWith(`photos/${plane}_baseline.`))
  }
  return paths.find(
    (p) => p.startsWith(`photos/${plane}.`) && !p.includes('_baseline'),
  )
}

function mergePlaneAssessments(
  imported: Assessment['planeAssessments'],
): Assessment['planeAssessments'] {
  const byPlane = new Map(imported.map((pa) => [pa.plane, pa]))
  return createEmptyPlaneAssessments().map(
    (empty) => byPlane.get(empty.plane) ?? empty,
  )
}

function buildBaselineSlot(
  annotationBaseline: NonNullable<AnnotationExportFile['baseline']>,
  baselineDataUrl: string,
  zipPath?: string,
): PhotoSlot['baseline'] {
  return applyImportedSnapshotUrls(
    {
      id: annotationBaseline.id,
      dataUrl: baselineDataUrl,
      fileName: annotationBaseline.fileName,
      capturedAt: annotationBaseline.capturedAt,
      label: annotationBaseline.label,
      annotations: {
        ...createEmptyAnnotations(),
        ...annotationBaseline.annotations,
        overlay: {
          ...createDefaultOverlay(),
          ...annotationBaseline.annotations.overlay,
        },
      },
    },
    baselineDataUrl,
    zipPath,
  )
}

async function buildPhotoSlotFromPaths(
  slot: PhotoSlot,
  contents: ZipContents,
  imageFiles: string[],
  annotationFile?: AnnotationExportFile,
): Promise<PhotoSlot> {
  const mainPath =
    findImageFilePath(contents, imageFiles, {
      path: annotationFile?.photoPath,
      filePath: annotationFile?.photoPath,
      fileName: annotationFile?.fileName ?? slot.fileName,
      photoPath: annotationFile?.photoPath,
      originalPath: slot.originalPath,
    }) ?? findPhotoPath(contents, slot.plane, 'main')
  const baselinePath =
    findImageFilePath(contents, imageFiles, {
      path: annotationFile?.baselinePhotoPath ?? annotationFile?.baseline?.photoPath,
      filePath: annotationFile?.baselinePhotoPath ?? annotationFile?.baseline?.photoPath,
      fileName: annotationFile?.baseline?.fileName,
      photoPath: annotationFile?.baselinePhotoPath ?? annotationFile?.baseline?.photoPath,
    }) ??
    findPhotoPath(contents, slot.plane, 'baseline')

  const dataUrl = await loadPhotoDataUrl(contents, mainPath)
  const baselineDataUrl = await loadPhotoDataUrl(contents, baselinePath)

  if (!annotationFile) {
    if (!dataUrl && !baselineDataUrl) return slot
    return applyImportedPhotoUrls(
      {
        ...slot,
        fileName: mainPath?.split('/').pop(),
      },
      dataUrl,
      mainPath ?? undefined,
    )
  }

  return applyImportedPhotoUrls(
    {
      plane: slot.plane,
      fileName: annotationFile.fileName ?? mainPath?.split('/').pop(),
      note: annotationFile.note ?? '',
      calibration: annotationFile.calibration,
      annotations: {
        ...createEmptyAnnotations(),
        ...annotationFile.annotations,
        overlay: {
          ...createDefaultOverlay(),
          ...annotationFile.annotations.overlay,
        },
        imageView:
          annotationFile.annotations.imageView ?? createDefaultImageView(),
      },
      baseline:
        annotationFile.baseline && baselineDataUrl
          ? buildBaselineSlot(
              annotationFile.baseline,
              baselineDataUrl,
              baselinePath,
            )
          : undefined,
    },
    dataUrl,
    mainPath ?? undefined,
  )
}

async function rebuildPhotos(
  contents: ZipContents,
  basePhotos: PhotoSlot[],
): Promise<PhotoSlot[]> {
  const imageFiles = listZipImageFiles(contents)

  let photos = await Promise.all(
    basePhotos.map(async (slot) => {
      const annotationFile = parseOptionalJson<AnnotationExportFile>(
        contents,
        `annotations/${slot.plane}.json`,
      )
      return buildPhotoSlotFromPaths(slot, contents, imageFiles, annotationFile)
    }),
  )

  if (countImportedPhotosWithData(photos) === 0 && imageFiles.length > 0) {
    photos = await importRawPhotosFromImageFiles(contents, imageFiles, photos)
  }

  return photos
}

export async function parsePatientExportZip(file: File): Promise<PatientImportResult> {
  const buffer = await file.arrayBuffer()
  const { unzip } = await import('fflate')

  const rawContents = await new Promise<ZipContents>((resolve, reject) => {
    unzip(new Uint8Array(buffer), (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

  return parsePatientExportContents(rawContents)
}

export async function parsePatientExportFolder(files: File[]): Promise<PatientImportResult> {
  if (!files.length || files.length > 1000 || files.reduce((n, f) => n + f.size, 0) > 200 * 1024 * 1024) throw new Error('Cartella vuota o troppo grande (massimo 1000 file e 200 MB).')
  const contents: ZipContents = {}
  for (const file of files) {
    const path = file.webkitRelativePath || file.name
    if (path in contents) throw new Error('File duplicato nella cartella importata.')
    contents[path] = new Uint8Array(await file.arrayBuffer())
  }
  return parsePatientExportContents(contents)
}

function preserveImportedDocuments(contents: ZipContents): NonNullable<Assessment['importedFiles']> {
  const originals = new Map<string, Uint8Array>()
  const entries = Object.entries(contents).filter(([path]) => !path.startsWith('photos/'))
  entries.sort(([a], [b]) => Number(b.startsWith('attachments/')) - Number(a.startsWith('attachments/')))
  for (const [path, bytes] of entries) {
    const target = path.startsWith('attachments/') ? path : `attachments/import-original/${path}`
    if (!originals.has(target)) originals.set(target, bytes)
  }
  return [...originals].map(([path, bytes]) => {
    let binary = ''
    for (const value of bytes) binary += String.fromCharCode(value)
    return { path, base64: btoa(binary) }
  })
}

export async function parsePatientExportContents(rawContents: ZipContents): Promise<PatientImportResult> {
  const contents = normalizeZipContents(rawContents)

  const manifest = decodeJson<PatientExportManifest>(
    requireZipEntry(contents, 'manifest.json'),
  )

  if (manifest.exportVersion !== PATIENT_EXPORT_VERSION) {
    throw new Error(
      `Versione export non supportata: ${manifest.exportVersion}. Atteso ${PATIENT_EXPORT_VERSION}.`,
    )
  }

  for (const path of manifest.files ?? []) requireZipEntry(contents, path)
  if (manifest.hasReport && !getZipEntry(contents, 'report/report.json')) throw new Error('Report dichiarato nel manifest ma mancante.')
  const patient = decodeJson<Patient>(requireZipEntry(contents, 'patient.json'))
  const assessmentFile = decodeJson<AssessmentExportFile>(
    requireZipEntry(contents, 'assessment/assessment.json'),
  )
  const myersFile = parseOptionalJson<MyersExportFile>(
    contents,
    'clinical/myers.json',
  )
  const tissuesFile = parseOptionalJson<TissuesExportFile>(
    contents,
    'clinical/tissues.json',
  )
  const reportFile = parseOptionalJson<ClinicalReportData>(
    contents,
    'report/report.json',
  )
  const warningsFile = parseOptionalJson<{ warnings: ExportClinicalWarning[] }>(
    contents,
    'clinical/warnings.json',
  )

  const myofascialResults = myersFile?.results ?? []
  const photos = await rebuildPhotos(contents, createEmptyPhotos())
  const report = reportFile ?? null
  void tissuesFile

  const rawAssessment: Assessment = {
    archiveKey: assessmentFile.archiveKey,
    defaultSubjectHeightCm: assessmentFile.defaultSubjectHeightCm,
    importedFiles: preserveImportedDocuments(contents),
    antropometriaSnapshot: assessmentFile.antropometriaSnapshot,
    inputRevision: assessmentFile.inputRevision,
    schemaVersion: assessmentFile.schemaVersion,
    updatedAt: assessmentFile.updatedAt || new Date().toISOString(),
    patient,
    photos,
    planeAssessments: mergePlaneAssessments(assessmentFile.planeAssessments),
    myofascialResults,
    report,
  }

  return {
    assessment: hydrateAssessment(rawAssessment),
    manifest,
    warnings: warningsFile?.warnings ?? [],
  }
}

export async function importPatientZip(file: File): Promise<PatientImportResult> {
  return parsePatientExportZip(file)
}

export function formatImportSummary(result: PatientImportResult): string {
  const { manifest, assessment, warnings } = result
  const patient = assessment.patient
  const lines = [
    `Paziente: ${patient.cognome} ${patient.nome}`.trim() || manifest.patientName,
    `Data valutazione: ${patient.dataValutazione || manifest.evaluationDate}`,
    `Foto caricate: ${assessment.photos.filter((p) => p.dataUrl).length}`,
    `Alterazioni: ${manifest.alterationCount}`,
    `Myers: ${assessment.myofascialResults.length} linee`,
    `Report incluso nell'export: ${manifest.hasReport ? 'sì' : 'no'}`,
    `Report in app: ${assessment.report ? 'presente' : 'assente'}`,
    `Tessuti ranked: ${assessment.report?.rankedTissueFindings?.length ?? 0}`,
  ]
  if (warnings.length > 0) {
    lines.push('', 'Avvisi clinici nell\'export:')
    for (const w of warnings.slice(0, 5)) {
      lines.push(`• ${w.message}`)
    }
    if (warnings.length > 5) {
      lines.push(`• … +${warnings.length - 5} avvisi`)
    }
  }
  return lines.join('\n')
}
