import type { Assessment } from '@/types'

/** Chiave legacy: assessment completo (pre-IndexedDB). */
export const LEGACY_ASSESSMENT_KEY = 'valutazione-posturale-assessment'

/** Id ultimo assessment aperto (solo metadati leggeri). */
export const ACTIVE_ASSESSMENT_ID_KEY = 'valutazione-posturale-active-assessment-id'

/** Flag migrazione legacy → IndexedDB completata con successo. */
export const LEGACY_MIGRATION_DONE_KEY = 'valutazione-posturale-idb-migrated'

export function getActiveAssessmentId(): string | null {
  return localStorage.getItem(ACTIVE_ASSESSMENT_ID_KEY)
}

export function setActiveAssessmentId(id: string): void {
  localStorage.setItem(ACTIVE_ASSESSMENT_ID_KEY, id)
}

export function clearActiveAssessmentId(): void {
  localStorage.removeItem(ACTIVE_ASSESSMENT_ID_KEY)
}

export function isLegacyMigrationDone(): boolean {
  return localStorage.getItem(LEGACY_MIGRATION_DONE_KEY) === '1'
}

export function markLegacyMigrationDone(): void {
  localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, '1')
}

export function readLegacyFullAssessment(): Assessment | null {
  try {
    const raw = localStorage.getItem(LEGACY_ASSESSMENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Assessment
  } catch {
    return null
  }
}

export function clearLegacyFullAssessment(): void {
  localStorage.removeItem(LEGACY_ASSESSMENT_KEY)
}

export function hasLegacyFullAssessment(): boolean {
  return localStorage.getItem(LEGACY_ASSESSMENT_KEY) !== null
}
