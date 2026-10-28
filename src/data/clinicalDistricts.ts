import type { ClinicalDistrict } from '@/types'

/** Etichette UI distretti anatomico-funzionali. */
export const CLINICAL_DISTRICT_LABELS: Record<ClinicalDistrict, string> = {
  cranio_cervicale: 'Cranio-cervicale',
  cervicale: 'Cervicale',
  cervico_dorsale: 'Cervico-dorsale',
  toracica: 'Toracica',
  toraco_lombare: 'Toraco-lombare',
  lombare: 'Lombare',
  lombosacrale: 'Lombo-sacrale',
  sacrale: 'Sacrale',
  pelvico: 'Pelvico',
  cintura_scapolare: 'Cintura scapolare',
  arto_superiore: 'Arto superiore',
  arto_inferiore: 'Arto inferiore',
  globale: 'Globale',
}

export function getClinicalDistrictLabel(district: ClinicalDistrict): string {
  return CLINICAL_DISTRICT_LABELS[district]
}
