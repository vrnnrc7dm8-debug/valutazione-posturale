import type { Assessment, Patient, PhotoSlot, PlaneAssessment } from '@/types'
import {
  createDefaultOverlay,
  createEmptyAnnotations,
  CURRENT_ASSESSMENT_SCHEMA_VERSION,
  PLANE_LABELS,
} from '@/types'
import { migrateAssessment } from '@/utils/assessmentMigration'
import { normalizePhotoSlot } from '@/utils/imageDataUrl'
import { normalizeLandmarkCollection } from '@/utils/landmarkCollection'
import { normalizePhotoAnnotations } from '@/utils/normalizeAnnotations'



export function hydrateAssessment(parsed: Assessment): Assessment {
  const base = createEmptyAssessment()

  const merged: Assessment = {
    evaluationId: parsed.evaluationId,
    loadedRevision: parsed.loadedRevision,
    recoveredRevision: parsed.recoveredRevision,
    allowHomonym: parsed.allowHomonym,
    archiveKey: parsed.archiveKey ?? base.archiveKey,
    inputRevision: parsed.inputRevision,
    importedFiles: parsed.importedFiles,
    antropometriaSnapshot: parsed.antropometriaSnapshot,
    schemaVersion: parsed.schemaVersion ?? base.schemaVersion,
    updatedAt: parsed.updatedAt ?? base.updatedAt,
    patient: {
      ...base.patient,
      ...(parsed.patient ?? {}),
    },
    photos: (parsed.photos ?? base.photos).map((p) =>
      normalizePhotoSlot({
        ...base.photos.find((e) => e.plane === p.plane)!,
        ...p,
        annotations: {
          ...normalizePhotoAnnotations(p.annotations),
          landmarks: normalizeLandmarkCollection(
            p.annotations?.landmarks,
            p.plane,
          ),
        },
        baseline: p.baseline
          ? {
              ...p.baseline,
              annotations: {
                ...createEmptyAnnotations(),
                ...p.baseline.annotations,
                overlay: {
                  ...createDefaultOverlay(),
                  ...p.baseline.annotations?.overlay,
                },
              },
            }
          : undefined,
      }),
    ),
    planeAssessments: parsed.planeAssessments ?? base.planeAssessments,
    myofascialResults: parsed.myofascialResults ?? [],
    report: parsed.report ?? null,
    defaultSubjectHeightCm: parsed.defaultSubjectHeightCm,
  }

  return migrateAssessment(merged)
}

export function createEmptyPatient(): Patient {
  return {
    id: `PC-${crypto.randomUUID()}`,
    nome: '',
    cognome: '',
    eta: '',
    sesso: '',
    dataValutazione: new Date().toISOString().slice(0, 10),
    noteCliniche: '',
    operatore: '',
  }
}

export function createEmptyPhotos(): PhotoSlot[] {
  return (Object.keys(PLANE_LABELS) as (keyof typeof PLANE_LABELS)[]).map(
    (plane) => ({
      plane,
      note: '',
      annotations: createEmptyAnnotations(),
    }),
  )
}

export function createEmptyPlaneAssessments(): PlaneAssessment[] {
  return (Object.keys(PLANE_LABELS) as (keyof typeof PLANE_LABELS)[]).map(
    (plane) => ({
      plane,
      alterations: [],
    }),
  )
}

export function createEmptyAssessment(): Assessment {
  return {
    archiveKey: crypto.randomUUID().replaceAll('-', ''),
    schemaVersion: CURRENT_ASSESSMENT_SCHEMA_VERSION,
    patient: createEmptyPatient(),
    photos: createEmptyPhotos(),
    planeAssessments: createEmptyPlaneAssessments(),
    myofascialResults: [],
    report: null,
    updatedAt: new Date().toISOString(),
  }
}

