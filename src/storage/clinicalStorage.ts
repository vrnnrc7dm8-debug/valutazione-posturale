import type { Assessment, AnthropometrySnapshot, Patient } from '@/types'
import { createEmptyAssessment, hydrateAssessment } from '@/utils/storage'
import { anthropometricReport, snapshotFromPatient, validMeasurement } from '@/utils/anthropometry'
import { normalizePhotoSlot } from '@/utils/imageDataUrl'

let anthropometryAvailable: boolean | null = null
export function isAnthropometryAvailable(): boolean | null { return anthropometryAvailable }

export class StorageQuotaError extends Error {}
export class StoragePersistenceError extends Error {}

export async function clinicalRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Clinical-App': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new StoragePersistenceError('Backend locale non raggiungibile. Avviare il backend e verificare il Lexar.')
  }
  const result = await response.json().catch(() => ({ error: 'Backend locale non disponibile.' }))
  if (!response.ok) throw new StoragePersistenceError(result.error || 'Operazione non riuscita.')
  return result as T
}

export async function initializeClinicalStorage(password = ''): Promise<Assessment> {
  const session = await clinicalRequest<{ anthropometryReady?: boolean }>('session', { password })
  anthropometryAvailable = session.anthropometryReady ?? null
  return createEmptyAssessment()
}

function canonicalAssessment(assessment: Assessment): Assessment {
  const canonicalPhoto = (photo: Assessment['photos'][number]) => {
    const p = normalizePhotoSlot(photo)
    return { ...p, imageUrl: undefined, photoUrl: undefined, src: undefined,
      baseline: p.baseline ? { ...p.baseline, imageUrl: undefined, photoUrl: undefined, src: undefined } : undefined }
  }
  return { ...assessment, photos: assessment.photos.map(canonicalPhoto), report: assessment.report ? { ...assessment.report, photographs: assessment.report.photographs?.map(photo => {
    const canonical = canonicalPhoto(photo)
    // The backend resolves this request-local reference before archiving immutable files.
    return assessment.photos.some(current => current.plane === photo.plane && current.dataUrl === photo.dataUrl)
      ? { ...canonical, dataUrl: undefined, reportSourcePlane: photo.plane } : canonical
  }) } : null }
}

export async function saveAssessmentToStorage(assessment: Assessment): Promise<void> {
  if (!assessment.patient.nome.trim() && !assessment.patient.cognome.trim()) return
  for (const field of ['pesoKg', 'altezzaCm'] as const) {
    if (!validMeasurement(assessment.patient.antropometria?.[field], field)) throw new StoragePersistenceError('Dati antropometrici non validi: salvataggio bloccato.')
  }
  assessment.archiveKey ??= crypto.randomUUID().replaceAll('-', '')
  const snapshot = assessment.patient.antropometria !== undefined || assessment.antropometriaSnapshot ? snapshotFromPatient(assessment.patient) : undefined
  const saved = await clinicalRequest<{id: number}>('assessments', canonicalAssessment({ ...assessment, antropometriaSnapshot: snapshot, report: assessment.report ? { ...assessment.report, antropometria: assessment.report.antropometria ?? anthropometricReport(assessment) } : null }))
  assessment.evaluationId = saved.id
  if (snapshot) assessment.antropometriaSnapshot = snapshot
  if (assessment.report) assessment.report.antropometria ??= anthropometricReport(assessment)
}

export async function loadAssessmentFromStorage(code: string, id: number, revision?: string): Promise<Assessment> {
  const loaded = await clinicalRequest<Assessment>(`assessments?patient=${encodeURIComponent(code)}&id=${id}${revision ? '&revision='+encodeURIComponent(revision) : ''}`)
  if (!loaded?.patient || loaded.patient.id !== code || !/^[a-f0-9]{32}$/.test(loaded.archiveKey || '') || !Array.isArray(loaded.photos) || !Array.isArray(loaded.planeAssessments) || (loaded.evaluationId !== undefined && loaded.evaluationId !== id)) throw new StoragePersistenceError('Documento della valutazione incompleto o associato a un altro paziente. Nessuna scheda vuota creata.')
  return { ...hydrateAssessment(loaded), archiveKey: loaded.archiveKey, evaluationId: id }
}

export async function clearActiveAssessment(): Promise<void> {
  // Starting a new assessment never deletes archived clinical data.
}

export function listPatients(query = ''): Promise<Patient[]> {
  return clinicalRequest(`patients?q=${encodeURIComponent(query)}`)
}
export function listAssessments(code: string): Promise<Array<{ id: number; date: string; antropometriaSnapshot?: AnthropometrySnapshot | null }>> {
  return clinicalRequest(`assessments?patient=${encodeURIComponent(code)}`)
}

export interface PatientDirectory { patients: Patient[]; total: number; offset: number; limit: number }
export function patientDirectory(query = '', offset = 0, archived = false): Promise<PatientDirectory> {
  return clinicalRequest(`patient-directory?q=${encodeURIComponent(query)}&offset=${offset}&archived=${archived}`)
}
export function getPatient(code: string): Promise<Patient> {
  return clinicalRequest(`patients/${encodeURIComponent(code)}`)
}
export interface EvaluationSummary { id: number; date: string; photoCount?: number; landmarkCount?: number; alterationCount?: number; hasReport?: boolean; unavailable?: boolean; antropometriaSnapshot?: AnthropometrySnapshot | null }
export interface RevisionSummary { revision: string; current: boolean; updatedAt?: string; photoCount?: number; landmarkCount?: number; alterationCount?: number; hasReport?: boolean }
export function listRevisions(code: string, id: number): Promise<RevisionSummary[]> { return clinicalRequest(`assessment-revisions?patient=${encodeURIComponent(code)}&id=${id}`) }
export function managePatient(code: string, action: string, extra: Record<string, unknown> = {}): Promise<{backupId?: string; verified?: boolean; evaluations?: number; files?: number}> { return clinicalRequest('patient-management', { code, action, ...extra }) }
export interface ImportPreview { candidates?: Patient[]; exists: boolean; patient: Patient | null; evaluations: Array<{ id: number; date: string }>; token: string }
export function previewPatientImport(patient: Patient): Promise<ImportPreview> {
  return clinicalRequest('imports/preview', { patient })
}
export async function commitPatientImport(assessment: Assessment, preview: ImportPreview): Promise<Assessment> {
  const result = await clinicalRequest<{ id: number; archiveKey: string }>('imports', { assessment: canonicalAssessment(assessment), confirmation: { token: preview.token, mode: preview.exists ? 'new-evaluation' : 'create-patient' } })
  return loadAssessmentFromStorage(assessment.patient.id, result.id)
}
