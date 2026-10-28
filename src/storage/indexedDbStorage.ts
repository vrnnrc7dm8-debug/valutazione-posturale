import type { AnatomicalPlane } from '@/types'

export const CLINICAL_DB_NAME = 'valutazione-posturale-clinical'
export const CLINICAL_DB_VERSION = 1

export const ASSESSMENTS_STORE = 'assessments'
export const PHOTO_BLOBS_STORE = 'photoBlobs'

export type PhotoBlobKind = 'main' | 'baseline'

export interface PhotoBlobRecord {
  id: string
  assessmentId: string
  plane: AnatomicalPlane
  kind: PhotoBlobKind
  blob: Blob
  mimeType: string
  fileName?: string
}

export interface AssessmentRecord {
  id: string
  payload: unknown
  updatedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function runTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  return openClinicalDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeNames, mode)
        run(tx).then(resolve).catch(reject)
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      }),
  )
}

export function openClinicalDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CLINICAL_DB_NAME, CLINICAL_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ASSESSMENTS_STORE)) {
        db.createObjectStore(ASSESSMENTS_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(PHOTO_BLOBS_STORE)) {
        const store = db.createObjectStore(PHOTO_BLOBS_STORE, { keyPath: 'id' })
        store.createIndex('assessmentId', 'assessmentId', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })

  return dbPromise
}

export function photoBlobId(
  assessmentId: string,
  plane: AnatomicalPlane,
  kind: PhotoBlobKind,
): string {
  return `${assessmentId}::${plane}::${kind}`
}

export async function putAssessmentRecord(record: AssessmentRecord): Promise<void> {
  await runTransaction(ASSESSMENTS_STORE, 'readwrite', async (tx) => {
    await wrapRequest(tx.objectStore(ASSESSMENTS_STORE).put(record))
  })
}

export async function getAssessmentRecord(id: string): Promise<AssessmentRecord | undefined> {
  return runTransaction(ASSESSMENTS_STORE, 'readonly', async (tx) => {
    return wrapRequest(tx.objectStore(ASSESSMENTS_STORE).get(id))
  })
}

export async function deleteAssessmentRecord(id: string): Promise<void> {
  await runTransaction(ASSESSMENTS_STORE, 'readwrite', async (tx) => {
    await wrapRequest(tx.objectStore(ASSESSMENTS_STORE).delete(id))
  })
}

export async function putPhotoBlob(record: PhotoBlobRecord): Promise<void> {
  await runTransaction(PHOTO_BLOBS_STORE, 'readwrite', async (tx) => {
    await wrapRequest(tx.objectStore(PHOTO_BLOBS_STORE).put(record))
  })
}

export async function deletePhotoBlob(id: string): Promise<void> {
  await runTransaction(PHOTO_BLOBS_STORE, 'readwrite', async (tx) => {
    await wrapRequest(tx.objectStore(PHOTO_BLOBS_STORE).delete(id))
  })
}

export async function getPhotoBlobsForAssessment(
  assessmentId: string,
): Promise<PhotoBlobRecord[]> {
  return runTransaction(PHOTO_BLOBS_STORE, 'readonly', async (tx) => {
    const index = tx.objectStore(PHOTO_BLOBS_STORE).index('assessmentId')
    return wrapRequest(index.getAll(assessmentId))
  })
}

export async function deletePhotoBlobsForAssessment(assessmentId: string): Promise<void> {
  const blobs = await getPhotoBlobsForAssessment(assessmentId)
  if (blobs.length === 0) return

  await runTransaction(PHOTO_BLOBS_STORE, 'readwrite', async (tx) => {
    const store = tx.objectStore(PHOTO_BLOBS_STORE)
    for (const blob of blobs) {
      await wrapRequest(store.delete(blob.id))
    }
  })
}

export async function deleteAssessmentFromIndexedDb(assessmentId: string): Promise<void> {
  await deletePhotoBlobsForAssessment(assessmentId)
  await deleteAssessmentRecord(assessmentId)
}
