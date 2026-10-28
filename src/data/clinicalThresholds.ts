import type { QuantitativeUnit } from '@/types'

/** Versione configurazione soglie (futuro export/import). */
export const CLINICAL_THRESHOLDS_VERSION = 'clinical-thresholds-v1'

export type MeasurementKind =
  | 'dislivello_normalizzato'
  | 'shift_normalizzato'
  | 'delta_y_normalizzato'
  | 'angolo_gradi'

/** Soglie a tre livelli: valore assoluto ≥ soglia → severità corrispondente. */
export interface ThreeLevelThreshold {
  /** Sotto questo valore: normale (solo auto-misure). */
  normale: number
  lieve: number
  moderato: number
  severo: number
}

/** Soglia minima di rilevamento + bande di severità. */
export interface DetectionThreshold extends ThreeLevelThreshold {
  detection: number
}

export const CLINICAL_THRESHOLDS = {
  /** Dislivelli verticali normalizzati (0–1 altezza immagine). */
  dislivello_normalizzato: {
    normale: 0.01,
    lieve: 0.01,
    moderato: 0.025,
    severo: 0.045,
  } satisfies ThreeLevelThreshold,

  /** Shift sagittale anteriore (trago, forward head, acromion-trocantere). */
  shift_anteriore_normalizzato: {
    detection: 0.015,
    normale: 0.015,
    lieve: 0.02,
    moderato: 0.05,
    severo: 0.08,
  } satisfies DetectionThreshold,

  shift_anteriore_acromion_trocantere: {
    detection: 0.02,
    normale: 0.02,
    lieve: 0.025,
    moderato: 0.04,
    severo: 0.06,
  } satisfies DetectionThreshold,

  shift_bacino_sagittale: {
    detection: 0.025,
    normale: 0.025,
    lieve: 0.03,
    moderato: 0.05,
    severo: 0.08,
  } satisfies DetectionThreshold,

  /** Delta Y SIAS − SIPS (positivo = SIAS più bassa). */
  sias_sips_anterior: {
    detection: 0.01,
    normale: 0.01,
    lieve: 0.012,
    moderato: 0.025,
    severo: 0.04,
  } satisfies DetectionThreshold,

  /** Delta Y SIAS − SIPS (negativo = SIAS più alta). */
  sias_sips_posterior: {
    detection: 0.008,
    normale: 0.008,
    lieve: 0.01,
    moderato: 0.02,
    severo: 0.035,
  } satisfies DetectionThreshold,

  /** Deviazione plumb line (gradi). */
  plumb_line_gradi: {
    normale: 2,
    lieve: 2,
    moderato: 4,
    severo: 8,
  } satisfies ThreeLevelThreshold,

  /** Inclinazione linea bipupillare (gradi assoluti). */
  bipupillare_gradi: {
    normale: 2,
    lieve: 2,
    moderato: 4,
    severo: 6,
  } satisfies ThreeLevelThreshold,

  /** Cifosi T10 vs L5 (shift posteriore T10). */
  cifosi_t10_l5: {
    detection: 0.02,
    normale: 0.02,
    lieve: 0.025,
    moderato: 0.04,
    severo: 0.06,
  } satisfies DetectionThreshold,

  /** Lordosi lombare (T10–S1). */
  lordosi_l5_t10: {
    detection: 0.015,
    normale: 0.015,
    lieve: 0.02,
    moderato: 0.035,
    severo: 0.05,
  } satisfies DetectionThreshold,

  /** Rettilineizzazione lombare. */
  rettilineizzazione_lombare: {
    detection: 0.018,
    normale: 0.018,
    lieve: 0.022,
    moderato: 0.035,
    severo: 0.05,
  } satisfies DetectionThreshold,

  /** C7 vs T10 anteriorizzazione cervicale. */
  c7_t10_shift: {
    detection: 0.012,
    normale: 0.012,
    lieve: 0.015,
    moderato: 0.025,
    severo: 0.04,
  } satisfies DetectionThreshold,

  forward_head_trago_xifoide: {
    detection: 0.02,
    normale: 0.02,
    lieve: 0.03,
    moderato: 0.05,
    severo: 0.08,
  } satisfies DetectionThreshold,

  deviazione_spinous_posterior: {
    detection: 0.012,
    normale: 0.012,
    lieve: 0.015,
    moderato: 0.025,
    severo: 0.04,
  } satisfies DetectionThreshold,

  /** Shift sagittale inter-segmento (cifosi/lordosi locale). */
  sagittal_segment_shift: {
    detection: 0.015,
    normale: 0.015,
    lieve: 0.018,
    moderato: 0.028,
    severo: 0.045,
  } satisfies DetectionThreshold,

  /** Deviazione ginocchio rispetto a linea anca–caviglia (frontale). */
  ginocchio_valgismo_varismo: {
    detection: 0.01,
    normale: 0.01,
    lieve: 0.018,
    moderato: 0.03,
    severo: 0.05,
  } satisfies DetectionThreshold,

  /** Rotazione arto inferiore stimata sul piano frontale. */
  rotazione_arto_frontale: {
    detection: 0.008,
    normale: 0.008,
    lieve: 0.018,
    moderato: 0.03,
    severo: 0.05,
  } satisfies DetectionThreshold,

  suggestion_hint: {
    dislivello_sias: 0.02,
  },
} as const

export type ClinicalThresholdsConfig = typeof CLINICAL_THRESHOLDS

/** Snapshot serializzabile per export futuro. */
export function getClinicalThresholdsSnapshot(): {
  version: string
  thresholds: ClinicalThresholdsConfig
} {
  return {
    version: CLINICAL_THRESHOLDS_VERSION,
    thresholds: CLINICAL_THRESHOLDS,
  }
}

export function normalizedToPercentValue(magnitude: number): number {
  return Math.round(magnitude * 1000) / 10
}

export function percentQuantitative(magnitude: number): {
  value: number
  unit: QuantitativeUnit
} {
  return {
    value: normalizedToPercentValue(magnitude),
    unit: 'percentuale',
  }
}

export function degreesQuantitative(degrees: number): {
  value: number
  unit: QuantitativeUnit
} {
  return {
    value: Math.round(Math.abs(degrees) * 10) / 10,
    unit: 'gradi',
  }
}

export function formatQuantitativeValue(
  quantitative?: { value: number; unit: QuantitativeUnit },
): string | undefined {
  if (!quantitative) return undefined
  switch (quantitative.unit) {
    case 'gradi':
      return `${quantitative.value}°`
    case 'percentuale':
      return `${quantitative.value}%`
    case 'mm':
      return `${quantitative.value} mm`
    case 'normalizzato':
      return `${quantitative.value} norm.`
    default:
      return `${quantitative.value}`
  }
}
