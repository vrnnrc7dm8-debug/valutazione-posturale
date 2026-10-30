import { observationDescriptor } from '@/data/clinicalOperators'
import type { ClinicalObservation, ClinicalDistrict } from '@/types'
import type { AutoMeasurement } from './biomechanicsEngine'

const FRONTAL_MAPPING: Record<string, { phenomenon: string; district: ClinicalDistrict }> = {
  dislivello_acromiale_auto: { phenomenon: 'dislivello_acromiale', district: 'cintura_scapolare' },
  dislivello_sias_auto: { phenomenon: 'dislivello_sias', district: 'pelvico' },
  bipupillare_tilt: { phenomenon: 'inclinazione_linea_bipupillare', district: 'cranio_cervicale' },
  asse_femoro_tibiale_destro: { phenomenon: 'asse_femoro_tibiale', district: 'arto_inferiore' },
  asse_femoro_tibiale_sinistro: { phenomenon: 'asse_femoro_tibiale', district: 'arto_inferiore' },
  rotazione_arto_inferiore_destro: { phenomenon: 'rotazione_arto_inferiore', district: 'arto_inferiore' },
  rotazione_arto_inferiore_sinistro: { phenomenon: 'rotazione_arto_inferiore', district: 'arto_inferiore' },
}

const TRANSVERSE_MAPPING: Record<string, { phenomenon: string; district: ClinicalDistrict }> = {
  trasv_capo_torace: { phenomenon: 'rotazione_capo', district: 'cranio_cervicale' },
  trasv_torace: { phenomenon: 'rotazione_toracica', district: 'toracica' },
  trasv_bacino: { phenomenon: 'rotazione_bacino', district: 'pelvico' },
  trasv_torace_bacino: { phenomenon: 'disaccoppiamento_torace_bacino', district: 'toraco_lombare' },
  trasv_piede_dx: { phenomenon: 'asse_podalico', district: 'arto_inferiore' },
  trasv_piede_sx: { phenomenon: 'asse_podalico', district: 'arto_inferiore' },
}

/** Classification thresholds belong to the measurement engine, never to the UI. */
export function observationsFromAutoMeasurements(measurements: AutoMeasurement[]): ClinicalObservation[] {
  const observations = new Map<string, ClinicalObservation>()
  for (const m of measurements) {
    const mapping = m.plane === 'trasverso' ? TRANSVERSE_MAPPING[m.id] : FRONTAL_MAPPING[m.id]
    if (!['frontale_anteriore', 'trasverso'].includes(m.plane) || !mapping || m.severity === 'normale' || !Number.isFinite(m.numericValue) || !m.unit) continue
    const id = `automatic_measurement:${m.plane}:${m.id}`
    observations.set(id, {
      id, plane: m.plane, ...mapping, descriptor: m.plane === 'trasverso' ? 'rotation' : observationDescriptor(mapping.phenomenon, m.plane),
      side: m.side ?? (m.id.endsWith('_destro') ? 'destro' : m.id.endsWith('_sinistro') ? 'sinistro' : undefined),
      direction: m.plane === 'trasverso' ? undefined : mapping.phenomenon === 'rotazione_arto_inferiore' && !['rotazione_dx', 'rotazione_sx'].includes(m.direction ?? '') ? undefined : m.direction, severity: m.severity,
      quantitative: { value: m.numericValue!, unit: m.unit },
      source: 'automatic_measurement', sourceIds: [id], status: 'suggested',
      notes: mapping.phenomenon === 'rotazione_arto_inferiore' ? `${m.value} (stima del segmento; specificare la direzione assiale clinica). ${m.suggestion ?? ''}` : m.observationNote ?? m.suggestion,
    })
  }
  return [...observations.values()]
}

/** Decisions override regeneration even after side/direction/value changes. */
export function mergeAutomaticObservations(persisted: ClinicalObservation[], generated: ClinicalObservation[]): ClinicalObservation[] {
  const result = [...persisted]
  const sources = new Set(persisted.flatMap(o => [o.id, ...o.sourceIds]))
  const semanticKey = (o: ClinicalObservation) => {
    const direction = ['dislivello_acromiale', 'dislivello_sias', 'inclinazione_linea_bipupillare'].includes(o.phenomenon)
      ? o.direction ?? (o.side === 'destro' ? 'dx' : o.side === 'sinistro' ? 'sx' : undefined) : o.direction
    return JSON.stringify([o.plane, o.phenomenon, observationDescriptor(o.phenomenon, o.plane, o.descriptor), o.district, o.side, direction])
  }
  const existing = new Set(persisted.map(semanticKey))
  for (const observation of generated) {
    if (!sources.has(observation.id) && !existing.has(semanticKey(observation))) result.push(observation)
  }
  return result
}
