/**
 * Alias ID alterazioni deprecate → catalogo distrettuale (Step 2).
 * Usato da migrazione storage, label e Myers (fallback difensivo).
 */
export const LEGACY_ALTERATION_ALIASES: Record<string, string> = {
  deviazione_rachidea: 'deviazione_rachidea_toracica',
}

/** Etichette per ID legacy non più in catalogo (export/report storici). */
export const LEGACY_ALTERATION_LABELS: Record<string, string> = {
  deviazione_rachidea: 'Deviazione rachidea (legacy → toracica)',
}

export function resolveAlterationId(alterationId: string): string {
  return LEGACY_ALTERATION_ALIASES[alterationId] ?? alterationId
}

export function isLegacyAlterationId(alterationId: string): boolean {
  return alterationId in LEGACY_ALTERATION_ALIASES
}
